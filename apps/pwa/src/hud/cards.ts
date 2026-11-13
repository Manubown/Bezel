import type { HudOptions, LastMatch, Play, Sheet } from '../hud';
import type { PauseNotice } from '../pause';
import { describeLast, esc, inColour } from './shared';

/**
 * How the last Match ended, over the lobby on every Device that ran it: the winner, or why it closed. Gone while a
 * Match runs. The first phone's (`sheet` given) offers Play again (the lobby's `startAgain`, a refusal in words) and
 * Change game (the sheet unfolded), and is done once the sheet is unfolded; the others' say the first phone starts
 * the next game, until tapped.
 */
export function lastCard({ play, lobby }: Pick<HudOptions, 'play' | 'lobby'>, sheet: Sheet | undefined): () => void {
  const card = document.createElement('section');
  card.className = sheet ? 'result' : 'result closes';
  card.hidden = true;
  document.body.append(card);
  let shown: LastMatch | undefined;
  let dismissed: LastMatch | undefined;
  /** Why the last Play again was refused; stale as soon as the lobby changes. */
  let refusal = '';
  lobby.onChange(() => (refusal = ''));

  const render = (): void => {
    const last = play.last;
    // The unfolded sheet carries the last Match in its line, and Start: the card has done its part.
    if (sheet?.open) dismissed = last;
    card.hidden = play.running || !last || last === dismissed;
    if (card.hidden || !last) return;
    if (last !== shown) {
      shown = last;
      refusal = '';
      const { headline, detail, player } = describeLast(last);
      card.innerHTML =
        `<div role="status"><p class="result-head"${inColour(player)}>${esc(headline)}</p>` +
        (detail ? `<p class="result-detail">${esc(detail)}</p>` : '') +
        (sheet ? '' : `<p class="result-next">The first phone starts the next game</p>`) +
        `</div>` +
        (sheet
          ? `<div class="result-actions"><button type="button" class="again">Play again</button><button type="button" class="change">Change game</button></div><p class="result-refusal" role="alert"></p>`
          : `<p class="result-hint">Tap to close</p>`);
    }
    const said = card.querySelector('.result-refusal');
    if (said) said.textContent = refusal;
  };

  card.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest('button');
    if (!sheet) {
      dismissed = play.last;
      card.hidden = true;
    } else if (button?.classList.contains('change')) sheet.unfold();
    else if (button?.classList.contains('again')) {
      try {
        lobby.startAgain();
      } catch (err) {
        refusal = err instanceof Error ? err.message : String(err);
        render();
      }
    }
  });
  return render;
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
    card.innerHTML = `<p class="pause-head"${inColour(notice.player)}>${esc(notice.headline)}</p><p class="pause-detail">${esc(notice.detail)}</p>`;
  };
}
