/**
 * 触觉反馈工具
 * 在移动设备上调用 navigator.vibrate() 产生微弱震动感
 * 桌面端自动跳过（无 Vibration API）
 */

type HapticPattern = 'light' | 'medium' | 'strong' | 'success' | 'error' | 'warning';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 8,           // 微弱：8ms 轻触
  medium: 15,         // 中等：15ms 点击
  strong: 25,          // 强烈：25ms 长按
  success: [10, 20, 10],  // 成功：短-停-短
  error: [30, 40, 30, 40, 60], // 错误：长-停-长-停-更长
  warning: [20, 30, 20],  // 警告：中-停-中
};

// 检测是否为移动设备（支持触屏）
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)
  );
};

// 检测是否在移动端预览模式
const isInMobilePreview = (): boolean => {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('.mobile-preview-container');
};

/**
 * 触发触觉反馈
 * @param pattern 反馈模式，默认 'light'
 */
export function haptic(pattern: HapticPattern = 'light'): void {
  // 仅在支持 Vibration API 的设备上触发
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

  // 移动端预览模式下也触发（开发调试用）
  const shouldVibrate = isMobileDevice() || isInMobilePreview();
  if (!shouldVibrate) return;

  try {
    navigator.vibrate(patterns[pattern]);
  } catch {
    // 静默失败，不影响功能
  }
}

/**
 * React 事件处理器包装器
 * 在执行 onClick 前先触发触觉反馈
 * @param handler 原始事件处理函数
 * @param pattern 触觉模式
 */
export function withHaptic<T extends (...args: any[]) => any>(
  handler: T,
  pattern: HapticPattern = 'light'
): T {
  return ((...args: any[]) => {
    haptic(pattern);
    return handler(...args);
  }) as T;
}

/**
 * useHaptic Hook - 在组件中使用
 * @returns { tap, press, success, error, warning } 各种反馈方法
 */
export function useHaptic() {
  return {
    tap: () => haptic('light'),
    press: () => haptic('medium'),
    longPress: () => haptic('strong'),
    success: () => haptic('success'),
    error: () => haptic('error'),
    warning: () => haptic('warning'),
  };
}
