import type { Session } from '@mgc/core';
import { TEMPLATE_IDS, type Layout, type TemplateId } from '@mgc/layout';
import type { CloseReason, Manifest, MatchResult, Player } from '@mgc/sdk';
import QRCode from 'qrcode';
import type { Lobby } from './lobby';
import { describeResult } from './result';

const TEMPLATE_LABEL: Record<TemplateId, string> = { row: 'Row', column: 'Column', grid: 'Grid' };

/** This Device's part in Matches; `main` keeps it current and calls `render`. */
export interface Play {
  /** A Match runs on this Device now: the screen is the Game's. */
  running: boolean;
  /** The last Match that ran on this Device. */
  last: LastMatch | undefined;
}

export interface LastMatch {
  /** Why it closed. */
  reason: CloseReason;
  players: readonly Player[];
  /** Set when the Game ended it. */
  result?: MatchResult;
}

export interface HudOptions {
  session: Session;
  lobby: Lobby;
  /** The room code Peers join with. */
  code: string;
  /** What the Host's Start starts. */
  game: Manifest;
  play: Readonly<Play>;
  /** Host: ends the running Match. */
  abort(): void;
}

export interface Hud {
  render(): void;
}

/**
 * The platform overlay, rendered from the lobby, the Session, and `play`: the
 * Host's bottom sheet (join code, arrangement, Player names, Start, roster) or
 * a Peer's top strip, plus the last Match's result on every Device. They step
 * aside while this Device runs a Match.
 */
export async function openHud(root: HTMLElement, o: HudOptions): Promise<Hud> {
  const panel = o.session.role === 'host' ? await hostSheet(root, o) : peerStrip(root, o);
  const result = resultCard(o.play);
  const hud: Hud = {
    render() {
      panel.render();
      result();
    },
  };
  o.session.onChange(hud.render);
  o.lobby.onChange(hud.render);
  hud.render();
  return hud;
}

/** The last Match's result over the lobby, naming the winner, until tapped or the next Match starts. */
function resultCard(play: Readonly<Play>): () => void {
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
    card.hidden = play.running || !last?.result || last === dismissed;
    if (card.hidden || !last?.result || last === shown) return;
    shown = last;
    const { headline, detail } = describeResult(last.players, last.result);
    card.innerHTML =
      `<p class="result-head">${esc(headline)}</p>` + (detail ? `<p class="result-detail">${esc(detail)}</p>` : '') + `<p class="result-hint">Tap to close</p>`;
  };
}

