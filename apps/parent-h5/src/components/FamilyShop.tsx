'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, Popup, Toast } from 'antd-mobile';
import { familyApi, FamilyApiError } from '../services/familyApi';

export type ShopProduct = { id: string; name: string; price: number; action: string; builtin_key: string | null; updated_at: string };
const actions = [{ value: 'eat', label: '吃东西' }, { value: 'drink', label: '喝水' }, { value: 'pet', label: '陪伴玩耍' }, { value: 'happy', label: '开心庆祝' }];

export function FamilyShop() {
  const [items, setItems] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('1');
  const [action, setAction] = useState('happy');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const busyRef = useRef(false);
  const load = useCallback(async () => {
    setError('');
    try { const result = await familyApi<{ items: ShopProduct[] }>('/api/v1/family/shop'); setItems(result.items); }
    catch { setError('商品目录暂时无法加载，请重试。'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); window.addEventListener('focus', load); return () => window.removeEventListener('focus', load); }, [load]);
  const open = (item?: ShopProduct) => {
    setEditing(item || null); setName(item?.name || ''); setPrice(String(item?.price || 1)); setAction(item?.action || 'happy'); setFormError(''); setVisible(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    if (!/^[A-Za-z0-9\u4e00-\u9fff _.-]{1,12}$/u.test(name.trim()) || !/^\d+$/.test(price) || Number(price) < 1 || Number(price) > 10000) {
      setFormError('名称限 1–12 个汉字、英文或数字；价格限 1–10000 整数金币。'); return;
    }
    busyRef.current = true; setBusy(true); setFormError('');
    try {
      await familyApi(editing ? `/api/v1/family/shop/${editing.id}` : '/api/v1/family/shop', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ name: name.trim(), price: Number(price), action }) });
      setVisible(false); await load(); Toast.show({ content: '已保存，设备联网后自动更新菜单' });
    } catch (failure) {
      setFormError(failure instanceof FamilyApiError ? failure.message : '保存结果尚未确认，请刷新目录后检查');
      await load();
    } finally { busyRef.current = false; setBusy(false); }
  };
  const remove = async (item: ShopProduct) => {
    if (busyRef.current || !await Dialog.confirm({ content: `删除“${item.name}”？设备菜单也会移除这个商品，已消费记录会保留。`, confirmText: '删除' })) return;
    busyRef.current = true; setBusy(true);
    try { await familyApi(`/api/v1/family/shop/${item.id}`, { method: 'DELETE' }); await load(); Toast.show({ content: '商品已删除' }); }
    catch { await load(); Toast.show({ content: '请刷新目录确认删除结果' }); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <section className="space-y-3">
    <div className="flex justify-between items-center gap-2"><div><h3 className="text-h2">小宠商店 <span className="text-sm text-[#6B7280]">{items.length}/10</span></h3><p className="text-xs text-[#6B7280] mt-1">全家共用 · 点击小狗即可兑换</p></div><button type="button" className="kid-btn kid-btn-primary kid-btn-sm" disabled={loading || !!error || items.length >= 10 || busy} onClick={() => open()}>添加商品</button></div>
    <p className="text-xs leading-5 text-[#6B7280]">内置 Water 和 Food，最多再添加 8 个创意商品。抚摸、睡觉免费，不占商品名额。</p>
    {loading ? <p className="kid-card text-sm" role="status">正在加载商品…</p> : error ? <p className="kid-card text-sm" role="alert">{error}</p> : <div className="kid-list">{items.map(item => <div className="kid-list-row gap-2" key={item.id}><div className="min-w-0 flex-1"><p className="font-semibold text-sm break-words">{item.name} {item.builtin_key && <span className="text-xs font-normal text-[#6B7280]">内置</span>}</p><p className="text-xs text-[#6B7280] mt-1">{item.price} credit{item.price === 1 ? '' : 's'} · {actions.find(option => option.value === item.action)?.label || '互动'}</p></div><button type="button" className="kid-btn kid-btn-ghost kid-btn-sm shrink-0" disabled={busy} onClick={() => open(item)}>编辑</button>{!item.builtin_key && <button type="button" className="kid-btn kid-btn-ghost kid-btn-sm shrink-0" disabled={busy} onClick={() => remove(item)}>删除</button>}</div>)}</div>}
    <div className="flex justify-between items-center gap-2"><p className="text-xs text-[#6B7280]">{items.length >= 10 ? '已达 10 个商品，删除自定义商品后可继续添加。' : '名称和价格会同步到设备，购买成功后播放所选动画。'}</p><button type="button" className="kid-btn kid-btn-ghost kid-btn-sm shrink-0" disabled={busy} onClick={load}>刷新目录</button></div>
    <Popup visible={visible} onMaskClick={() => !busy && setVisible(false)} destroyOnClose bodyStyle={{ borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
      <form className="p-5 pb-8 space-y-3 max-w-xl mx-auto" onSubmit={save}>
        <h3 className="text-lg font-bold">{editing ? '编辑商品' : '添加创意商品'}</h3>
        <p className="text-sm text-[#6B7280]">和宝贝一起想一个名字，再为它选择价格和互动动画。</p>
        <label htmlFor="shop-name" className="block text-sm">商品名称</label><input id="shop-name" className="kid-input" required maxLength={12} value={name} disabled={busy || !!editing?.builtin_key} onChange={event => setName(event.target.value)} placeholder="例如：月亮饼干、快乐魔法" />
        <label htmlFor="shop-price" className="block text-sm">价格（credit）</label><input id="shop-price" className="kid-input" type="number" inputMode="numeric" min={1} max={10000} step={1} required value={price} disabled={busy} onChange={event => setPrice(event.target.value)} />
        <label htmlFor="shop-action" className="block text-sm">兑换后小狗的动作</label><select id="shop-action" className="kid-input" value={action} disabled={busy || !!editing?.builtin_key} onChange={event => setAction(event.target.value)}>{actions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        {editing?.builtin_key && <p className="text-xs text-[#6B7280]">内置商品保留名称和动作，可以调整价格。</p>}
        {formError && <p role="alert" className="text-sm text-[#B45309]">{formError}</p>}
        <div className="flex gap-2 pt-2"><button type="button" className="kid-btn kid-btn-ghost flex-1" disabled={busy} onClick={() => setVisible(false)}>取消</button><button type="submit" className="kid-btn kid-btn-primary flex-1" disabled={busy}>{busy ? '正在保存…' : '保存商品'}</button></div>
      </form>
    </Popup>
  </section>;
}
