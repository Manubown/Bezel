import type { Hud, HudOptions } from '../hud';
import { esc, placementHint, statusDot, syncStats } from './shared';

/** A Peer's top strip: the code, where this phone is in joining and in the lobby, and the session log's export. */
export function peerStrip(root: HTMLElement, o: HudOptions): Hud {
  const { session, lobby, code, play } = o;
  root.className = 'strip';
  root.innerHTML = `<span class="code">${esc(code)}</span><span class="state"></span><span class="meta"></span><button type="button" class="export" aria-label="Export the session log">Log</button>`;
  root.querySelector<HTMLButtonElement>('.export')!.addEventListener('click', () => void o.log.export());
  const state = root.querySelector('.state')!;
  const meta = root.querySelector('.meta')!;
  return {
    render() {
      root.hidden = play.running;
      const me = session.self.deviceId;
      const sync = session.roster().find((e) => e.info.deviceId === me)?.sync;
      const { layout, match } = lobby;
      const index = layout?.devices.findIndex((d) => d.id === me) ?? -1;
      if (session.status === 'searching') {
        state.innerHTML = `${statusDot('off')} Looking for the host…`;
        meta.textContent = 'keep the host screen open';
      } else if (session.status === 'reconnecting') {
        state.innerHTML = `${statusDot('wait')} Reconnecting to the host…`;
        meta.textContent = 'the connection dropped · trying again';
      } else if (session.status === 'syncing') {
        state.innerHTML = `${statusDot('wait')} Syncing clocks`;
        meta.textContent = 'measuring the offset to the host';
      } else if (match && !match.devices.some((d) => d.deviceId === me)) {
        state.innerHTML = `${statusDot('wait')} Match in progress`;
        meta.textContent = `you join the next one · ${syncStats(sync)}`;
      } else if (lobby.roleOf(me) === 'controller') {
        state.innerHTML = `${statusDot('ok')} Controller`;
        meta.textContent = `hold this phone in hand · ${syncStats(sync)}`;
      } else if (layout && index >= 0) {
        const seated = lobby.players.find((p) => p.deviceId === me);
        state.innerHTML = `${statusDot('ok')} Phone ${index + 1} of ${layout.devices.length}`;
        meta.textContent = [placementHint(layout, index), seated?.name, syncStats(sync)].filter(Boolean).join(' · ');
      } else {
        state.innerHTML = `${statusDot('ok')} Synced`;
        meta.textContent = `waiting for arrangement · ${syncStats(sync)}`;
      }
    },
  };
}
