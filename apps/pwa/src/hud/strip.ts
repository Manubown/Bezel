import brand from '../../../../brand.json';
import type { Hud, HudOptions } from '../hud';
import { esc, placementHint, statusDot, syncStats } from './shared';

/** A Peer's top strip: the code, where this phone is in joining and in the lobby, and in Maker mode its clock and the session log's export. */
export function peerStrip(root: HTMLElement, o: HudOptions): Hud {
  const { session, lobby, code, play, maker } = o;
  root.className = 'strip';
  root.innerHTML =
    `<span class="brand">${esc(brand.name)}</span><span class="code">${esc(code)}</span><span class="state"></span><span class="meta"></span>` +
    (maker ? `<button type="button" class="export" aria-label="Export the session log">Log</button>` : '');
  root.querySelector<HTMLButtonElement>('.export')?.addEventListener('click', () => void o.log.export());
  const state = root.querySelector('.state')!;
  const meta = root.querySelector('.meta')!;
  return {
    render() {
      root.hidden = play.running;
      const me = session.self.deviceId;
      // This phone's clock figures, a maker's only.
      const clock = maker ? syncStats(session.roster().find((e) => e.info.deviceId === me)?.sync) : undefined;
      const { layout, match } = lobby;
      const index = layout?.devices.findIndex((d) => d.id === me) ?? -1;
      if (session.status === 'searching') {
        state.innerHTML = `${statusDot('off')} Looking for the host…`;
        meta.textContent = 'keep the host screen open';
      } else if (session.status === 'reconnecting') {
        state.innerHTML = `${statusDot('wait')} Reconnecting to the host…`;
        meta.textContent = 'the connection dropped · trying again';
      } else if (session.status === 'syncing') {
        state.innerHTML = `${statusDot('wait')} ${maker ? 'Syncing clocks' : 'Connecting…'}`;
        meta.textContent = maker ? 'measuring the offset to the host' : '';
      } else if (match && !match.devices.some((d) => d.deviceId === me)) {
        state.innerHTML = `${statusDot('wait')} Match in progress`;
        meta.textContent = ['you join the next one', clock].filter(Boolean).join(' · ');
      } else if (lobby.roleOf(me) === 'controller') {
        state.innerHTML = `${statusDot('ok')} Controller`;
        meta.textContent = ['hold this phone in hand', clock].filter(Boolean).join(' · ');
      } else if (layout && index >= 0) {
        const seated = lobby.players.find((p) => p.deviceId === me);
        state.innerHTML = `${statusDot('ok')} Phone ${index + 1} of ${layout.devices.length}`;
        meta.textContent = [placementHint(layout, index), seated?.name, clock].filter(Boolean).join(' · ');
      } else {
        state.innerHTML = `${statusDot('ok')} ${maker ? 'Synced' : 'Connected'}`;
        meta.textContent = ['waiting for arrangement', clock].filter(Boolean).join(' · ');
      }
    },
  };
}
