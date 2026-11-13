'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Toast } from 'antd-mobile';
import { PWAInstallState } from '../../hooks/usePWAInstall';
import { IconDevice, IconPlus } from '../../components/Icons';
import { supabase } from '../../services/supabase';
import { familyApi, FamilyChild, FamilyDevice } from '../../services/familyApi';
import { PairingWizard } from './PairingWizard';

interface Props { installState: PWAInstallState; onManageChildren: () => void }

export const SettingsPage: React.FC<Props> = ({ installState, onManageChildren }) => {
  const [wizardVisible, setWizardVisible] = useState(false);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [devices, setDevices] = useState<FamilyDevice[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      await familyApi('/api/v1/family/bootstrap', { method: 'POST' });
      const [childResult, deviceResult] = await Promise.all([
        familyApi<{ children: FamilyChild[] }>('/api/v1/family/children'),
        familyApi<{ devices: FamilyDevice[] }>('/api/v1/devices'),
      ]);
      setChildren(childResult.children); setDevices(deviceResult.devices);
    } catch { setError('无法加载家庭和设备信息，请检查网络后重试。'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    supabase?.auth.getSession().then(({ data }) => { if (active) setEmail(data.session?.user.email || ''); });
    void refresh();
    return () => { active = false; };
  }, [refresh]);

  return (
    <div className="px-3 py-2.5 space-y-4 pb-20 text-[#1F2937]">
      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-h2">桌面设备</h2>
          <button type="button" onClick={() => setWizardVisible(true)} className="kid-btn kid-btn-primary kid-btn-sm">
            <IconPlus className="w-3 h-3" /><span>添加设备</span>
          </button>
        </div>
        {loading ? <p className="kid-card text-sm text-[#6B7280]" role="status">正在加载设备…</p> : error ?
          <div className="kid-card space-y-2"><p role="alert" className="text-sm">{error}</p><button type="button" className="kid-btn kid-btn-ghost kid-btn-sm" onClick={refresh}>重试</button></div> :
          devices.length === 0 ? <div className="kid-card text-center py-6 text-sm text-[#6B7280]">还没有设备，点击“添加设备”开始配对。</div> :
          <div className="kid-list">{devices.map(device => {
            const child = children.find(item => item.id === device.child_id);
            return <div key={device.id} className="kid-list-row"><div className="flex items-center gap-3 min-w-0"><IconDevice className="w-5 h-5 shrink-0" /><div><div className="font-semibold text-sm">{device.alias}</div><div className="text-xs text-[#6B7280]">{child ? `属于 ${child.nickname}` : '等待选择孩子'} · 编号尾号 {device.id.slice(-6)}</div></div></div>{!device.child_id && <button type="button" className="kid-btn kid-btn-ghost kid-btn-sm" onClick={() => setWizardVisible(true)}>继续绑定</button>}</div>;
          })}</div>}
      </section>
      <button type="button" className="kid-card w-full text-left flex items-center justify-between gap-3" onClick={onManageChildren}><div><h2 className="text-h2">宝贝与小宠</h2><p className="text-xs text-[#6B7280] mt-1">在同一页面管理宝贝、专属小二哈与奖励金币</p></div><span className="text-sm shrink-0">去管理 →</span></button>
      <section className="space-y-2"><h2 className="text-h2 px-0.5">账号与设置</h2><div className="kid-list">
        <div className="kid-list-row"><div><div className="font-semibold text-sm">家长账号</div><div className="text-xs text-[#6B7280] break-all">{email}</div></div><button type="button" className="kid-btn kid-btn-ghost kid-btn-sm" onClick={() => supabase?.auth.signOut()}>退出登录</button></div>
        <div className="kid-list-row"><div><div className="font-semibold text-sm">添加到手机主屏幕</div><div className="text-xs text-[#6B7280]">支持全屏快捷打开</div></div>{installState.isStandalone ? <span className="kid-status-chip kid-status-complete">已安装</span> : <button type="button" className="kid-btn kid-btn-ghost kid-btn-sm" onClick={async () => { if (installState.isInstallable) await installState.triggerInstall(); else Toast.show({ content: '请在浏览器菜单中点击「添加到主屏幕」' }); }}>安装</button>}</div>
      </div></section>
      <PairingWizard visible={wizardVisible} onClose={() => setWizardVisible(false)} onComplete={() => { void refresh(); }} />
    </div>
  );
};
