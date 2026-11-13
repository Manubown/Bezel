import { buildLayout, type TemplateId } from '@mgc/layout';
import { describe, expect, it } from 'vitest';
import { placementSentence } from '../src/placement';

/** `n` phones of one size in the template `template`. */
const table = (template: TemplateId, n: number) =>
  buildLayout(
    template,
    Array.from({ length: n }, (_, i) => ({ id: `d${i + 1}`, w: 70, h: 150 })),
  );

describe('placementSentence', () => {
  it('tells each phone of a row to lie right of the phone before it', () => {
    const row = table('row', 3);
    expect(placementSentence(row, 1)).toBe('Lay me right of phone 1');
    expect(placementSentence(row, 2)).toBe('Lay me right of phone 2');
  });

  it('tells each phone of a column to lie below the phone before it', () => {
    const column = table('column', 3);
    expect(placementSentence(column, 1)).toBe('Lay me below phone 1');
    expect(placementSentence(column, 2)).toBe('Lay me below phone 2');
  });

  // Tile 1 need not be the first phone (the Host): moved, a Peer gets it. So it says it goes first, not that it is the first phone.
  it('tells phone 1 to go first, at the end the others are laid from', () => {
    expect(placementSentence(table('row', 3), 0)).toBe('Lay me first, on the left');
    expect(placementSentence(table('row', 1), 0)).toBe('Lay me first, on the left');
    expect(placementSentence(table('column', 2), 0)).toBe('Lay me first, at the top');
    expect(placementSentence(table('grid', 4), 0)).toBe('Lay me first, top left');
  });

  it('in a grid, says right of the phone before it, and the first of each row below the first of the row above', () => {
    const grid = table('grid', 4); // 1 2 / 3 4
    expect(placementSentence(grid, 1)).toBe('Lay me right of phone 1');
    expect(placementSentence(grid, 2)).toBe('Lay me below phone 1');
    expect(placementSentence(grid, 3)).toBe('Lay me right of phone 3');
    expect(placementSentence(table('grid', 5), 3)).toBe('Lay me below phone 1'); // 1 2 3 / 4 5
  });
});