async function hostSheet(root: HTMLElement, o: HudOptions): Promise<Hud> {
  const { session, lobby, code, game, play } = o;
  const joinUrl = new URL(location.href);
  joinUrl.search = `?room=${code}`;
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, joinUrl.toString(), { width: 168, margin: 0, color: { dark: '#121212', light: '#f2f0ea' } });

  root.className = 'sheet';
  root.innerHTML = `
    <button class="bar" type="button">
      <span class="code">${esc(code)}</span>
      <span class="bar-meta"></span>
      <span class="bar-action"></span>
    </button>
    <div class="body">
      <div class="join">
        <div class="qr"></div>
        <p class="hint">Scan to join, or open <b>${esc(joinUrl.host)}</b> and enter the code.</p>
      </div>
      <div class="seg" role="radiogroup" aria-label="Arrangement">
        ${TEMPLATE_IDS.map((t) => `<button type="button" role="radio" data-t="${t}">${TEMPLATE_LABEL[t]}</button>`).join('')}
      </div>
      <ol class="players" aria-label="Players"></ol>
      <div class="go">
        <button class="start" type="button">Start ${esc(game.name)}</button>
        <button class="end" type="button">End match</button>
        <p class="reason" role="status"></p>
      </div>
      <ol class="roster"></ol>
    </div>`;
  root.querySelector('.qr')!.append(qr);
  const bar = root.querySelector<HTMLButtonElement>('.bar')!;
  const barMeta = root.querySelector('.bar-meta')!;
  const barAction = root.querySelector('.bar-action')!;
  const seg = root.querySelector('.seg')!;
  const players = root.querySelector<HTMLOListElement>('.players')!;
  const start = root.querySelector<HTMLButtonElement>('.start')!;
  const end = root.querySelector<HTMLButtonElement>('.end')!;
  const reason = root.querySelector('.reason')!;
  const roster = root.querySelector<HTMLOListElement>('.roster')!;

  const setOpen = (open: boolean) => {
    if (open) root.dataset['open'] = '';
    else delete root.dataset['open'];
    bar.setAttribute('aria-expanded', String(open));
    barAction.textContent = open ? 'Hide' : 'Setup';
  };
  bar.addEventListener('click', () => setOpen(!('open' in root.dataset)));
  seg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-t]');
    if (btn) lobby.setTemplate(btn.dataset['t'] as TemplateId);
  });
  players.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    lobby.setPlayers(lobby.players.map((p) => (p.playerId === input.dataset['player'] ? { ...p, name: input.value } : p)));
  });
  /** Why the last Start was refused; stale as soon as the lobby changes. */
  let refusal = '';
  lobby.onChange(() => (refusal = ''));
  start.addEventListener('click', () => {
    try {
      lobby.start(game);
    } catch (e) {
      refusal = e instanceof Error ? e.message : String(e);
      render();
    }
  });
  end.addEventListener('click', () => o.abort());

  let playersKey = '';
  let wasRunning = false;
  setOpen(true);

  const render = () => {
    const { layout, match } = lobby;
    // The sheet folds away while the Host's Tile shows the Game and comes back after.
    if (play.running !== wasRunning) {
      wasRunning = play.running;
      setOpen(!play.running);
    }
    const placed = layout?.devices.length ?? 0;
    barMeta.textContent = play.running
      ? `${game.name} · playing`
      : `${placed} phone${placed === 1 ? '' : 's'}${layout ? ` · ${TEMPLATE_LABEL[layout.template]}` : ''}`;
    seg.querySelectorAll<HTMLButtonElement>('button[data-t]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset['t'] === layout?.template));
      b.disabled = match !== undefined;
    });
    start.hidden = match !== undefined;
    end.hidden = !play.running;
    const last = play.last;
    const described = last?.result && describeResult(last.players, last.result);
    const lastLine = described ? [described.headline, described.detail].filter(Boolean).join(' · ') : last?.reason;
    reason.textContent = refusal || (lastLine && !match ? `Last match: ${lastLine}` : '');

    // Player names: rebuilt only when who plays where changes, so typing is never interrupted.
    const list = match?.players ?? lobby.players;
    const seat = (playerId: string) => {
      const i = layout?.devices.findIndex((d) => d.id === lobby.seatOf(playerId)) ?? -1;
      return i >= 0 ? `phone ${i + 1}` : '';
    };
    const key = `${match ? 'frozen' : 'open'}|${list.map((p) => `${p.playerId}@${seat(p.playerId)}`).join(',')}`;
    if (key !== playersKey) {
      playersKey = key;
      players.innerHTML = list
        .map(
          (p, i) =>
            `<li><span class="n">P${i + 1}</span>` +
            `<input type="text" data-player="${esc(p.playerId)}" value="${esc(p.name)}" maxlength="24" autocomplete="off" spellcheck="false" aria-label="Player ${i + 1} name"${match ? ' disabled' : ''}>` +
            `<span class="meta">${seat(p.playerId)}</span></li>`,
        )
        .join('');
    } else {
      players.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        const p = list.find((x) => x.playerId === input.dataset['player']);
        if (p && input !== document.activeElement) input.value = p.name;
      });
    }

    const entries = session.roster();
    const byId = new Map(entries.map((e) => [e.info.deviceId, e]));
    const rows = (layout?.devices ?? []).map((d, i) => {
      const e = byId.get(d.id);
      const self = d.id === session.self.deviceId;
      const seated = lobby.players.find((p) => lobby.seatOf(p.playerId) === d.id);
      const late = match !== undefined && !match.devices.some((m) => m.deviceId === d.id);
      const meta = [placementHint(layout!, i), seated && esc(seated.name), late && 'joins the next match'].filter(Boolean).join(' · ');
      const synced = e?.sync.synced === true;
      const sync = self ? '' : `<span class="sync">${statusDot(synced ? 'ok' : 'wait')} ${synced ? syncStats(e.sync) : 'syncing'}</span>`;
      return `<li><span class="n">${i + 1}</span><span class="who">${self ? 'This phone' : esc(e?.info.name ?? d.id.slice(0, 6))}</span><span class="meta">${meta}</span>${sync}</li>`;
    });
    for (const e of entries) if (!e.present) rows.push(`<li class="pending"><span class="n">·</span><span class="who">${esc(e.info.name)}</span><span class="meta">disconnected</span></li>`);
    roster.innerHTML = rows.join('');
  };
  return { render };
}

function peerStrip(root: HTMLElement, o: HudOptions): Hud {
  const { session, lobby, code, play } = o;
  root.className = 'strip';
  root.innerHTML = `<span class="code">${esc(code)}</span><span class="state"></span><span class="meta"></span>`;
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
        state.innerHTML = `${statusDot('off')} Looking for the host`;
        meta.textContent = 'keep the host screen open';
      } else if (session.status === 'syncing') {
        state.innerHTML = `${statusDot('wait')} Syncing clocks`;
        meta.textContent = 'measuring the offset to the host';
      } else if (match && !match.devices.some((d) => d.deviceId === me)) {
        state.innerHTML = `${statusDot('wait')} Match in progress`;
        meta.textContent = `you join the next one · ${syncStats(sync)}`;
      } else if (layout && index >= 0) {
        const seated = lobby.players.find((p) => lobby.seatOf(p.playerId) === me);
        state.innerHTML = `${statusDot('ok')} Phone ${index + 1} of ${layout.devices.length}`;
        meta.textContent = [placementHint(layout, index), seated?.name, syncStats(sync)].filter(Boolean).join(' · ');
      } else {
        state.innerHTML = `${statusDot('ok')} Synced`;
        meta.textContent = `waiting for arrangement · ${syncStats(sync)}`;
      }
    },
  };
}

/** Where phone `index` (0-based) goes relative to the one before it. */
function placementHint(layout: Layout, index: number): string {
  if (index === 0) return 'first phone';
  const n = index + 1;
  switch (layout.template) {
    case 'row':
      return `right of phone ${n - 1}`;
    case 'column':
      return `below phone ${n - 1}`;
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(layout.devices.length));
      return `row ${Math.floor(index / cols) + 1}, column ${(index % cols) + 1}`;
    }
  }
}

function ms(n: number | undefined): string {
  return n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(1)} ms`;
}

/** `rtt · Δoffset`; the offset is raw host−local time, so watch its stability, not its value. */
function syncStats(c: { rtt?: number; offset?: number } | undefined): string {
  return c ? `${ms(c.rtt)} · Δ${ms(c.offset)}` : '—';
}

function statusDot(state: 'ok' | 'wait' | 'off'): string {
  return `<svg class="dot dot-${state}" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4"/></svg>`;
}

/** Names and ids come off the network: never markup. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
