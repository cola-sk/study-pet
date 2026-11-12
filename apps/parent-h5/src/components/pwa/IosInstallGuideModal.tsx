'use client';

import React from 'react';
import { Popup, Button } from 'antd-mobile';
import { PWAInstallState } from '../../hooks/usePWAInstall';

interface Props {
  installState: PWAInstallState;
}

export const IosInstallGuideModal: React.FC<Props> = ({ installState }) => {
  const { isIosSafari, isStandalone, isDismissed, dismissGuide } = installState;

  // 仅对未安装的 iOS Safari 且未点过暂不提醒的用户弹出
  const visible = isIosSafari && !isStandalone && !isDismissed;

  return (
    <Popup
      visible={visible}
      onMaskClick={dismissGuide}
      position="bottom"
      bodyStyle={{
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        padding: '20px 16px 28px',
        background: '#ffffff',
      }}
    >
      <div className="flex flex-col items-center text-center">
        {/* App Icon preview */}
        <div className="w-14 h-14 rounded-2xl bg-[#EF4444] shadow-sm flex items-center justify-center text-2xl mb-3 text-white">
          🐾
        </div>
        
        <h3 className="text-base font-bold text-gray-800 mb-1">
          将“学习宠物”添加到主屏幕
        </h3>
        <p className="text-xs text-gray-500 mb-4 max-w-xs">
          安装后即可在手机桌面像原生 App 一样直接启动，全屏无地址栏，随时查看任务！
        </p>

        {/* 2 步图文指引 */}
        <div className="w-full bg-zinc-50 rounded-xl p-3.5 text-left space-y-2.5 mb-4 border border-zinc-200">
          <div className="flex items-center space-x-3 text-xs text-gray-700">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold text-xs">
              1
            </span>
            <span>
              点击 Safari 浏览器底部的 <strong className="text-zinc-900">分享按钮 ⎋</strong>
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-gray-700">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold text-xs">
              2
            </span>
            <span>
              在弹出菜单中向下滑动，选择 <strong className="text-zinc-900">“添加到主屏幕 ⊞”</strong>
            </span>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="w-full flex space-x-3">
          <Button
            block
            fill="none"
            size="middle"
            onClick={dismissGuide}
            className="!text-gray-400"
          >
            稍后再说
          </Button>
          <Button
            block
            color="primary"
            size="middle"
            onClick={dismissGuide}
            className="!rounded-lg"
          >
            我知道了
          </Button>
        </div>
      </div>
    </Popup>
  );
};
