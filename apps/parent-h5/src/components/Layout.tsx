'use client';

import React, { useState } from 'react';
import { SafeArea } from 'antd-mobile';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppStore } from '../stores/useAppStore';
import { OfflineNoticeBar } from './pwa/OfflineNoticeBar';
import { InstallBanner } from './pwa/InstallBanner';
import { IosInstallGuideModal } from './pwa/IosInstallGuideModal';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { IconPaw, IconStar, IconBolt, IconClipboard, IconCoin, IconDevice } from './Icons';

import { ApprovalsPage } from '../views/Approvals';
import { TasksPage } from '../views/Tasks';
import { PetWalletPage } from '../views/PetWallet';
import { SettingsPage } from '../views/Settings';

export const Layout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('approvals');
  const installState = usePWAInstall();
  const { instances, children, devices } = useAppStore();

  // 待审批的任务数量
  const pendingApprovalsCount = instances.filter(i => i.status === 'submitted').length;

  const tabs = [
    {
      key: 'approvals',
      title: '打卡奖励',
      icon: <IconBolt className="w-6 h-6" />,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      key: 'tasks',
      title: '任务闯关',
      icon: <IconClipboard className="w-6 h-6" />,
    },
    {
      key: 'pet',
      title: '宠物乐园',
      icon: <IconCoin className="w-6 h-6" />,
    },
    {
      key: 'settings',
      title: '家庭设备',
      icon: <IconDevice className="w-6 h-6" />,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FFFFFF] text-[#1F2937] antialiased">
      {/* 1. iPhone 刘海屏 / 灵动岛顶部安全区适配 */}
      <SafeArea position="top" />

      {/* 2. 离线警告条（断网时自动展现） */}
      <OfflineNoticeBar />

      {/* 3. Android / Chrome 手机主屏幕安装引导条 */}
      <InstallBanner installState={installState} />

      {/* 4. iOS Safari 底部添加主屏幕手势引导弹窗 */}
      <IosInstallGuideModal installState={installState} />

      {/* 5. Service Worker 版本更新提示 */}
      <UpdatePrompt />

      {/* 6. KidLearn 顶栏导航 */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-b-2 border-[#E5E7EB] select-none">
        <div className="w-full max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#EF4444] text-white flex items-center justify-center shadow-[0_3px_0_#B91C1C] shrink-0">
              <IconPaw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-h3 text-[#1F2937] leading-tight">学习宠物助手</h1>
              <p className="text-caption text-[#6B7280] leading-none mt-0.5">KidLearn 习惯养成乐园</p>
            </div>
          </div>

          <div className="kid-status-chip kid-status-active">
            <IconStar className="w-4 h-4 text-[#3B82F6]" />
            <span>{children.length} 宝贝 · {devices.length} 设备</span>
          </div>
        </div>
      </header>

      {/* 7. 主视图内容区 */}
      <main className="flex-1 overflow-x-hidden w-full max-w-xl mx-auto">
        {activeTab === 'approvals' && <ApprovalsPage />}
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'pet' && <PetWalletPage />}
        {activeTab === 'settings' && <SettingsPage installState={installState} />}
      </main>

      {/* 8. KidLearn 底部大触控导航栏 (>=48px 触控高度 + 图标文字配对) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF] border-t-2 border-[#E5E7EB] shadow-kid-md select-none">
        <div className="max-w-xl mx-auto px-3 py-2 grid grid-cols-4 gap-2">
          {tabs.map(item => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`relative min-h-[56px] rounded-[20px] px-2 py-1.5 flex flex-col items-center justify-center gap-1 font-headline font-bold text-caption transition-all ${
                  isActive
                    ? 'bg-[#FEF3C7] text-[#EF4444] border-2 border-[#FACC15] shadow-[0_3px_0_#EAB308] -translate-y-0.5'
                    : 'bg-transparent text-[#6B7280] border-2 border-transparent hover:bg-[#F3F4F6]'
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-3 bg-[#EF4444] text-white text-[12px] font-bold min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center border-2 border-white">
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
