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
    <div className="install-banner px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="install-banner-icon shrink-0">
          <DownlandOutline />
        </span>
        <div className="min-w-0">
          <div className="install-banner-title">添加到手机主屏幕</div>
          <div className="install-banner-note">打开更方便，也支持离线使用</div>
        </div>
      </div>
      <Button
        size="mini"
        color="primary"
        fill="solid"
        onClick={handleInstall}
        className="install-banner-button !border-0 font-semibold !px-3"
      >
        添加
      </Button>
    </div>
  );
};
