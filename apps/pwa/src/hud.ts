import type { RosterEntry, Session } from '@mgc/core';
import { TEMPLATE_IDS, type Layout, type TemplateId } from '@mgc/layout';
import type { CloseReason, Manifest, MatchResult, Player } from '@mgc/sdk';
import QRCode from 'qrcode';
import type { LogLine } from './gamelog';
import type { Lobby } from './lobby';
import type { PauseNotice } from './pause';
import type { Recorder } from './recorder';
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
  /** The session log this page keeps; the HUD offers its export. */
  log: Pick<Recorder, 'export' | 'clear' | 'count'>;
}

export interface Hud {
  render(): void;
}

/**
 * The platform overlay, rendered from the lobby, the Session, and `play`: the
 * Host's bottom sheet (join code, Game, arrangement, Controllers, Player slots
 * with names and bots, Start, game log, and the roster in Tile order with its
 * move buttons) or a Peer's top strip, plus the last Match's close (its result,
 * or why it stopped) and a paused Match's notice on every Device. They step
 * aside while this Device runs a Match.
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
  // Peers join the same room with the same connectivity flags (`turn`), so a Match never mixes paths.
  joinUrl.search = `?room=${code}${new URLSearchParams(location.search).has('turn') ? '&turn' : ''}`;
  /** The address to type: host plus the app's path, without the trailing slash (`manubown.github.io/Bezel`). */
  const address = (joinUrl.host + joinUrl.pathname).replace(/\/$/, '');
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
        <p class="hint">Scan to join, or open <b>${esc(address)}</b> and enter the code.</p>
        <form class="enter" aria-label="Join another table">
          <input name="room" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="4" placeholder="Code" aria-label="Table code" />
          <button type="submit">Join</button>
        </form>
      </div>
      <div class="seg games" role="radiogroup" aria-label="Game">
        ${games.map((g, i) => `<button type="button" role="radio" data-g="${i}">${esc(g.name)}</button>`).join('')}
      </div>
      <div class="seg arrangement" role="radiogroup" aria-label="Arrangement">
        ${TEMPLATE_IDS.map((t) => `<button type="button" role="radio" data-t="${t}">${TEMPLATE_LABEL[t]}</button>`).join('')}
      </div>
      <div class="roles">
        <p class="roles-label"></p>
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
      <div class="diag">
        <button type="button" class="export">Export log</button>
        <button type="button" class="clear-log">Clear</button>
        <span class="diag-meta"></span>
      </div>
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
  wireDiagnostics(root, o.log);
  // Joining a table means leaving this one: the page reopens as a Peer of that room.
  const enter = root.querySelector<HTMLFormElement>('.enter')!;
  const roomInput = enter.elements.namedItem('room') as HTMLInputElement;
  roomInput.addEventListener('input', () => {
    roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  enter.addEventListener('submit', (e) => {
    e.preventDefault();
    const room = roomInput.value;
    if (room.length === 0) return;
    location.assign(`?room=${room}`);
  });
  /** The Game Start starts: the lobby's pick, saved across a reload of the Host's page, else the first by name. */
  let game = games.find((g) => g.id === lobby.picked) ?? games[0]!;
  lobby.setGame(game);
  gameSeg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-g]');
    if (!btn) return;
    game = games[Number(btn.dataset['g'])] ?? game;
    lobby.setGame(game);
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
  // A pressed Bot chip: the host game plays that slot.
  players.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-slot]');
    if (btn) lobby.setBot(Number(btn.dataset['slot']), btn.getAttribute('aria-pressed') !== 'true');
  });
  roster.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-delta]');
    if (btn) lobby.move(btn.dataset['device']!, Number(btn.dataset['delta']));
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
  let rosterHtml = '';
  let rosterSync: string[] = [];
  let wasRunning = false;
  let shownLog: Play['log'] | undefined;
  setOpen(true);

  const render = () => {
    const { layout, match } = lobby;
    // The sheet folds away while the Host's Tile shows the Game and comes back after.
    if (play.running !== wasRunning) {
      wasRunning = play.running;
      setOpen(!play.running);
      // Folded during a Match the bar is a corner pill (index.html `.sheet[data-playing]`).
      if (play.running) root.dataset['playing'] = '';
      else delete root.dataset['playing'];
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
    root.querySelector('.roles-label')!.innerHTML =
      lobby.seats === 'controllers'
        ? 'Players’ phones <span>each phone pressed here is held by one Player; the board stays on the table</span>'
        : 'Controllers <span>held in hand, not on the table</span>';
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

    // Player slots: rebuilt only when who plays where changes, so typing is never interrupted.
    const phoneAt = (order: readonly string[], deviceId: string | undefined): string => {
      const i = deviceId === undefined ? -1 : order.indexOf(deviceId);
      return i >= 0 ? `phone ${i + 1}` : '';
    };
    const tileIds = (layout?.devices ?? []).map((d) => d.id);
    /** `where`: the phone a human sits at; for an empty slot, why it is empty. `bot`: the slot's Bot chip, when it has one. */
    type SlotRow = { n: number; player: Player | undefined; where: string; bot?: { slot: number; on: boolean } };
    const slotRows: SlotRow[] = match
      ? match.players.map((p, i) => ({ n: i + 1, player: p, where: p.bot ? 'Bot' : lobby.seats === 'controllers' ? 'Controller' : phoneAt(match.tiles.map((t) => t.deviceId), p.deviceId) }))
      : lobby.seats === 'controllers'
        ? // A Player per Controller phone: mark phones as Controllers above and each holder gets a row here.
          lobby.players.map((p, i): SlotRow => ({ n: i + 1, player: p, where: 'Controller' }))
        : lobby.seats === 'tiles'
          ? // A Player per phone on the table, then the bots that are on; a Bot chip for each bot that could still be added.
            [
              ...lobby.players.map((p, i): SlotRow => {
                const slot = p.bot ? Number(p.playerId.slice('bot:'.length)) : undefined;
                return { n: i + 1, player: p, where: p.bot ? '' : phoneAt(tileIds, p.deviceId), ...(slot !== undefined && { bot: { slot, on: true } }) };
              }),
              ...(game.bots ? lobby.slots.flatMap((s, slot): SlotRow[] => (lobby.players.some((p) => p.bot && p.playerId === `bot:${slot}`) ? [] : [{ n: lobby.players.length + 1, player: undefined, where: 'add a bot', bot: { slot, on: false } }])).slice(0, 1) : []),
            ]
          : lobby.slots.flatMap((s, slot): SlotRow[] => {
              const on = s.player?.bot === true;
              // An empty slot is listed only where a bot could take it; a bot always, so it can be turned off.
              if (!s.player && !game.bots) return [];
              const where = on ? '' : s.player ? phoneAt(tileIds, s.deviceId) : s.deviceId === undefined ? 'no phone' : 'joining…';
              return [{ n: slot + 1, player: s.player, where, ...((game.bots || on) && { bot: { slot, on } }) }];
            });
    const key = `${match ? 'frozen' : 'open'}|${slotRows.map((r) => `${r.n}:${r.player?.playerId ?? ''}@${r.where}:${r.bot?.on ?? ''}`).join(',')}`;
    if (key !== playersKey) {
      playersKey = key;
      players.innerHTML = slotRows
        .map(
          ({ n, player: p, where, bot }) =>
            `<li><span class="n">P${n}</span>` +
            (p
              ? `<input type="text" data-player="${esc(p.playerId)}" value="${esc(p.name)}" maxlength="24" autocomplete="off" spellcheck="false" aria-label="Player ${n} name"${match ? ' disabled' : ''}><span class="meta">${where}</span>`
              : `<span class="empty">${where}</span><span class="meta"></span>`) +
            (bot ? `<button type="button" class="chip bot" data-slot="${bot.slot}" aria-pressed="${bot.on}" aria-label="Player ${n} is a bot">Bot</button>` : '') +
            `</li>`,
        )
        .join('');
    } else {
      players.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
        const p = (match?.players ?? lobby.players).find((x) => x.playerId === input.dataset['player']);
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
      if (self) return '';
      // Two missed heartbeats (`WEAK_MS`): still there and still in the Match, not paused for.
      if (e?.link === 'weak') return `${statusDot('wait')} weak connection`;
      const synced = e?.sync.synced === true;
      return `${statusDot(synced ? 'ok' : 'wait')} ${synced ? syncStats(e.sync) : 'syncing'}`;
    };
    const late = (id: string) => match !== undefined && !match.devices.some((m) => m.deviceId === id) && 'joins the next match';
    // ◀ ▶ move a Tile along the Tile order; never past the ends, never a Controller, never while a Match runs.
    const moves = (id: string, label: string, earlier: boolean, later: boolean): string =>
      `<span class="order">` +
      `<button type="button" class="move" data-device="${esc(id)}" data-delta="-1" aria-label="Move ${label} earlier"${earlier && !match ? '' : ' disabled'}>${arrow(-1)}</button>` +
      `<button type="button" class="move" data-device="${esc(id)}" data-delta="1" aria-label="Move ${label} later"${later && !match ? '' : ' disabled'}>${arrow(1)}</button>` +
      `</span>`;
    const tiles = layout?.devices ?? [];
    const rows = tiles.map((d, i) => {
      const e = byId.get(d.id);
      const self = d.id === session.self.deviceId;
      const seated = lobby.players.find((p) => p.deviceId === d.id);
      const meta = [placementHint(layout!, i), seated && esc(seated.name), late(d.id)].filter(Boolean).join(' · ');
      return {
        html:
          `<li><span class="n">${i + 1}</span><span class="who">${self ? 'This phone' : esc(e?.info.name ?? d.id.slice(0, 6))}</span>` +
          `<span class="meta">${meta}</span>${moves(d.id, `phone ${i + 1}`, i > 0, i < tiles.length - 1)}<span class="sync"></span></li>`,
        sync: syncOf(e, self),
      };
    });
    for (const e of present) {
      if (lobby.roleOf(e.info.deviceId) !== 'controller') continue;
      const meta = ['Controller', late(e.info.deviceId)].filter(Boolean).join(' · ');
      rows.push({
        html: `<li><span class="n">C</span><span class="who">${esc(nameOf(e))}</span><span class="meta">${meta}</span>${moves(e.info.deviceId, esc(nameOf(e)), false, false)}<span class="sync"></span></li>`,
        sync: syncOf(e, e.info.deviceId === session.self.deviceId),
      });
    }
    for (const e of entries) {
      if (e.link === 'lost') rows.push({ html: `<li class="pending"><span class="n">·</span><span class="who">${esc(e.info.name)}</span><span class="meta">disconnected</span><span class="sync"></span></li>`, sync: '' });
    }
    // The rows are rebuilt only when phones, order or names change, so a tap on ◀ ▶ is never lost to a clock report.
    const html = rows.map((r) => r.html).join('');
    if (html !== rosterHtml) {
      const was = roster.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset : undefined;
      rosterHtml = html;
      rosterSync = [];
      roster.innerHTML = html;
      // Keyboard focus follows the moved phone, to its other button once it reached an end.
      if (was?.['device'] !== undefined) {
        const buttons = [...roster.querySelectorAll<HTMLButtonElement>('button[data-delta]')].filter((b) => b.dataset['device'] === was['device'] && !b.disabled);
        (buttons.find((b) => b.dataset['delta'] === was['delta']) ?? buttons[0])?.focus();
      }
    }
    const syncs = roster.querySelectorAll('.sync');
    rows.forEach((r, i) => {
      if (rosterSync[i] === r.sync) return;
      rosterSync[i] = r.sync;
      syncs[i]!.innerHTML = r.sync;
    });
  };
  return { render };
}

function peerStrip(root: HTMLElement, o: HudOptions): Hud {
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

/** The ◀ (towards the first Tile) or ▶ (towards the last) of a move button. */
function arrow(delta: -1 | 1): string {
  return `<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="${delta < 0 ? 'M8.5 1v10L1.5 6z' : 'M1.5 1v10l7-5z'}"/></svg>`;
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

/** The Host sheet's log row: export (share or download) and clear, with the line count. */
function wireDiagnostics(root: HTMLElement, log: HudOptions['log']): void {
  const exportBtn = root.querySelector<HTMLButtonElement>('.diag .export')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('.diag .clear-log')!;
  const meta = root.querySelector<HTMLElement>('.diag-meta')!;
  const show = (): void => {
    void log.count().then((n) => {
      meta.textContent = `${n} lines · ndjson .txt`;
    });
  };
  exportBtn.addEventListener('click', () => {
    exportBtn.disabled = true;
    void log.export().finally(() => {
      exportBtn.disabled = false;
    });
  });
  clearBtn.addEventListener('click', () => void log.clear().then(show));
  show();
  // The count is cheap to show whenever the sheet opens.
  root.querySelector('.bar')?.addEventListener('click', show);
}
