// 移动端轻量触觉震动反馈 (Haptic Feedback)

export const triggerHaptic = (pattern: number | number[] = 15) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration error in unsupported environments
    }
  }
};
