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
    <div className="flex flex-col min-h-screen bg-[#F6F7F9] text-[#1F2937] antialiased">
      <SafeArea position="top" />
      <OfflineNoticeBar />
      <InstallBanner installState={installState} />
      <IosInstallGuideModal installState={installState} />
      <UpdatePrompt />

      {/* 极简一行顶栏 */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E5E7EB] select-none">
        <div className="w-full max-w-xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center shrink-0">
              <IconPaw className="w-3.5 h-3.5" />
            </div>
            <h1 className="text-[15px] font-headline font-bold text-[#1F2937] leading-none">
              学习宠物助手
            </h1>
          </div>

          <span className="kid-status-chip kid-status-active">
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF] border-t border-[#E5E7EB] select-none">
        <div className="max-w-xl mx-auto px-2 py-1 grid grid-cols-4">
          {tabs.map(item => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`relative h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-[#EF4444]' : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-2.5 bg-[#EF4444] text-white text-[10px] font-bold min-w-[14px] h-[14px] px-1 rounded-full flex items-center justify-center">
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
