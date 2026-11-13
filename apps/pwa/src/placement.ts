import { gridColumns, type Layout, type TemplateId } from '@mgc/layout';

/** Where Tile 1 lies: the end of the template the others are laid from. */
const FIRST: Record<TemplateId, string> = { row: 'on the left', column: 'at the top', grid: 'top left' };

/**
 * Where phone `index` (0-based) lies: phone 1 at its end of the template, every other phone relative to a
 * neighbour placed before it (the one before it, or in a grid the one above the first of its row).
 */
export function placementHint(layout: Layout, index: number): string {
  if (index === 0) return FIRST[layout.template];
  switch (layout.template) {
    case 'row':
      return `right of phone ${index}`;
    case 'column':
      return `below phone ${index}`;
    case 'grid': {
      // The grid template's row-major order.
      const cols = gridColumns(layout.devices.length);
      return index % cols === 0 ? `below phone ${index - cols + 1}` : `right of phone ${index}`;
    }
  }
}

/**
 * The sentence phone `index` (0-based) shows under its number in the lobby. Tile 1 is told to go first, not
 * called the first phone: that is the Host, which a reorder can put anywhere.
 */
export function placementSentence(layout: Layout, index: number): string {
  return `Lay me ${index === 0 ? 'first, ' : ''}${placementHint(layout, index)}`;
}
