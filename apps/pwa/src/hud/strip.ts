import brand from '../../../../brand.json';
import type { Hud, HudOptions } from '../hud';
import { HELP_AFTER_MS, describeJoin, joinAddress, type HelpCard } from '../join';
import { placementHint } from '../placement';
import { esc, statusDot, syncStats } from './shared';

/**
 * A Peer's top strip: the code, where this phone is in joining (`describeJoin`) and in the lobby, and in Maker mode
 * the makers' words, its clock and the session log's export; under it, after `HELP_AFTER_MS` without getting in,
 * the help card.
 */
export function peerStrip(root: HTMLElement, o: HudOptions): Hud {
  const { session, lobby, code, play, maker } = o;
  root.className = 'strip';
  root.innerHTML =
    `<span class="brand">${esc(brand.name)}</span><span class="code">${esc(code)}</span><span class="state"></span><span class="meta"></span>` +
    (maker ? `<button type="button" class="export" aria-label="Export the session log">Log</button>` : '');
  root.querySelector<HTMLButtonElement>('.export')?.addEventListener('click', () => void o.log.export());
  const state = root.querySelector('.state')!;
  const meta = root.querySelector('.meta')!;
  const help = helpCard(code);
  /** Since when this phone has been trying to get in: the page's start, then each time it lost the table. */
  let since = performance.now();
  let inside = false;
  let wasIn = false;
  /** Shows the help card when its time comes, if no change of the Session did first. */
  let due: number | undefined;
  const render = (): void => {
    root.hidden = play.running;
    const now = performance.now();
    const ready = session.status === 'ready';
    if (inside && !ready) since = now;
    inside = ready;
    wasIn ||= ready;
    const joining = describeJoin({ code, status: session.status, waited: now - since, wasIn });
    clearTimeout(due);
    due = joining && !joining.help ? window.setTimeout(render, since + HELP_AFTER_MS - now) : undefined;
    // Over a running Match the reconnect notice speaks; its grace ends in the lobby, where the card shows.
    help(play.running ? undefined : joining?.help);
    const me = session.self.deviceId;
    // This phone's clock figures, a maker's only.
    const clock = maker ? syncStats(session.roster().find((e) => e.info.deviceId === me)?.sync) : undefined;
    const { layout, match } = lobby;
    const index = layout?.devices.findIndex((d) => d.id === me) ?? -1;
    if (joining) {
      // Lost the table is a warning (amber); finding it and connecting are on their way.
      state.innerHTML = `${statusDot(wasIn ? 'warn' : session.status === 'searching' ? 'off' : 'wait')} ${esc(joining.line)}`;
      meta.textContent = (maker ? [joining.makers, clock] : [joining.detail]).filter(Boolean).join(' · ');
    } else if (match && !match.devices.some((d) => d.deviceId === me)) {
      state.innerHTML = `${statusDot('wait')} A match is on`;
      meta.textContent = ['you join the next one', clock].filter(Boolean).join(' · ');
    } else if (lobby.roleOf(me) === 'controller') {
      state.innerHTML = `${statusDot('ok')} Controller`;
      meta.textContent = ['hold this phone in hand', clock].filter(Boolean).join(' · ');
    } else if (layout && index >= 0) {
      const seated = lobby.players.find((p) => p.deviceId === me);
      state.innerHTML = `${statusDot('ok')} Phone ${index + 1} of ${layout.devices.length}`;
      meta.textContent = [placementHint(layout, index), seated?.name, clock].filter(Boolean).join(' · ');
    } else {
      state.innerHTML = `${statusDot('ok')} You’re in`;
      meta.textContent = [maker ? 'synced · waiting for arrangement' : 'waiting for the first phone', clock].filter(Boolean).join(' · ');
    }
  };
  return { render };
}

/**
 * The help card, over the lobby until this phone gets in: what to check, Try again (the page joins the same code
 * afresh) and the code, to correct it (the page opens that table instead). Returns `show`: the card's words, or
 * undefined to hide it.
 */
function helpCard(code: string): (help: HelpCard | undefined) => void {
  const card = document.createElement('section');
  card.className = 'help';
  card.setAttribute('role', 'status');
  card.hidden = true;
  card.innerHTML = `
    <p class="help-head"></p>
    <ul class="help-advice"></ul>
    <button type="button" class="help-retry">Try again</button>
    <form class="help-code">
      <input name="room" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="4" value="${esc(code)}" placeholder="Code" aria-label="Table code" />
      <button type="submit">Join</button>
    </form>`;
  document.body.append(card);
  card.querySelector('.help-retry')!.addEventListener('click', () => location.reload());
  const form = card.querySelector<HTMLFormElement>('.help-code')!;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const to = joinAddress(location.href, (form.elements.namedItem('room') as HTMLInputElement).value);
    if (to) location.assign(to);
  });
  const head = card.querySelector('.help-head')!;
  const advice = card.querySelector('.help-advice')!;
  let shown = '';
  return (help) => {
    card.hidden = !help;
    if (!help || help.headline === shown) return;
    shown = help.headline;
    head.textContent = help.headline;
    advice.innerHTML = help.advice.map((a) => `<li>${esc(a)}</li>`).join('');
  };
}
