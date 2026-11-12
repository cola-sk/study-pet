'use client';

import React, { useEffect } from 'react';
import { Dialog } from 'antd-mobile';

export const UpdatePrompt: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(registration => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            Dialog.confirm({
              title: '发现新版本',
              content: '学习宠物助手有新功能发布，是否立即刷新应用？',
              confirmText: '立即更新',
              cancelText: '稍后',
              onConfirm: () => {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              },
            });
          }
        });
      });
    });
  }, []);

  return null;
};
