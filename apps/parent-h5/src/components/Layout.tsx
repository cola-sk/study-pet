'use client';

import React, { useState } from 'react';
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
  const installState = usePWAInstall();
  const { instances, children, devices } = useAppStore();

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
      title: '宠物金币',
      icon: <IconCoin className="w-[18px] h-[18px]" />,
    },
    {
      key: 'settings',
      title: '家庭设备',
      icon: <IconDevice className="w-[18px] h-[18px]" />,
    },
  ];

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
            {children.length}个宝贝 · {devices.length}台设备
          </span>
        </div>
      </header>

      {/* 主视图内容区 */}
      <main className="flex-1 overflow-x-hidden w-full max-w-xl mx-auto">
        {activeTab === 'approvals' && <ApprovalsPage />}
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'pet' && <PetWalletPage />}
        {activeTab === 'settings' && <SettingsPage installState={installState} />}
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
