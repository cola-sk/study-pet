'use client';

import React from 'react';
import { NoticeBar } from 'antd-mobile';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const OfflineNoticeBar: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <NoticeBar
      color="alert"
      content="当前处于离线模式，正在展示本地缓存数据；审批与修改需联网与设备同步。"
      closeable={false}
      style={{ fontSize: 13 }}
    />
  );
};
