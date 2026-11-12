import React from 'react';
import { Dialog, Toast } from 'antd-mobile';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const UpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r?: ServiceWorkerRegistration) {
      console.log('Service Worker registered successfully:', r);
    },
    onRegisterError(error: any) {
      console.error('Service Worker registration failed:', error);
    },
  });

  React.useEffect(() => {
    if (needRefresh) {
      Dialog.confirm({
        title: '发现新版本',
        content: '学习宠物助手有新功能发布，是否立即刷新更新？',
        confirmText: '立即更新',
        cancelText: '稍后',
        onConfirm: async () => {
          Toast.show({ icon: 'loading', content: '更新中...' });
          await updateServiceWorker(true);
        },
        onCancel: () => {
          setNeedRefresh(false);
        },
      });
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
};
