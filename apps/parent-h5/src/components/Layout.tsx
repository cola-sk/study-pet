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
      icon: <IconBolt className="w-5 h-5" />,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      key: 'tasks',
      title: '任务闯关',
      icon: <IconClipboard className="w-5 h-5" />,
    },
    {
      key: 'pet',
      title: '宠物乐园',
      icon: <IconCoin className="w-5 h-5" />,
    },
    {
      key: 'settings',
      title: '家庭设备',
      icon: <IconDevice className="w-5 h-5" />,
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

      {/* 6. KidLearn 紧凑顶栏导航 */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-b-2 border-[#E5E7EB] select-none">
        <div className="w-full max-w-xl mx-auto px-3.5 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#EF4444] text-white flex items-center justify-center shadow-[0_2px_0_#B91C1C] shrink-0">
              <IconPaw className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-[15px] font-headline font-bold text-[#1F2937] leading-tight">学习宠物助手</h1>
              <p className="text-[11px] font-semibold text-[#6B7280] leading-none mt-0.5">KidLearn 习惯养成乐园</p>
            </div>
          </div>

          <div className="kid-status-chip kid-status-active">
            <IconStar className="w-3.5 h-3.5 text-[#3B82F6]" />
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

      {/* 8. KidLearn 紧凑底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#FFFFFF] border-t-2 border-[#E5E7EB] shadow-kid-md select-none">
        <div className="max-w-xl mx-auto px-2.5 py-1.5 grid grid-cols-4 gap-1.5">
          {tabs.map(item => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`relative min-h-[46px] rounded-[14px] px-1.5 py-1 flex flex-col items-center justify-center gap-0.5 font-headline font-bold text-[11px] transition-all ${
                  isActive
                    ? 'bg-[#FEF3C7] text-[#EF4444] border-2 border-[#FACC15] shadow-[0_2px_0_#EAB308]'
                    : 'bg-transparent text-[#6B7280] border-2 border-transparent hover:bg-[#F3F4F6]'
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-2.5 bg-[#EF4444] text-white text-[10px] font-bold min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center border border-white">
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
