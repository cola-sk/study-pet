'use client';

import React, { useState } from 'react';
import { SafeArea, TabBar } from 'antd-mobile';
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
import { IconPaw, IconDevice } from './Icons';

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
      title: '工作台',
      icon: <BellOutline />,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    {
      key: 'tasks',
      title: '任务库',
      icon: <UnorderedListOutline />,
    },
    {
      key: 'pet',
      title: '宠物资产',
      icon: <SmileOutline />,
    },
    {
      key: 'settings',
      title: '终端设置',
      icon: <SetOutline />,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9] text-slate-900 antialiased">
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

      {/* 6. 顶栏导航 (结构化专业左对齐顶栏) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 select-none">
        <div className="w-full max-w-xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <IconPaw className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-[15px] tracking-tight text-slate-900">StudyPet</span>
              <span className="text-xs font-medium text-slate-400">家长端控制台</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
              <IconDevice className="w-3.5 h-3.5 text-slate-500" />
              <span>{children.length} 成员</span>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {devices.length} 在线
              </span>
            </div>
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

      {/* 8. 底部导航栏与 iPhone 虚拟条底部安全区适配 */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 select-none">
        <div className="max-w-xl mx-auto">
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
        </div>
        <SafeArea position="bottom" />
      </nav>
    </div>
  );
};
