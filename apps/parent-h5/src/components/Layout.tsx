'use client';

import React, { useEffect, useState } from 'react';
import { familyApi } from '../services/familyApi';
import { supabase } from '../services/supabase';
import { AccountPairingPanel } from './AccountPairingPanel';
import { SafeArea } from 'antd-mobile';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppStore } from '../stores/useAppStore';
import { OfflineNoticeBar } from './pwa/OfflineNoticeBar';
import { InstallBanner } from './pwa/InstallBanner';
import { IosInstallGuideModal } from './pwa/IosInstallGuideModal';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { IconPaw, IconBolt, IconClipboard, IconCoin, IconDevice } from './Icons';

import { ApprovalsPage } from '../views/Approvals';
import { TasksPage } from '../views/Tasks';
import { PetWalletPage } from '../views/PetWallet';
import { SettingsPage } from '../views/Settings';

export const Layout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('approvals');
  const [authState, setAuthState] = useState<'loading' | 'signed-in' | 'signed-out' | 'unconfigured'>('loading');
  const [userId, setUserId] = useState('');
  useEffect(() => {
    if (!supabase) { setAuthState('unconfigured'); return; }
    let alive = true;
    let authEventReceived = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true;
      if (alive) { setAuthState(session ? 'signed-in' : 'signed-out'); setUserId(session?.user.id || ''); }
    });
    supabase.auth.getSession().then(({ data: current, error }) => {
      if (alive && !authEventReceived) { setAuthState(!error && current.session ? 'signed-in' : 'signed-out'); setUserId(current.session?.user.id || ''); }
    }).catch(() => { if (alive && !authEventReceived) setAuthState('signed-out'); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  const installState = usePWAInstall();
  const { instances, taskError, loadTaskData } = useAppStore();
  const [bootstrapError, setBootstrapError] = useState('');
  useEffect(() => {
    useAppStore.getState().resetRemoteState();
    setBootstrapError('');
    if (!userId) return;
    let alive = true;
    let ready = false;
    const refresh = async () => {
      if (!alive || document.visibilityState === 'hidden') return;
      try {
        if (!ready) {
          await familyApi('/api/v1/family/bootstrap', { method: 'POST' });
          if (!alive) return;
          ready = true; setBootstrapError('');
        }
        await useAppStore.getState().loadTaskData();
      } catch (e) { if (alive) setBootstrapError(e instanceof Error ? e.message : '家庭加载失败'); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); useAppStore.getState().resetRemoteState(); };
  }, [userId]);

  const pendingApprovalsCount = instances.filter(i => i.status === 'submitted').length;

  const tabs = [
    {
      key: 'approvals',
      title: '打卡审批',
      icon: <IconBolt className="w-[18px] h-[18px]" />,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      key: 'tasks',
      title: '任务管理',
      icon: <IconClipboard className="w-[18px] h-[18px]" />,
    },
    {
      key: 'pet',
      title: '宝贝与小宠',
      icon: <IconCoin className="w-[18px] h-[18px]" />,
    },
    {
      key: 'settings',
      title: '家庭设备',
      icon: <IconDevice className="w-[18px] h-[18px]" />,
    },
  ];

  if (authState !== 'signed-in') {
    return (
      <main className="parent-app-shell min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-2">
            <div className="parent-app-mark flex items-center justify-center mx-auto"><IconPaw className="w-5 h-5" /></div>
            <h1 className="text-xl font-bold">学习宠物助手</h1>
            <p className="text-sm text-gray-600">登录或注册家长账号，管理孩子与桌面宠物。</p>
          </div>
          {authState === 'loading' ? <p className="text-center" role="status">正在检查登录状态…</p> :
            authState === 'unconfigured' ? <p className="kid-card text-sm" role="alert">登录服务尚未配置，请检查 Supabase 环境变量。</p> : <AccountPairingPanel />}
        </div>
      </main>
    );
  }

  return (
    <div className="parent-app-shell flex flex-col min-h-screen antialiased">
      <SafeArea position="top" />
      <OfflineNoticeBar />
      <InstallBanner installState={installState} />
      <IosInstallGuideModal installState={installState} />
      <UpdatePrompt />

      <header className="parent-app-header sticky top-0 z-40 select-none">
        <div className="parent-app-header-inner w-full max-w-xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="parent-app-mark flex items-center justify-center shrink-0">
              <IconPaw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="parent-app-title leading-none">学习宠物助手</h1>
              <div className="parent-app-subtitle">家庭成长空间</div>
            </div>
          </div>

          <span className="family-summary-chip">
            家庭空间
          </span>
        </div>
      </header>

      {(bootstrapError || taskError) && <div className="max-w-xl w-full mx-auto p-3 text-sm text-red-700" role="alert">
        {bootstrapError || taskError} <button onClick={() => { if (bootstrapError) window.location.reload(); else void loadTaskData(); }}>重试</button>
      </div>}
      {/* 主视图内容区 */}
      <main className="flex-1 overflow-x-hidden w-full max-w-xl mx-auto">
        {activeTab === 'approvals' && <ApprovalsPage />}
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'pet' && <PetWalletPage />}
        {activeTab === 'settings' && <SettingsPage installState={installState} onManageChildren={() => setActiveTab('pet')} />}
      </main>

      {/* 简洁底部导航栏 */}
      <nav className="parent-bottom-nav fixed bottom-0 left-0 right-0 z-50 select-none">
        <div className="max-w-xl mx-auto px-2 py-1 grid grid-cols-4">
          {tabs.map(item => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`parent-nav-item relative h-[50px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive ? 'is-active' : 'hover:text-[#4C5148]'
                }`}
              >
                <div className="parent-nav-item-icon relative">
                  {item.icon}
                  {item.badge !== undefined && (
                    <span className="parent-nav-badge absolute -top-1 -right-2.5 text-white text-[10px] font-bold min-w-[14px] h-[14px] px-1 rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="leading-none">{item.title}</span>
              </button>
            );
          })}
        </div>
        <SafeArea position="bottom" />
      </nav>
    </div>
  );
};
