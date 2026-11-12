import type { HudOptions } from '../hud';
import type { Pitch } from '../install';
import type { Installer } from '../installer';
import { esc } from './shared';

/**
 * The install offer as a block (`.offer`), on the result card and as the first phone's sheet row: what, why, and the
 * Install button (Android) with its steps hidden until the browser turns out to have no install of its own, or the
 * steps (iPhone, iPad).
 */
export function offerHtml(p: Pitch): string {
  return (
    `<div class="offer"><p class="offer-head">${esc(p.headline)}</p><p class="offer-reason">${esc(p.reason)}</p>` +
    (p.button ? `<button type="button" class="offer-install">${esc(p.button)}</button>` : '') +
    `<ol class="offer-steps"${p.button ? ' hidden' : ''}>${p.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`
  );
}

/** The Install buttons of the offers inside `el`: the browser's own install when it has offered one, else the steps in place of the button. */
export function wireOffer(el: HTMLElement, install: Pick<Installer, 'prompt'>): void {
  el.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.offer-install');
    if (!button) return;
    void install.prompt().then((asked) => {
      if (asked) return;
      button.hidden = true;
      button.parentElement?.querySelector('.offer-steps')?.removeAttribute('hidden');
    });
  });
}

/**
 * Inside another app's browser, at once on every phone: open the page in Safari or Chrome (`installOffer`'s banner).
 * It heads the HUD's root: on the first phone above the sheet's bar, folded or open; on the others under the strip's
 * lines (index.html `.strip .inapp`). Not while a Match runs. Returns its render.
 */
export function inAppBanner(root: HTMLElement, o: Pick<HudOptions, 'install' | 'play'>): () => void {
  const el = document.createElement('p');
  el.className = 'inapp';
  el.setAttribute('role', 'status');
  el.hidden = true;
  root.prepend(el);
  return () => {
    const banner = o.install.offer().banner;
    el.hidden = !banner || o.play.running;
    if (banner && !el.hasChildNodes()) el.innerHTML = `<b>${esc(banner.headline)}</b> ${esc(banner.detail)}`;
  };
}
