'use client';
import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { emailVerificationUrl } from '../services/supabaseConfig';

type Child = { id: string; nickname: string };
type Device = { id: string; alias: string; child_id: string | null; status: string };

export function AccountPairingPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const api = useCallback(async (path: string, token: string, init: RequestInit = {}) => {
    const response = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || '请求失败');
    return body;
  }, []);
  const refresh = useCallback(async (active: Session) => {
    await api('/api/v1/family/bootstrap', active.access_token, { method: 'POST' });
    const [pair, childList, deviceList] = await Promise.all([
      api('/api/v1/pairing/code', active.access_token),
      api('/api/v1/family/children', active.access_token),
      api('/api/v1/devices', active.access_token),
    ]);
    setCode(pair.code); setChildren(childList.children); setDevices(deviceList.devices);
  }, [api]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setCode(''); setChildren([]); setDevices([]); return; }
    refresh(session).catch(() => setMessage('无法加载真实家庭数据，请确认服务已部署及数据库迁移已完成。'));
  }, [session, refresh]);
  const signIn = async (register: boolean) => {
    if (!supabase) { setMessage('Supabase 登录未配置'); return; }
    setPending(true); setMessage('');
    try {
      const result = register ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: emailVerificationUrl } }) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (register && !result.data.session) setMessage('请先到邮箱确认注册，再登录。');
    } catch { setMessage('登录或注册失败，请检查邮箱、密码和服务配置。'); }
    finally { setPending(false); }
  };
  const addChild = async () => {
    if (!session || !nickname.trim()) return;
    setPending(true); setMessage('');
    try { await api('/api/v1/family/children', session.access_token, { method: 'POST', body: JSON.stringify({ nickname: nickname.trim() }) }); setNickname(''); await refresh(session); }
    catch { setMessage('添加孩子失败，请稍后重试。'); } finally { setPending(false); }
  };
  const assign = async (deviceId: string, childId: string) => {
    if (!session || !childId) return;
    setPending(true); setMessage('');
    try { await api(`/api/v1/devices/${deviceId}/child`, session.access_token, { method: 'PATCH', body: JSON.stringify({ childId }) }); await refresh(session); setMessage('设备已分配给孩子。'); }
    catch { setMessage('设备分配失败，请稍后重试。'); } finally { setPending(false); }
  };
  return <section className="kid-card space-y-3" aria-label="家长账号和设备配对">
    <h2 className="text-h2 font-semibold">家长账号与设备配对</h2>
    {!session ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); signIn(false); }}>
      <label className="block text-sm">家长邮箱<input className="kid-input" type="email" autoComplete="email" required placeholder="请输入邮箱" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block text-sm" htmlFor="account-password">密码</label>
      <div className="flex items-center gap-2"><input id="account-password" className="kid-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="请输入密码" value={password} onChange={e => setPassword(e.target.value)} /><button className="kid-btn kid-btn-ghost shrink-0" type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? '隐藏' : '显示'}</button></div>
      <div className="flex gap-2"><button className="kid-btn kid-btn-primary" type="submit" disabled={pending}>登录</button><button className="kid-btn kid-btn-ghost" type="button" disabled={pending || !email.trim() || !password} onClick={() => signIn(true)}>注册</button></div>
      <p className="text-sm text-gray-600">首次使用请选择注册；如开启邮箱验证，请先完成邮件验证。</p>
    </form> : <>
      <p className="text-sm">已登录：{session.user.email}</p>
      <p className="text-sm">设备配对码（请勿分享）</p>
      <p className="font-mono font-bold break-all select-all">{code || '加载中…'}</p>
      <div className="flex gap-2"><input className="kid-input" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="孩子昵称" /><button className="kid-btn kid-btn-primary" disabled={pending} onClick={addChild}>添加</button></div>
      {devices.length === 0 ? <p className="text-sm">设备输入配对码后会显示在这里。</p> : devices.map(device => <label className="block text-sm" key={device.id}>{device.alias}
        <select className="kid-input mt-1" disabled={pending} value={device.child_id || ''} onChange={e => assign(device.id, e.target.value)}><option value="">请选择孩子</option>{children.map(child => <option key={child.id} value={child.id}>{child.nickname}</option>)}</select>
      </label>)}
      <div className="flex gap-2"><button className="kid-btn kid-btn-ghost" disabled={pending} onClick={() => refresh(session).catch(() => setMessage('刷新失败'))}>刷新设备</button><button className="kid-btn kid-btn-ghost" onClick={() => supabase?.auth.signOut()}>退出登录</button></div>
    </>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
