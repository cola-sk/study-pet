import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PWAInstallState {
  isStandalone: boolean;
  isInstallable: boolean;
  isIosSafari: boolean;
  isDismissed: boolean;
  triggerInstall: () => Promise<boolean>;
  dismissGuide: () => void;
}

const DISMISS_KEY = 'study_pet_pwa_dismiss_until';

export const usePWAInstall = (): PWAInstallState => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. 检查是否在近期点击过“稍后提醒”
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setIsDismissed(true);
    }

    // 2. 检测是否已经处于独立 App (Standalone) 模式
    const checkStandalone = () => {
      const matchDisplay = window.matchMedia('(display-mode: standalone)').matches;
      const navStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      return matchDisplay || navStandalone;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);

    // 3. 检测是否为 iOS Safari (且未安装)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes('safari') && !ua.includes('crios') && !ua.includes('fxios');
    setIsIosSafari(isIos && isSafari && !standalone);

    // 4. 监听 Android / 现代浏览器的 beforeinstallprompt 事件
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    const accepted = choice.outcome === 'accepted';
    if (accepted) {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
    return accepted;
  }, [deferredPrompt]);

  const dismissGuide = useCallback(() => {
    setIsDismissed(true);
    // 7 天内不再自动弹窗打扰
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  }, []);

  return {
    isStandalone,
    isInstallable,
    isIosSafari,
    isDismissed,
    triggerInstall,
    dismissGuide,
  };
};
