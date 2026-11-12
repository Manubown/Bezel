/** The look's tokens (`@mgc/look/tokens.css`) that the canvas and the QR code paint with: CSS does not reach them. */
export interface Look {
  /** The ground. */
  bg: string;
  /** Ivory: text and what matters. */
  fg: string;
  /** Secondary text and outlines. */
  fg2: string;
  /** A control's border; the strong lines of the lobby's grid. */
  line: string;
  /** Dividers and the fine lines of the lobby's grid. */
  rule: string;
  /** The display face (name, titles, numbers) and the phone's own face, as `font` families. */
  display: string;
  ui: string;
}

let read: Look | undefined;

/**
 * The tokens as this page has them, read once from its style (which `index.html` loads before any script): the look
 * does not change while the page lives, and a frame should not pay for a style lookup.
 */
export function look(): Look {
  if (read) return read;
  const style = getComputedStyle(document.documentElement);
  const token = (name: string): string => style.getPropertyValue(name).trim();
  read = {
    bg: token('--bg'),
    fg: token('--fg'),
    fg2: token('--fg-2'),
    line: token('--line'),
    rule: token('--rule'),
    display: token('--font-display'),
    ui: token('--font-ui'),
  };
  return read;
}
