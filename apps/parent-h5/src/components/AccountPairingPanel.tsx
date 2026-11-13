'use client';
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { emailVerificationUrl } from '../services/supabaseConfig';
import { sendAccountEmail } from '../services/accountEmails';

type Mode = 'login' | 'register' | 'forgot' | 'resend';
const titles: Record<Mode, string> = { login: '登录家长账号', register: '注册家长账号', forgot: '找回密码', resend: '重发验证邮件' };
export function AccountPairingPanel() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false), [pending, setPending] = useState(false);
  const [message, setMessage] = useState(''), [nextSendAt, setNextSendAt] = useState(0), [now, setNow] = useState(Date.now());
  const running = useRef(false);
  const emailOnly = mode === 'forgot' || mode === 'resend';
  const remaining = Math.max(0, Math.ceil((nextSendAt - now) / 1000));
  useEffect(() => {
    const auth = new URLSearchParams(window.location.search).get('auth');
    if (auth === 'forgot' || auth === 'resend') setMode(auth);
  }, []);
  useEffect(() => {
    if (!nextSendAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [nextSendAt]);
  const changeMode = (next: Mode) => { setMode(next); setMessage(''); setPassword(''); setShowPassword(false); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || running.current || (emailOnly && remaining > 0)) return;
    running.current = true; setPending(true); setMessage('');
    try {
      if (mode === 'forgot' || mode === 'resend') {
        await sendAccountEmail(mode, email.trim());
        setNow(Date.now()); setNextSendAt(Date.now() + 60000);
        setMessage(mode === 'forgot' ? '如果该邮箱可找回密码，你会收到重置邮件。请检查收件箱和垃圾邮件。' : '如果该邮箱尚未验证，你会收到确认邮件。请检查收件箱和垃圾邮件。');
      } else {
        const result = mode === 'register'
          ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: emailVerificationUrl } })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) {
          if (result.error.code === 'email_not_confirmed') { setMode('resend'); setPassword(''); setMessage('邮箱尚未验证。可以在这里重新发送确认邮件。'); return; }
          if (result.error.status === 429) throw new Error('操作较频繁，请稍后重试。');
          throw new Error(mode === 'register' ? '注册未完成，请检查邮箱和密码，或稍后重试。' : '登录失败，请检查邮箱和密码。');
        }
        setPassword('');
        if (mode === 'register' && !result.data.session) { setMode('resend'); setMessage('请打开注册邮件完成验证，然后返回使用邮箱和密码登录。'); setNow(Date.now()); setNextSendAt(Date.now() + 60000); }
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : '暂时无法处理，请稍后重试。'); }
    finally { running.current = false; setPending(false); }
  };
  return <section className="kid-card space-y-4" aria-label="家长账号">
    <h2 className="text-h2 font-semibold">{titles[mode]}</h2>
    {emailOnly && <p className="text-sm text-[#77786F] leading-6">{mode === 'forgot' ? '填写注册邮箱，我们会发送设置新密码的链接。' : '填写注册邮箱，重新获取邮箱验证链接；已验证的账号可以直接登录。'}</p>}
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm">家长邮箱<input className="kid-input mt-2" type="email" autoComplete="email" maxLength={254} required disabled={pending} placeholder="请输入注册邮箱" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {!emailOnly && <><label className="block text-sm" htmlFor="account-password">密码{mode === 'register' ? '（8–72 个字符）' : ''}</label>
        <div className="flex items-center gap-2"><input id="account-password" className="kid-input" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : undefined} maxLength={mode === 'register' ? 72 : undefined} required disabled={pending} placeholder="请输入密码" value={password} onChange={e => setPassword(e.target.value)} /><button className="kid-btn kid-btn-ghost shrink-0" type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? '隐藏' : '显示'}</button></div>
      </>}
      <button className="kid-btn kid-btn-primary w-full" type="submit" disabled={pending || (emailOnly && remaining > 0)}>{pending ? '正在处理…' : emailOnly && remaining > 0 ? `${remaining} 秒后可重发` : mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送邮件'}</button>
    </form>
    {message && <p role="status" className="text-sm leading-6 text-[#78664D]">{message}</p>}
    <div className="flex flex-wrap gap-x-4 gap-y-3 text-sm">
      {mode !== 'login' && <button type="button" disabled={pending} onClick={() => changeMode('login')}>返回登录</button>}
      {mode === 'login' && <><button type="button" disabled={pending} onClick={() => changeMode('register')}>注册账号</button><button type="button" disabled={pending} onClick={() => changeMode('forgot')}>忘记密码</button><button type="button" disabled={pending} onClick={() => changeMode('resend')}>重发验证邮件</button></>}
    </div>
  </section>;
}
