import type { DeviceId, DeviceInfo } from '@mgc/core';
import type { PlayerId } from '@mgc/sdk';

/** localStorage: every Device id this browser has used, oldest first. */
const DEVICE_IDS_KEY = 'mgc.deviceIds';
/** sessionStorage: the id this tab holds; survives a reload of the tab. */
const TAB_DEVICE_ID_KEY = 'mgc.deviceId';
/** localStorage: the Player id seated at each Device id this browser has used. */
const PLAYER_IDS_KEY = 'mgc.playerIds';
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
 * The persisted id of the Player who sits at Device `deviceId`: platform-issued
 * once per Device id, kept across reloads and restarts.
 */
export function claimPlayerId(deviceId: DeviceId): PlayerId {
  const parsed: unknown = JSON.parse(localStorage.getItem(PLAYER_IDS_KEY) ?? '{}');
  const ids: Record<DeviceId, unknown> = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<DeviceId, unknown>) : {};
  const known = ids[deviceId];
  if (typeof known === 'string') return known;
  const id = crypto.randomUUID();
  localStorage.setItem(PLAYER_IDS_KEY, JSON.stringify({ ...ids, [deviceId]: id }));
  return id;
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

/** The zoom levels browsers offer (Safari's Aa menu, Chrome's page zoom), as CSS px per CSS px at 100 %. */
const ZOOM_STEPS = [2, 1.75, 1.5, 1.333, 1.25, 1.176, 1.111, 1, 0.909, 0.87, 0.8, 0.75, 0.667, 0.571, 0.5];

/**
 * How many CSS px the page lays out per CSS px at 100 %: Safari's Page Zoom
 * (Aa menu) changes the viewport's CSS width while `screen.width` stays at
 * 100 %, so 75 % page zoom gives 1.333 (520 px across a 390 px screen) and the
 * same millimetre holds 1.333× the px. Portrait sides on both (iOS reports the
 * screen in portrait whatever the orientation). Only a ratio within 1.5 % of a
 * zoom step counts: a window that is not the screen (a desktop, an emulated
 * phone) gives some other ratio and is taken as 1.
 */
export function pageZoom(win: Pick<Window, 'innerWidth' | 'innerHeight' | 'screen'> = window): number {
  const viewport = Math.min(win.innerWidth, win.innerHeight);
  const screenPx = Math.min(win.screen.width, win.screen.height);
  if (!(viewport > 0) || !(screenPx > 0)) return 1;
  const ratio = viewport / screenPx;
  return ZOOM_STEPS.find((z) => Math.abs(ratio / z - 1) < 0.015) ?? 1;
}

/**
 * Resolves once the viewport has stopped changing: `quietMs` without a `resize`, or `maxMs` at most.
 * iOS Safari applies a site's Page Zoom some tens of ms after the page's scripts start (live run 5: 390 px
 * across at load, 520 px 33 ms later), so a size taken at load can be the one before the zoom, and the
 * Device's Tile then has the wrong size for its whole Session. Measure after this.
 */
export function viewportSettled(win: Pick<Window, 'addEventListener' | 'removeEventListener' | 'visualViewport'> = window, quietMs = 120, maxMs = 600): Promise<void> {
  return new Promise((resolve) => {
    let quiet = setTimeout(done, quietMs);
    const limit = setTimeout(done, maxMs);
    function changed(): void {
      clearTimeout(quiet);
      quiet = setTimeout(done, quietMs);
    }
    function done(): void {
      clearTimeout(quiet);
      clearTimeout(limit);
      win.removeEventListener('resize', changed);
      win.visualViewport?.removeEventListener('resize', changed);
      resolve();
    }
    win.addEventListener('resize', changed);
    win.visualViewport?.addEventListener('resize', changed);
  });
}

/** Visible area in CSS px; `visualViewport` excludes browser toolbars where `innerHeight` may not. `pxPerMm` is corrected for the page's zoom. */
export function deviceInfo(deviceId: DeviceId): DeviceInfo {
  const ua = navigator as Navigator & { userAgentData?: { platform?: string } };
  const vv = window.visualViewport;
  return {
    deviceId,
    name: ua.userAgentData?.platform ?? navigator.platform,
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    pxPerMm: guessPxPerMm() * pageZoom(),
  };
}
