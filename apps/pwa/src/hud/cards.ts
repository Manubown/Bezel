import type { LastMatch, Play } from '../hud';
import type { PauseNotice } from '../pause';
import { describeLast, esc } from './shared';

/** How the last Match ended, over the lobby on every Device: the winner, or why it closed. Until tapped or the next Match starts. */
export function lastCard(play: Readonly<Play>): () => void {
  const card = document.createElement('section');
  card.className = 'result';
  card.setAttribute('role', 'status');
  card.hidden = true;
  document.body.append(card);
  let shown: LastMatch | undefined;
  let dismissed: LastMatch | undefined;
  card.addEventListener('click', () => {
    dismissed = play.last;
    card.hidden = true;
  });
  return () => {
    const last = play.last;
    card.hidden = play.running || !last || last === dismissed;
    if (card.hidden || !last || last === shown) return;
    shown = last;
    const { headline, detail } = describeLast(last);
    card.innerHTML =
      `<p class="result-head">${esc(headline)}</p>` + (detail ? `<p class="result-detail">${esc(detail)}</p>` : '') + `<p class="result-hint">Tap to close</p>`;
  };
}

/** Over a running Match on every Device: who a pause waits for, or (Host) that its own view stopped. */
export function pauseCard(play: Readonly<Play>): () => void {
  const card = document.createElement('section');
  card.className = 'pause';
  card.setAttribute('role', 'status');
  card.hidden = true;
  document.body.append(card);
  let shown: PauseNotice | undefined;
  return () => {
    const notice = play.running ? (play.paused ?? play.stopped) : undefined;
    card.hidden = !notice;
    if (!notice || notice === shown) return;
    shown = notice;
    card.innerHTML = `<p class="pause-head">${esc(notice.headline)}</p><p class="pause-detail">${esc(notice.detail)}</p>`;
  };
}
