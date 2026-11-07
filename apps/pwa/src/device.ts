import type { DeviceId, DeviceInfo } from '@mgc/core';
import type { DeviceSize } from '@mgc/layout';

/** localStorage: every Device id this browser has used, oldest first. */
const DEVICE_IDS_KEY = 'mgc.deviceIds';
/** sessionStorage: the id this tab holds; survives a reload of the tab. */
const TAB_DEVICE_ID_KEY = 'mgc.deviceId';
/** How long a reloaded tab waits for the lock its previous page may still hold. */
const RELOAD_GRACE_MS = 1500;

function storedIds(): string[] {
  const parsed: unknown = JSON.parse(localStorage.getItem(DEVICE_IDS_KEY) ?? '[]');
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
}

/** Takes the Web Lock on `id` for the life of the page, waiting up to `waitMs` for it; resolves whether it was taken. */
function hold(id: string, waitMs = 0): Promise<boolean> {
  return new Promise((resolve) => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), waitMs);
    const options: LockOptions = waitMs > 0 ? { signal: abort.signal } : { ifAvailable: true };
    navigator.locks
      .request(`mgc.device:${id}`, options, (lock) => {
        clearTimeout(timer);
        resolve(lock !== null);
        return lock ? new Promise<never>(() => undefined) : undefined;
      })
      .catch(() => resolve(false)); // timed out: another live tab holds it
  });
}

function remember(id: DeviceId): DeviceId {
  const ids = storedIds();
  if (!ids.includes(id)) localStorage.setItem(DEVICE_IDS_KEY, JSON.stringify([...ids, id]));
  sessionStorage.setItem(TAB_DEVICE_ID_KEY, id);
  return id;
}

/**
 * The persisted Device id of this tab. A phone runs one tab, so it always gets
 * the browser's first id and keeps it across reloads and restarts. Several tabs
 * of one browser (the desktop smoke run) must not share an id: each tab holds a
 * Web Lock on its id, a reloaded tab takes back its own (sessionStorage), and
 * any other tab takes the first free one, minting a new id when all are held.
 */
export async function claimDeviceId(): Promise<DeviceId> {
  const own = sessionStorage.getItem(TAB_DEVICE_ID_KEY);
  if (!('locks' in navigator)) return remember(own ?? storedIds()[0] ?? crypto.randomUUID());
  // A duplicated tab copied `own` too, but never gets its lock.
  if (own !== null && (await hold(own, RELOAD_GRACE_MS))) return remember(own);
  for (const id of storedIds()) if (id !== own && (await hold(id))) return remember(id);
  const id = crypto.randomUUID();
  await hold(id);
  return remember(id);
}

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

/** Visible area in CSS px; `visualViewport` excludes browser toolbars where `innerHeight` may not. */
export function deviceInfo(deviceId: DeviceId): DeviceInfo {
  const ua = navigator as Navigator & { userAgentData?: { platform?: string } };
  const vv = window.visualViewport;
  return {
    deviceId,
    name: ua.userAgentData?.platform ?? navigator.platform,
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    pxPerMm: guessPxPerMm(),
  };
}

export function deviceSize(info: DeviceInfo): DeviceSize {
  return { id: info.deviceId, w: info.width / info.pxPerMm, h: info.height / info.pxPerMm };
}
