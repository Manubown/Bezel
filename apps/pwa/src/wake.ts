/**
 * Keeps the screen on for a running Match. The wake lock is requested on the
 * Match's first touch (a request needs a visible page, and a touch proves one)
 * and again on a touch after the system dropped it, as it does when the page
 * is hidden. Returns the release, for when the Match closes.
 */
export function keepAwakeOnTouch(): () => void {
  let lock: WakeLockSentinel | undefined;
  let asking = false;
  let released = false;
  const touch = (): void => {
    if (lock || asking || released || !navigator.wakeLock) return;
    asking = true;
    navigator.wakeLock.request('screen').then(
      (sentinel) => {
        asking = false;
        if (released) return void sentinel.release();
        lock = sentinel;
        sentinel.addEventListener('release', () => {
          if (lock === sentinel) lock = undefined;
        });
      },
      // Refused (not allowed, or the page went away meanwhile): the next touch asks again.
      () => (asking = false),
    );
  };
  window.addEventListener('pointerdown', touch, { capture: true });
  return () => {
    released = true;
    window.removeEventListener('pointerdown', touch, { capture: true });
    void lock?.release();
    lock = undefined;
  };
}
