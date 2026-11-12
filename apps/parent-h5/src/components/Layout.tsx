'use client';

import React, { useState } from 'react';
import { SafeArea, NavBar, TabBar } from 'antd-mobile';
import {
  BellOutline,
  UnorderedListOutline,
  SmileOutline,
  SetOutline,
} from 'antd-mobile-icons';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useAppStore } from '../stores/useAppStore';
import { OfflineNoticeBar } from './pwa/OfflineNoticeBar';
import { InstallBanner } from './pwa/InstallBanner';
import { IosInstallGuideModal } from './pwa/IosInstallGuideModal';
import { UpdatePrompt } from './pwa/UpdatePrompt';

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
      title: '审批大厅',
      icon: <BellOutline />,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      key: 'tasks',
      title: '任务管理',
      icon: <UnorderedListOutline />,
    },
    {
      key: 'pet',
      title: '宠物金币',
      icon: <SmileOutline />,
    },
    {
      key: 'settings',
      title: '我的与设备',
      icon: <SetOutline />,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-gray-800 antialiased select-none">
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

      {/* 6. 顶栏导航 */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
        <NavBar backArrow={false} className="font-bold text-gray-800">
          <div className="flex items-center space-x-1.5 justify-center">
            <span>🐾</span>
            <span className="font-extrabold text-base tracking-tight">学习宠物助手</span>
            <span className="text-[11px] font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              {children.length}个孩子 · {devices.length}台设备
            </span>
          </div>
        </NavBar>
      </div>

      {/* 7. 主视图内容区 */}
      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'approvals' && <ApprovalsPage />}
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'pet' && <PetWalletPage />}
        {activeTab === 'settings' && <SettingsPage installState={installState} />}
      </main>

      {/* 8. 底部导航栏与 iPhone 虚拟条底部安全区适配 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-100 shadow-lg">
        <TabBar
          activeKey={activeTab}
          onChange={setActiveTab}
          className="h-[52px]"
        >
          {tabs.map(item => (
            <TabBar.Item
              key={item.key}
              icon={item.icon}
              title={item.title}
              badge={item.badge}
            />
          ))}
        </TabBar>
        <SafeArea position="bottom" />
      </div>
    </div>
  );
};
