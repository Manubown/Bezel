/** How far from the corner control a touch may land and still bring it back, in CSS px: about a thumb's width. */
export const REACH_PX = 48;
/** How long the corner control stays in full view after play starts, the sheet folds, or a touch brought it back. */
export const SHOWN_MS = 3000;

/** Whether a touch at (`x`, `y`) lands on the box or within `REACH_PX` of its edge. */
export function isNear(box: { left: number; top: number; right: number; bottom: number }, x: number, y: number): boolean {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return dx * dx + dy * dy <= REACH_PX * REACH_PX;
}

/**
 * The corner control while a Match runs: the Host's folded bar, a pill in the corner of its Tile (`index.html`,
 * `.sheet[data-playing]`). In full view for `SHOWN_MS` (`data-awake`), then faded back so the Tile is the Game's; a
 * touch near it brings it back. While faded it is inactive: a touch on it only brings it back, and it opens the sheet
 * once it is in view, so a thumb in the corner mid-rally does not open the sheet. Touches still reach the Game.
 */
export function fadeCorner(sheet: HTMLElement): void {
  let timer = 0;
  /** Until when a click on the sheet is the end of the touch that brought it back, not a tap on it. */
  let swallowUntil = 0;
  const cornered = (): boolean => 'playing' in sheet.dataset && !('open' in sheet.dataset);
  const show = (): void => {
    sheet.dataset['awake'] = '';
    clearTimeout(timer);
    timer = window.setTimeout(() => delete sheet.dataset['awake'], SHOWN_MS);
  };
  new MutationObserver(() => {
    if (cornered()) show();
    else clearTimeout(timer);
  }).observe(sheet, { attributes: true, attributeFilter: ['data-playing', 'data-open'] });
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!cornered() || !isNear(sheet.getBoundingClientRect(), e.clientX, e.clientY)) return;
      if (!('awake' in sheet.dataset) && sheet.contains(e.target as Node)) swallowUntil = e.timeStamp + 1000;
      show();
    },
    { capture: true, passive: true },
  );
  sheet.addEventListener(
    'click',
    (e) => {
      if (e.timeStamp > swallowUntil) return;
      swallowUntil = 0;
      e.stopPropagation();
    },
    { capture: true },
  );
}
