'use client';

import React from 'react';
import { Button, Toast } from 'antd-mobile';
import { DownlandOutline } from 'antd-mobile-icons';
import { PWAInstallState } from '../../hooks/usePWAInstall';

interface Props {
  installState: PWAInstallState;
}

export const InstallBanner: React.FC<Props> = ({ installState }) => {
  const { isStandalone, isInstallable, triggerInstall } = installState;

  // 如果已经是在桌面 App 全屏模式，或者不支持/已安装，则不显示
  if (isStandalone || !isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    const success = await triggerInstall();
    if (success) {
      Toast.show({
        icon: 'success',
        content: '安装指令已提交，请查看手机桌面图标！',
      });
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-2 flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-2">
        <span className="text-xl">📱</span>
        <div className="text-xs">
          <div className="font-semibold">安装到手机主屏幕</div>
          <div className="text-blue-100 text-[11px]">全屏无浏览器地址栏，离线秒开</div>
        </div>
      </div>
      <Button
        size="mini"
        color="primary"
        fill="solid"
        onClick={handleInstall}
        className="!bg-white !text-blue-600 !border-0 font-medium !px-3 shadow-sm"
      >
        <span className="flex items-center gap-1">
          <DownlandOutline /> 安装
        </span>
      </Button>
    </div>
  );
};
