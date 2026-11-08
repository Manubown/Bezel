/** The screen wake locks this page holds now. */
const held = new Set<WakeLockSentinel>();

/** Whether this page holds a screen wake lock now (the recorder's `tick` line). */
export function awake(): boolean {
  return held.size > 0;
}

/**
 * Keeps the screen on while the page is open, lobby and Match alike (connectivity-1 D11). The lock is requested
 * on a `pointerdown` or `keydown` anywhere on the page while none is held (the first request must come from a
 * gesture on a visible page), and again when the page becomes visible: the system releases it whenever the page
 * is hidden. A refused request is retried on the next gesture. Returns the release. A browser without the Screen
 * Wake Lock API gets a no-op.
 */
export function keepAwake(): () => void {
  if (!('wakeLock' in navigator)) return () => {};
  let lock: WakeLockSentinel | undefined;
  let asking = false;
  let released = false;
  const drop = (sentinel: WakeLockSentinel): void => {
    held.delete(sentinel);
    if (lock === sentinel) lock = undefined;
  };
  const ask = (): void => {
    if (lock || asking || released || document.visibilityState !== 'visible') return;
    asking = true;
    navigator.wakeLock.request('screen').then(
      (sentinel) => {
        asking = false;
        if (released) return void sentinel.release();
        lock = sentinel;
        held.add(sentinel);
        sentinel.addEventListener('release', () => drop(sentinel));
      },
      // Refused (no gesture yet, not allowed, or the page went away meanwhile): the next gesture asks again.
      () => (asking = false),
    );
  };
  // Capture: a Game's own listeners cannot keep the gesture from the page.
  const gesture = { capture: true } as const;
  document.addEventListener('pointerdown', ask, gesture);
  document.addEventListener('keydown', ask, gesture);
  document.addEventListener('visibilitychange', ask);
  return () => {
    released = true;
    document.removeEventListener('pointerdown', ask, gesture);
    document.removeEventListener('keydown', ask, gesture);
    document.removeEventListener('visibilitychange', ask);
    if (lock) {
      const sentinel = lock;
      drop(sentinel);
      void sentinel.release();
    }
  };
}
