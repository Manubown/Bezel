import type { RosterEntry, Session } from '@mgc/core';
import { TEMPLATE_IDS, type Layout, type TemplateId } from '@mgc/layout';
import type { CloseReason, Manifest, MatchResult, Player } from '@mgc/sdk';
import QRCode from 'qrcode';
import type { LogLine } from './gamelog';
import type { Lobby } from './lobby';
import type { PauseNotice } from './pause';
import { describeClose, describeResult } from './result';

const TEMPLATE_LABEL: Record<TemplateId, string> = { row: 'Row', column: 'Column', grid: 'Grid' };

/** This Device's part in Matches; `main` keeps it current and calls `render`. */
export interface Play {
  /** A Match runs on this Device now: the screen is the Game's. */
  running: boolean;
  /** Set while the running Match is paused: who it waits for. */
  paused: PauseNotice | undefined;
  /** Host: set once its own view of the running Match closed while the Match goes on. */
  stopped: PauseNotice | undefined;
  /** The last Match that ran on this Device. */
  last: LastMatch | undefined;
  /** The running (else the last) Match's faults, logs and close, oldest first. */
  log: readonly LogLine[];
}

export interface LastMatch {
  /** Why it closed, and the runtime's words for it. */
  reason: CloseReason;
  detail: string;
  players: readonly Player[];
  /** Set when the Game ended it. */
  result?: MatchResult;
}

/** The last Match in words: its result, or why it closed without one. */
function describeLast(last: LastMatch): { headline: string; detail: string } {
  return last.result ? describeResult(last.players, last.result) : describeClose(last.reason, last.detail);
}

export interface HudOptions {
  session: Session;
  lobby: Lobby;
  /** The room code Peers join with. */
  code: string;
  /** What the Host's Start can start; the first is picked until the Host picks another. */
  games: readonly Manifest[];
  play: Readonly<Play>;
  /** Host: ends the running Match. */
  abort(): void;
}

export interface Hud {
  render(): void;
}

/**
 * The platform overlay, rendered from the lobby, the Session, and `play`: the
 * Host's bottom sheet (join code, Game, arrangement, Controllers, Player
 * names, Start, game log, roster) or a Peer's top strip, plus the last Match's
 * close (its result, or why it stopped) and a paused Match's notice on every
 * Device. They step aside while this Device runs a Match.
 */
export async function openHud(root: HTMLElement, o: HudOptions): Promise<Hud> {
  const panel = o.session.role === 'host' ? await hostSheet(root, o) : peerStrip(root, o);
  const closeCard = lastCard(o.play);
  const pause = pauseCard(o.play);
  const hud: Hud = {
    render() {
      panel.render();
      closeCard();
      pause();
    },
  };
  o.session.onChange(hud.render);
  o.lobby.onChange(hud.render);
  hud.render();
  return hud;
}

