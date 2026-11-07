import type { DeviceInfo, PeerId } from '@mgc/core';
import type { DeviceSize } from '@mgc/layout';

/**
 * CSS px per mm. Browsers expose no physical DPI, so this is a platform
 * heuristic: Android dp = 1/160 in; iPhone points ≈ 150–165 ppi; iPad ≈ 132 ppi;
 * desktop CSS reference pixel = 96 dpi. Replaced by calibration in a later milestone.
 */
export function guessPxPerMm(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints): number {
  if (/Android/i.test(ua)) return 6.3;
  if (/iPhone|iPod/i.test(ua)) return 6.1;
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return 5.2;
  return 3.78;
}

export function deviceInfo(): DeviceInfo {
  const ua = navigator as Navigator & { userAgentData?: { platform?: string } };
  return {
    name: ua.userAgentData?.platform ?? navigator.platform,
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    pxPerMm: guessPxPerMm(),
  };
}

export function deviceSize(id: PeerId, info: DeviceInfo): DeviceSize {
  return { id, w: info.width / info.pxPerMm, h: info.height / info.pxPerMm };
}
