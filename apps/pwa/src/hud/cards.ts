import type { HudOptions, LastMatch, Play, Sheet } from '../hud';
import { spendsOffer, type CardEnd } from '../install';
import type { Notice } from '../result';
import { offerHtml, wireOffer } from './install';
import { describeLast, esc, inColour } from './shared';

/**
 * How the last Match ended, over the lobby on every Device that ran it: the winner, or why it closed. Gone while a
 * Match runs. The Host's (`sheet` given) offers Play again (the lobby's `startAgain`, a refusal in words) and
 * Change game (the sheet unfolded), and is done once the sheet is unfolded; the Peers' say the first phone starts
 * the next game, until tapped. Below that, the install offer (`installOffer`'s card) on the first card it is due; once
 * its person closes that card or taps Install on it, the offer is spent and does not return to a card; a Peer's card
 * the next Match replaced leaves it for the next one (`spendsOffer`). `closed`: a tap closed a Peer's card, for the HUD
 * to render again (the help card waits for the result card, `describeJoin`).
 */
export function lastCard({ play, lobby, install, maker }: Pick<HudOptions, 'play' | 'lobby' | 'install' | 'maker'>, sheet: Sheet | undefined, closed: () => void): LastCard {
  const card = document.createElement('section');
  card.className = sheet ? 'result' : 'result closes';
  card.hidden = true;
  document.body.append(card);
  let shown: LastMatch | undefined;
  let dismissed: LastMatch | undefined;
  /** The card on show carries the install offer, not spent yet. */
  let offering = false;
  /** The card that carried the offer went (`spendsOffer`). */
  const went = (end: CardEnd): void => {
    if (!offering) return;
    offering = false;
    if (spendsOffer(end)) install.dismiss();
  };
  wireOffer(card, install);
  /** Why the last Play again was refused; stale as soon as the lobby changes. */
  let refusal = '';
  lobby.onChange(() => (refusal = ''));

  const render = (): void => {
    const last = play.last;
    // The unfolded sheet carries the last Match in its line, and Start: the card has done its part.
    if (sheet?.open) dismissed = last;
    card.hidden = play.running || !last || last === dismissed;
    // The card that carried the offer went: the Host's only by its person's hand (Play again, Change game, the sheet); a
    // Peer's by a tap, or replaced by the next Match the Host started.
    if (offering && (card.hidden || last !== shown)) went(!sheet && (play.running || last !== shown) ? 'replaced' : 'closed');
    if (card.hidden || !last) return;
    if (last !== shown) {
      shown = last;
      refusal = '';
      const { headline, detail, player } = describeLast(last, maker);
      const offer = install.offer().card;
      offering = offer !== undefined;
      card.innerHTML =
        `<div role="status"><p class="result-head"${inColour(player)}>${esc(headline)}</p>` +
        (detail ? `<p class="result-detail">${esc(detail)}</p>` : '') +
        (sheet ? '' : `<p class="result-next">The first phone starts the next game</p>`) +
        `</div>` +
        (sheet
          ? `<div class="result-actions"><button type="button" class="again">Play again</button><button type="button" class="change">Change game</button></div><p class="result-refusal" role="alert"></p>`
          : '') +
        (offer ? offerHtml(offer) : '') +
        (sheet ? '' : `<p class="result-hint">Tap to close</p>`);
    }
    // Installed from this card: the offer goes (the row with it; a spent offer keeps its row, and stays on this card).
    const offer = card.querySelector<HTMLElement>('.offer');
    if (offer) offer.hidden = !install.offer().row;
    const said = card.querySelector('.result-refusal');
    if (said) said.textContent = refusal;
  };

  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // The offer's own taps (`wireOffer`) leave the card where it is; Install uses the offer.
    if (target.closest('.offer')) {
      if (target.closest('.offer-install')) went('used');
      return;
    }
    const button = target.closest('button');
    if (!sheet) {
      dismissed = play.last;
      closed();
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
  return {
    render,
    get open() {
      return !card.hidden;
    },
  };
}

/** The result card: its render, and whether it showed at the last one. */
export interface LastCard {
  render(): void;
  readonly open: boolean;
}

/** Over a running Match on every Device: who a pause waits for, or (Host) that its own view stopped. */
export function pauseCard(play: Readonly<Play>): () => void {
  const card = document.createElement('section');
  card.className = 'pause';
  card.setAttribute('role', 'status');
  card.hidden = true;
  document.body.append(card);
  let shown: Notice | undefined;
  return () => {
    const notice = play.running ? (play.paused ?? play.stopped) : undefined;
    card.hidden = !notice;
    if (!notice || notice === shown) return;
    shown = notice;
    card.innerHTML = `<p class="pause-head"${inColour(notice.player)}>${esc(notice.headline)}</p><p class="pause-detail">${esc(notice.detail)}</p>`;
  };
}
