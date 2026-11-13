'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Popup } from 'antd-mobile';
import { familyApi, FamilyChild, FamilyDevice } from '../../services/familyApi';

type Props = { visible: boolean; onClose: () => void; onComplete: () => void };

export function PairingWizard({ visible, onClose, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState('');
  const [devices, setDevices] = useState<FamilyDevice[]>([]);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [childId, setChildId] = useState('');
  const [nickname, setNickname] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completeName, setCompleteName] = useState('');

  const loadCode = useCallback(async () => {
    setBusy(true); setError('');
    try {
      await familyApi('/api/v1/family/bootstrap', { method: 'POST' });
      const result = await familyApi<{ code: string }>('/api/v1/pairing/code');
      if (!/^\d{6}$/.test(result.code)) throw new Error('invalid code');
      setCode(result.code);
    } catch { setError('配对码暂时无法获取，请检查网络后重试。'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setStep(1); setCode(''); setDevices([]); setChildren([]); setDeviceId('');
    setChildId(''); setNickname(''); setChecked(false); setError(''); setCompleteName('');
    void loadCode();
  }, [visible, loadCode]);

  const findDevices = async () => {
    setBusy(true); setError('');
    try {
      const result = await familyApi<{ devices: FamilyDevice[] }>('/api/v1/devices');
      setDevices(result.devices.filter(device => !device.child_id)); setChecked(true);
      setDeviceId('');
    } catch { setError('查找设备失败，请检查网络后重试。'); }
    finally { setBusy(false); }
  };
  const chooseDevice = async () => {
    if (!deviceId) return;
    setBusy(true); setError('');
    try {
      const result = await familyApi<{ children: FamilyChild[] }>('/api/v1/family/children');
      setChildren(result.children); setChildId(result.children.length === 1 ? result.children[0].id : ''); setStep(3);
    } catch { setError('无法获取孩子档案，请重试。'); }
    finally { setBusy(false); }
  };
  const createChild = async () => {
    const name = nickname.trim();
    if (!name || name.length > 50) { setError('请输入不超过 50 个字符的孩子昵称。'); return; }
    setBusy(true); setError('');
    try {
      const result = await familyApi<{ child: FamilyChild }>('/api/v1/family/children', { method: 'POST', body: JSON.stringify({ nickname: name }) });
      setChildren(current => [...current, result.child]); setChildId(result.child.id); setNickname('');
    } catch { setError('添加孩子失败，请检查网络后重试。'); }
    finally { setBusy(false); }
  };
  const assign = async () => {
    if (!deviceId || !childId) return;
    setBusy(true); setError('');
    try {
      await familyApi(`/api/v1/devices/${deviceId}/child`, { method: 'PATCH', body: JSON.stringify({ childId }) });
      setCompleteName(children.find(child => child.id === childId)?.nickname || '孩子');
      setStep(4);
    } catch { setError('绑定失败，请检查网络后重试。'); }
    finally { setBusy(false); }
  };
  const finish = () => { onComplete(); onClose(); };
  return (
    <Popup visible={visible} position="right" destroyOnClose bodyStyle={{ width: '100%', maxWidth: 560, height: '100%', background: '#F8F9F5' }}>
      <div className="flex h-full flex-col text-[#1F2937]">
        <header className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-4">
          <button type="button" className="kid-btn kid-btn-ghost kid-btn-sm" disabled={busy} onClick={step === 4 ? finish : onClose}>关闭</button>
          <h2 className="font-bold">添加设备</h2><span className="w-12" />
        </header>
        <main className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {step < 4 && <p className="text-sm text-[#6B7280]">第 {step} 步，共 3 步</p>}
          {step === 1 && <>
            <h3 className="text-xl font-bold">查看家庭配对码</h3>
            <p className="text-sm leading-6 text-[#6B7280]">这个码属于你的家庭。下一步需要在桌面设备上输入，不要分享给其他人。</p>
            <div className="kid-card py-7 text-center"><div className="text-sm text-[#6B7280]">家庭配对码</div><div className="mt-3 font-mono text-3xl font-bold tracking-[0.2em] select-all" aria-label="家庭配对码">{code || (busy ? '获取中…' : '暂不可用')}</div></div>
            {!code && !busy && <button type="button" className="kid-btn kid-btn-ghost" onClick={loadCode}>重新获取</button>}
            <button type="button" className="kid-btn kid-btn-primary w-full" disabled={!code || busy} onClick={() => { setError(''); setStep(2); }}>下一步：去设备输入</button>
          </>}
          {step === 2 && <>
            <h3 className="text-xl font-bold">在设备上输入配对码</h3>
            <div className="kid-card space-y-3 text-sm leading-6"><p>1. 保持设备开机并连接 Wi-Fi。</p><p>2. 在设备屏幕右下角点击 <strong>Pair</strong>。</p><p>3. 输入 <strong className="font-mono tracking-wider">{code}</strong>，点击键盘上的确认键。</p><p>4. 设备提示选择孩子后，回到这里查找设备。</p></div>
            <button type="button" className="kid-btn kid-btn-primary w-full" disabled={busy} onClick={findDevices}>{busy ? '正在查找…' : '我已输入，查找设备'}</button>
            {checked && devices.length === 0 && <p role="status" className="text-sm text-[#6B7280]">还没有找到待分配的设备。请确认设备已提交配对码并联网，然后再查找；已分配孩子的设备会显示在设备列表中。</p>}
            {devices.length > 0 && <fieldset className="kid-card space-y-3"><legend className="font-semibold">选择刚才配对的设备</legend>{devices.map(device => <label key={device.id} className="flex items-center gap-3 py-2"><input type="radio" name="pair-device" checked={deviceId === device.id} onChange={() => setDeviceId(device.id)} /><span>{device.alias} <span className="text-xs text-[#6B7280]">（编号尾号 {device.id.slice(-6)}）</span></span></label>)}</fieldset>}
            {devices.length > 0 && <button type="button" className="kid-btn kid-btn-primary w-full" disabled={!deviceId || busy} onClick={chooseDevice}>下一步：选择孩子</button>}
            <button type="button" className="kid-btn kid-btn-ghost" disabled={busy} onClick={() => { setError(''); setStep(1); }}>上一步</button>
          </>}
          {step === 3 && <>
            <h3 className="text-xl font-bold">这台设备属于谁？</h3>
            <p className="text-sm leading-6 text-[#6B7280]">选择已有的孩子；如果还没有档案，可以先在这里添加，再完成绑定。</p>
            {children.length > 0 && <fieldset className="kid-card space-y-2"><legend className="font-semibold">选择孩子</legend>{children.map(child => <label key={child.id} className="flex items-center gap-3 py-2"><input type="radio" name="pair-child" checked={childId === child.id} onChange={() => setChildId(child.id)} /><span>{child.nickname}</span></label>)}</fieldset>}
            <div className="kid-card space-y-2"><label htmlFor="pair-child-name" className="block text-sm font-semibold">添加孩子档案</label><div className="flex gap-2"><input id="pair-child-name" className="kid-input min-w-0" maxLength={50} value={nickname} onChange={event => setNickname(event.target.value)} placeholder="输入孩子昵称" /><button type="button" className="kid-btn kid-btn-secondary shrink-0" disabled={busy || !nickname.trim()} onClick={createChild}>添加</button></div><p className="text-xs text-[#6B7280]">添加后会自动选中；还需点击“完成绑定”。</p></div>
            <button type="button" className="kid-btn kid-btn-primary w-full" disabled={!childId || busy} onClick={assign}>{busy ? '正在绑定…' : '完成绑定'}</button>
            <button type="button" className="kid-btn kid-btn-ghost" disabled={busy} onClick={() => { setError(''); setStep(2); }}>上一步</button>
          </>}
          {step === 4 && <div className="kid-card py-8 text-center space-y-4" role="status"><div className="text-3xl">✓</div><h3 className="text-xl font-bold">设备绑定成功</h3><p className="text-sm text-[#6B7280]">设备已分配给 {completeName}。设备上的积分将在下一次同步时更新。</p><button type="button" className="kid-btn kid-btn-primary w-full" onClick={finish}>完成</button></div>}
          {error && <p className="text-sm text-[#B45309]" role="alert">{error}</p>}
        </main>
      </div>
    </Popup>
  );
}
