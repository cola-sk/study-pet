'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Popup, Toast } from 'antd-mobile';
import { FamilyShop, ShopProduct } from '../../components/FamilyShop';
import { IconCoin, IconPaw, IconPlus } from '../../components/Icons';
import { UserProvidedVisual } from '../../components/UserProvidedVisual';
import { familyApi, FamilyApiError, FamilyChild } from '../../services/familyApi';

type Transaction = { id: string; amount: number; balance_after: number; type: string; description: string; created_at: string };
type Wallet = { credits: number; transactions: Transaction[]; items: ShopProduct[] };
type Reward = { childId: string; amount: number; note: string; requestId: string };

export const PetWalletPage: React.FC = () => {
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [childId, setChildId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletError, setWalletError] = useState('');
  const [revision, setRevision] = useState(0);
  const [newChild, setNewChild] = useState(false);
  const [nickname, setNickname] = useState('');
  const [creating, setCreating] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [amount, setAmount] = useState('10');
  const [note, setNote] = useState('');
  const [rewardError, setRewardError] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<Reward | null>(null);
  const sendingRef = useRef(false);
  const child = children.find(item => item.id === childId);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const family = await familyApi<{ familyId: string }>('/api/v1/family/bootstrap', { method: 'POST' });
      const result = await familyApi<{ children: FamilyChild[] }>('/api/v1/family/children');
      setFamilyId(family.familyId); setChildren(result.children);
      setChildId(current => result.children.some(item => item.id === current) ? current : result.children[0]?.id || '');
      const saved = localStorage.getItem(`study_pet_pending_reward_${family.familyId}`);
      if (saved) {
        const reward: Reward = JSON.parse(saved);
        if (typeof reward.childId === 'string' && Number.isInteger(reward.amount) && typeof reward.requestId === 'string' && typeof reward.note === 'string') setPending(reward);
      }
    } catch { setError('无法加载宝贝和宠物信息，请检查网络后重试。'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onFocus = () => { void refresh(); setRevision(value => value + 1); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  useEffect(() => {
    setWallet(null); setWalletError('');
    if (!childId) return;
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await familyApi<Wallet>(`/api/v1/family/children/${childId}/wallet`, { signal: controller.signal });
        if (active) { setWallet(result); setWalletError(''); }
      } catch { if (active) setWalletError('金币明细暂时无法加载，请重试。'); }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 10000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [childId, revision]);

  const createChild = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating || !nickname.trim()) return;
    setCreating(true);
    try {
      const result = await familyApi<{ child: FamilyChild }>('/api/v1/family/children', { method: 'POST', body: JSON.stringify({ nickname: nickname.trim() }) });
      setChildren(current => [...current, result.child]); setChildId(result.child.id); setNickname(''); setNewChild(false);
      Toast.show({ content: '已添加宝贝和专属小二哈' });
    } catch { Toast.show({ content: '添加失败，请稍后重试' }); }
    finally { setCreating(false); }
  };
  const openReward = () => {
    setRewardError('');
    if (pending) { setChildId(pending.childId); setAmount(String(pending.amount)); setNote(pending.note); }
    else { setAmount('10'); setNote(''); }
    setRewardOpen(true);
  };
  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sendingRef.current || !child || !familyId) return;
    if (!pending && (!/^\d+$/.test(amount) || Number(amount) < 1 || Number(amount) > 10000)) { setRewardError('请输入 1–10000 的整数金币数量'); return; }
    const reward = pending || { childId: child.id, amount: Number(amount), note: note.trim(), requestId: crypto.randomUUID() };
    const key = `study_pet_pending_reward_${familyId}`;
    // Persist before sending, so a timeout or reload retries the same operation.
    try { localStorage.setItem(key, JSON.stringify(reward)); }
    catch { setRewardError('浏览器无法保存本次奖励，请允许网站存储后重试。'); return; }
    sendingRef.current = true; setSending(true); setPending(reward); setRewardError('');
    try {
      const result = await familyApi<{ credits: number }>(`/api/v1/family/children/${reward.childId}/credits`, {
        method: 'POST', body: JSON.stringify({ amount: reward.amount, note: reward.note, requestId: reward.requestId }),
      });
      localStorage.removeItem(key); setPending(null); setRewardOpen(false);
      setChildren(current => current.map(item => item.id === reward.childId ? { ...item, coins_balance: result.credits } : item));
      setWallet(current => current ? { ...current, credits: result.credits } : null);
      setRevision(value => value + 1);
      Toast.show({ content: '奖励已到账，设备联网后将自动更新' });
    } catch (failure) {
      if (failure instanceof FamilyApiError && [400, 404, 409].includes(failure.status)) {
        localStorage.removeItem(key); setPending(null); setRewardError(failure.message);
      } else setRewardError('尚未确认奖励结果。请点击“重试确认”，同一笔奖励不会重复发放。');
    } finally { sendingRef.current = false; setSending(false); }
  };

  return (
    <div className="px-3 py-2.5 space-y-4 pb-20 text-[#1F2937]">
      <div className="flex items-center justify-between"><div><h2 className="text-h2">宝贝与小宠</h2><p className="text-xs text-[#6B7280] mt-1">每个宝贝都有专属小二哈和金币账户</p></div><button type="button" className="kid-btn kid-btn-primary kid-btn-sm" onClick={() => setNewChild(true)}><IconPlus className="w-3 h-3" />添加宝贝</button></div>
      {loading ? <p className="kid-card text-sm" role="status">正在加载…</p> : error ? <div className="kid-card space-y-2"><p role="alert" className="text-sm">{error}</p><button type="button" className="kid-btn kid-btn-ghost kid-btn-sm" onClick={refresh}>重新加载</button></div> : children.length === 0 ? <div className="kid-card py-8 text-center space-y-3"><IconPaw className="w-9 h-9 mx-auto text-[#728E62]" /><h3 className="font-semibold">先为宝贝建立成长空间</h3><p className="text-sm text-[#6B7280]">添加昵称后，就可以管理专属小宠和奖励金币。</p><button type="button" className="kid-btn kid-btn-primary" onClick={() => setNewChild(true)}>添加第一个宝贝</button></div> : <>
        {pending && <div className="kid-card space-y-2 bg-[#FFF8E8]" role="status"><p className="text-sm">有一笔 {pending.amount} 金币奖励等待确认，请先确认结果。</p><button type="button" className="kid-btn kid-btn-secondary kid-btn-sm" onClick={openReward}>查看并确认奖励</button></div>}
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="选择宝贝">{children.map(item => <button type="button" role="tab" aria-selected={childId === item.id} key={item.id} onClick={() => setChildId(item.id)} className={`kid-filter-chip shrink-0 ${childId === item.id ? 'kid-filter-chip-selected' : ''}`}>{item.nickname?.trim() || '宝贝'}</button>)}</div>
        {child && <>
          <section className="kid-card space-y-4">
            <div className="flex items-center gap-3"><div className="w-14 h-14 rounded-2xl bg-[#F1F4EB] flex items-center justify-center shrink-0">{child.avatar_url ? <UserProvidedVisual value={child.avatar_url} alt="宝贝头像" className="h-14 w-14 rounded-2xl object-cover" /> : <IconPaw className="w-7 h-7 text-[#728E62]" />}</div><div className="min-w-0"><h3 className="text-h2 truncate">{child.nickname?.trim() || '宝贝'}</h3><p className="text-sm text-[#6B7280] mt-1">陪伴宠物 · 小二哈</p></div></div>
            <div className="rounded-xl bg-[#FAF5E9] p-4 flex items-center justify-between gap-3"><div><p className="text-xs text-[#78664D]">宝贝的金币 · 用于照顾小宠</p><div className="flex items-center gap-1 mt-1 text-2xl font-bold text-[#9B681C]"><IconCoin className="w-5 h-5" />{wallet?.credits ?? child.coins_balance}</div></div><button type="button" className="kid-btn kid-btn-primary kid-btn-sm shrink-0" onClick={openReward}>奖励金币</button></div>
            <div className="text-xs text-[#6B7280] space-y-2"><p>陪伴设备：{child.devices?.length ? child.devices.map(device => device.alias).join('、') : '尚未绑定，可在“家庭设备”添加'}</p>{child.pet ? <p>已投喂食物 {child.pet.food_count} 次 · 饮水 {child.pet.water_count} 次</p> : <p>在桌面设备上与小二哈一起成长</p>}</div>
          </section>
          <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="text-h2">金币明细</h3><button type="button" className="kid-btn kid-btn-ghost kid-btn-sm" onClick={() => setRevision(value => value + 1)}>刷新</button></div>
            {walletError && <p role="alert" className="text-sm text-[#B45309]">{walletError}</p>}
            {!wallet ? !walletError && <p role="status" className="kid-card text-sm text-[#6B7280]">正在获取真实余额和明细…</p> : <div className="kid-list">{wallet.transactions.length ? wallet.transactions.map(tx => <div className="kid-list-row" key={tx.id}><div className="min-w-0 flex-1"><p className="font-semibold text-sm break-words">{tx.description}</p><p className="text-xs text-[#6B7280] mt-1">{new Date(tx.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} · 余额 {tx.balance_after}</p></div><span className={`font-bold shrink-0 ${tx.amount > 0 ? 'text-[#487A42]' : 'text-[#6B7280]'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span></div>) : <p className="p-5 text-center text-sm text-[#6B7280]">暂无金币记录，给宝贝发放第一笔奖励吧。</p>}</div>}
            {wallet && wallet.transactions.length >= 50 && <p className="text-xs text-[#6B7280]">展示最近 50 条记录</p>}
          </section>

        </>}
      </>}
      {!loading && !error && familyId && <FamilyShop />}
      <Popup visible={newChild} onMaskClick={() => !creating && setNewChild(false)} bodyStyle={{ borderRadius: '20px 20px 0 0' }} destroyOnClose><form className="p-5 pb-8 space-y-4 max-w-xl mx-auto" onSubmit={createChild}><h3 className="text-lg font-bold">添加宝贝与小宠</h3><p className="text-sm text-[#6B7280]">一个昵称，一个专属小二哈；设备可以稍后绑定。</p><label className="block text-sm" htmlFor="child-name">宝贝昵称</label><input id="child-name" className="kid-input" maxLength={50} required disabled={creating} value={nickname} onChange={event => setNickname(event.target.value)} placeholder="输入宝贝昵称" /><div className="flex gap-2"><button type="button" className="kid-btn kid-btn-ghost flex-1" disabled={creating} onClick={() => setNewChild(false)}>取消</button><button type="submit" className="kid-btn kid-btn-primary flex-1" disabled={creating || !nickname.trim()}>{creating ? '正在添加…' : '添加宝贝'}</button></div></form></Popup>
      <Popup visible={rewardOpen} onMaskClick={() => !sending && setRewardOpen(false)} bodyStyle={{ borderRadius: '20px 20px 0 0' }} destroyOnClose><form className="p-5 pb-8 space-y-4 max-w-xl mx-auto" onSubmit={grant}><h3 className="text-lg font-bold">奖励金币给 {child?.nickname?.trim() || '宝贝'}</h3><p className="text-sm text-[#6B7280]">金币存入宝贝账户，用于照顾专属小二哈。设备联网后自动同步。</p><label htmlFor="reward-amount" className="block text-sm">金币数量</label><input id="reward-amount" className="kid-input" type="number" inputMode="numeric" min={1} max={10000} step={1} required disabled={sending || !!pending} value={amount} onChange={event => setAmount(event.target.value)} />{!pending && <div className="flex gap-2">{[10, 20, 50].map(value => <button type="button" key={value} className={`kid-filter-chip ${amount === String(value) ? 'kid-filter-chip-selected' : ''}`} disabled={sending} onClick={() => setAmount(String(value))}>+{value}</button>)}</div>}<label htmlFor="reward-note" className="block text-sm">奖励原因（选填）</label><input id="reward-note" className="kid-input" maxLength={200} disabled={sending || !!pending} value={note} onChange={event => setNote(event.target.value)} placeholder="例如：今天坚持阅读，非常棒" />{rewardError && <p role="alert" className="text-sm text-[#B45309]">{rewardError}</p>}<div className="flex gap-2"><button type="button" className="kid-btn kid-btn-ghost flex-1" disabled={sending} onClick={() => setRewardOpen(false)}>关闭</button><button type="submit" className="kid-btn kid-btn-primary flex-1" disabled={sending || !child}>{sending ? '正在确认…' : pending ? '重试确认' : '确认奖励'}</button></div></form></Popup>
    </div>
  );
};