/** How the last Match ended, over the lobby on every Device: the winner, or why it closed. Until tapped or the next Match starts. */
function lastCard(play: Readonly<Play>): () => void {
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
function pauseCard(play: Readonly<Play>): () => void {
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

async function hostSheet(root: HTMLElement, o: HudOptions): Promise<Hud> {
  const { session, lobby, code, games, play } = o;
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
      <span class="bar-log" hidden></span>
    </button>
    <div class="body">
      <div class="join">
        <div class="qr"></div>
        <p class="hint">Scan to join, or open <b>${esc(joinUrl.host)}</b> and enter the code.</p>
      </div>
      <div class="seg games" role="radiogroup" aria-label="Game">
        ${games.map((g, i) => `<button type="button" role="radio" data-g="${i}">${esc(g.name)}</button>`).join('')}
      </div>
      <div class="seg arrangement" role="radiogroup" aria-label="Arrangement">
        ${TEMPLATE_IDS.map((t) => `<button type="button" role="radio" data-t="${t}">${TEMPLATE_LABEL[t]}</button>`).join('')}
      </div>
      <div class="roles">
        <p class="roles-label">Controllers <span>held in hand, not on the table</span></p>
        <div class="chips" role="group" aria-label="Controllers"></div>
      </div>
      <ol class="players" aria-label="Players"></ol>
      <div class="go">
        <button class="start" type="button"></button>
        <button class="end" type="button">End match</button>
        <p class="reason" role="status"></p>
      </div>
      <ol class="log" aria-label="Game log, newest first" hidden></ol>
      <ol class="roster"></ol>
    </div>`;
  root.querySelector('.qr')!.append(qr);
  const bar = root.querySelector<HTMLButtonElement>('.bar')!;
  const barMeta = root.querySelector('.bar-meta')!;
  const barAction = root.querySelector('.bar-action')!;
  const gameSeg = root.querySelector<HTMLElement>('.games')!;
  const seg = root.querySelector<HTMLElement>('.arrangement')!;
  const chips = root.querySelector<HTMLElement>('.chips')!;
  const players = root.querySelector<HTMLOListElement>('.players')!;
  const start = root.querySelector<HTMLButtonElement>('.start')!;
  const end = root.querySelector<HTMLButtonElement>('.end')!;
  const reason = root.querySelector('.reason')!;
  const barLog = root.querySelector<HTMLElement>('.bar-log')!;
  const log = root.querySelector<HTMLOListElement>('.log')!;
  const roster = root.querySelector<HTMLOListElement>('.roster')!;

  const setOpen = (open: boolean) => {
    if (open) root.dataset['open'] = '';
    else delete root.dataset['open'];
    bar.setAttribute('aria-expanded', String(open));
    barAction.textContent = open ? 'Hide' : 'Setup';
  };
  bar.addEventListener('click', () => setOpen(!('open' in root.dataset)));
  /** The Game Start starts. */
  let game = games[0]!;
  gameSeg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-g]');
    if (!btn) return;
    game = games[Number(btn.dataset['g'])] ?? game;
    refusal = '';
    render();
  });
  seg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-t]');
    if (btn) lobby.setTemplate(btn.dataset['t'] as TemplateId);
  });
  // A pressed chip is a Controller: out of the Layout, held in hand.
  chips.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-device]');
    if (btn) lobby.setRole(btn.dataset['device']!, btn.getAttribute('aria-pressed') === 'true' ? 'tile' : 'controller');
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
  let chipsKey = '';
  let wasRunning = false;
  let shownLog: Play['log'] | undefined;
  setOpen(true);

  const render = () => {
    const { layout, match } = lobby;
    // The sheet folds away while the Host's Tile shows the Game and comes back after.
    if (play.running !== wasRunning) {
      wasRunning = play.running;
      setOpen(!play.running);
    }
    const placed = layout?.devices.length ?? 0;
    const faults = play.log.filter((l) => l.kind === 'fault').length;
    const running = games.find((g) => g.id === lobby.game) ?? game;
    barMeta.textContent = play.running
      ? `${running.name} · ${play.paused ? 'paused' : 'playing'}${faults ? ` · ${faults} fault${faults === 1 ? '' : 's'}` : ''}`
      : `${placed} phone${placed === 1 ? '' : 's'}${layout ? ` · ${TEMPLATE_LABEL[layout.template]}` : ''}`;
    gameSeg.querySelectorAll<HTMLButtonElement>('button[data-g]').forEach((b) => {
      b.setAttribute('aria-checked', String(games[Number(b.dataset['g'])] === (match ? running : game)));
      b.disabled = match !== undefined;
    });
    seg.querySelectorAll<HTMLButtonElement>('button[data-t]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset['t'] === layout?.template));
      b.disabled = match !== undefined;
    });
    start.textContent = `Start ${game.name}`;
    start.hidden = match !== undefined;
    end.hidden = !play.running;
    const described = play.last && describeLast(play.last);
    const lastLine = described && [described.headline, described.detail].filter(Boolean).join(' · ');
    reason.textContent = refusal || (lastLine && !match ? `Last match: ${lastLine}` : '');

    // The game log: its newest line on the folded bar while a Match runs, every line in the sheet.
    const newest = play.log.at(-1);
    barLog.hidden = !play.running || !newest;
    if (play.log !== shownLog) {
      shownLog = play.log;
      if (newest) {
        barLog.className = `bar-log log-${newest.kind}`;
        barLog.textContent = `${newest.kind} · ${newest.text}`;
      }
      log.hidden = play.log.length === 0;
      log.innerHTML = play.log
        .map((l) => `<li class="log-${l.kind}"><span class="log-kind">${l.kind}</span><span class="log-text">${esc(l.text)}</span></li>`)
        .reverse()
        .join('');
    }

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
    const present = entries.filter((e) => e.present);
    const nameOf = (e: RosterEntry): string => (e.info.deviceId === session.self.deviceId ? 'This phone' : e.info.name);
    // One chip per present phone, rebuilt only when phones or roles change, so a tap is never lost to a re-render.
    const roleKey = `${match ? 'frozen' : 'open'}|${present.map((e) => `${e.info.deviceId}:${lobby.roleOf(e.info.deviceId)}:${nameOf(e)}`).join(',')}`;
    if (roleKey !== chipsKey) {
      chipsKey = roleKey;
      chips.innerHTML = present
        .map((e) => {
          const pressed = lobby.roleOf(e.info.deviceId) === 'controller';
          return `<button type="button" class="chip" data-device="${esc(e.info.deviceId)}" aria-pressed="${pressed}"${match ? ' disabled' : ''}>${esc(nameOf(e))}</button>`;
        })
        .join('');
    }

    const byId = new Map(entries.map((e) => [e.info.deviceId, e]));
    const syncOf = (e: RosterEntry | undefined, self: boolean): string => {
      const synced = e?.sync.synced === true;
      return self ? '' : `<span class="sync">${statusDot(synced ? 'ok' : 'wait')} ${synced ? syncStats(e.sync) : 'syncing'}</span>`;
    };
    const late = (id: string) => match !== undefined && !match.devices.some((m) => m.deviceId === id) && 'joins the next match';
    const rows = (layout?.devices ?? []).map((d, i) => {
      const e = byId.get(d.id);
      const self = d.id === session.self.deviceId;
      const seated = lobby.players.find((p) => lobby.seatOf(p.playerId) === d.id);
      const meta = [placementHint(layout!, i), seated && esc(seated.name), late(d.id)].filter(Boolean).join(' · ');
      return `<li><span class="n">${i + 1}</span><span class="who">${self ? 'This phone' : esc(e?.info.name ?? d.id.slice(0, 6))}</span><span class="meta">${meta}</span>${syncOf(e, self)}</li>`;
    });
    for (const e of present) {
      if (lobby.roleOf(e.info.deviceId) !== 'controller') continue;
      const meta = ['Controller', late(e.info.deviceId)].filter(Boolean).join(' · ');
      rows.push(`<li><span class="n">C</span><span class="who">${esc(nameOf(e))}</span><span class="meta">${meta}</span>${syncOf(e, e.info.deviceId === session.self.deviceId)}</li>`);
    }
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
      } else if (lobby.roleOf(me) === 'controller') {
        state.innerHTML = `${statusDot('ok')} Controller`;
        meta.textContent = `hold this phone in hand · ${syncStats(sync)}`;
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
