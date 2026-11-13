import type { RosterEntry } from '@mgc/core';
import type { TemplateId } from '@mgc/layout';
import type { Player } from '@mgc/sdk';
import QRCode from 'qrcode';
import brand from '../../../../brand.json';
import { TEMPLATE_WORDS, cardLine, firstPick, gameList } from '../gamelist';
import type { HudOptions, Play, Sheet } from '../hud';
import { templatesOf } from '../lobby';
import { look } from '../look';
import { MAKER_FLAG } from '../maker';
import { otherSession, sessionCode } from '../sessioncode';
import { placementHint } from '../placement';
import { fadeCorner } from './corner';
import { offerHtml, wireOffer } from './install';
import { describeLast, esc, inColour, soundSwitch, statusDot, syncStats } from './shared';

/** The site's privacy page (spec D18), beside the app at the public address; `scripts/pages.mjs` checks it is published. */
const PRIVACY = new URL('privacy/', brand.address).href;

/**
 * The Host's bottom sheet, top to bottom the steps of getting a Session going (spec D4): the QR with a sentence for the
 * other phones, the phones in the order they lie (roster, ◀ ▶), a card per Game, the template picker when the Game names
 * more than one, Controllers when it takes them, Player slots, Start; then the game log, the install offer's row,
 * Export log (Maker mode), this phone's sound switch, "Join a different table", folded, and the link to the privacy page
 * (in a new tab: this page holds the Session). `onToggle`: the Host folded or unfolded it (the bar, `unfold`).
 */
export async function hostSheet(root: HTMLElement, o: HudOptions, onToggle: () => void): Promise<Sheet> {
  const { session, lobby, code, games, play, maker } = o;
  /** The Games this phone offers (`gamelist.ts`): Pong and Air Hockey, in Maker mode every Game. */
  const shown = gameList(games, maker);
  const joinUrl = new URL(location.href);
  // Peers join the same room with the same connectivity flags (`noturn`), so a Match never mixes paths, and in Maker mode with its flag, so one scan sets every Peer of the Session.
  joinUrl.search = `?room=${code}${new URLSearchParams(location.search).has('noturn') ? '&noturn' : ''}${maker ? `&${MAKER_FLAG}` : ''}`;
  /** The address to type: host plus the app's path, without the trailing slash (`manubown.github.io/Bezel`); in Maker mode with its flag (`manubown.github.io/Bezel/?maker`). */
  const address = (joinUrl.host + joinUrl.pathname).replace(/\/$/, '') + (maker ? `/?${MAKER_FLAG}` : '');
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, joinUrl.toString(), { width: 168, margin: 0, color: { dark: look().bg, light: look().fg } });

  root.className = 'sheet';
  root.innerHTML = `
    <button class="bar" type="button">
      <span class="brand">${esc(brand.name)}</span>
      <span class="code">${esc(code)}</span>
      <span class="bar-meta"></span>
      <span class="bar-action"></span>
      <span class="bar-log" hidden></span>
    </button>
    <div class="body">
      <div class="join">
        <div class="qr"></div>
        <p class="hint">Other phones: open the camera and scan this, or open <b>${esc(address)}</b> and join table <b>${esc(code)}</b>.</p>
      </div>
      <div class="lay">
        <p class="lay-label">Lay the phones like this</p>
        <ol class="roster" aria-label="Phones in the order they lie"></ol>
      </div>
      <div class="cards games" role="radiogroup" aria-label="Game">
        ${shown.map((g) => `<button type="button" role="radio" class="card" data-g="${esc(g.id)}"><span class="card-name">${esc(g.name)}</span><span class="card-line">${esc(cardLine(g))}</span></button>`).join('')}
      </div>
      <div class="seg templates" role="radiogroup" aria-label="How the phones lie" hidden></div>
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
      <div class="install-row" hidden></div>
      <div class="diag"${maker ? '' : ' hidden'}>
        <button type="button" class="export">Export log</button>
        <button type="button" class="clear-log">Clear</button>
        <span class="diag-meta"></span>
      </div>
      <details class="other-session">
        <summary>Join a different table</summary>
        <form class="enter" aria-label="Join a different table">
          <input name="room" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="4" placeholder="Code" aria-label="Table code" />
          <button type="submit">Join</button>
        </form>
        <p class="other-refusal" role="status"></p>
      </details>
      <a class="privacy" href="${esc(PRIVACY)}" target="_blank" rel="noopener">Privacy</a>
    </div>`;
  root.querySelector('.qr')!.append(qr);
  fadeCorner(root);
  const bar = root.querySelector<HTMLButtonElement>('.bar')!;
  const barMeta = root.querySelector('.bar-meta')!;
  const barAction = root.querySelector('.bar-action')!;
  const gameSeg = root.querySelector<HTMLElement>('.games')!;
  const seg = root.querySelector<HTMLElement>('.templates')!;
  const chips = root.querySelector<HTMLElement>('.chips')!;
  const roles = root.querySelector<HTMLElement>('.roles')!;
  const players = root.querySelector<HTMLOListElement>('.players')!;
  const start = root.querySelector<HTMLButtonElement>('.start')!;
  const end = root.querySelector<HTMLButtonElement>('.end')!;
  const reason = root.querySelector('.reason')!;
  const barLog = root.querySelector<HTMLElement>('.bar-log')!;
  const log = root.querySelector<HTMLOListElement>('.log')!;
  const roster = root.querySelector<HTMLOListElement>('.roster')!;
  const installRow = root.querySelector<HTMLElement>('.install-row')!;
  wireOffer(installRow, o.install);

  const setOpen = (open: boolean) => {
    if (open) root.dataset['open'] = '';
    else delete root.dataset['open'];
    bar.setAttribute('aria-expanded', String(open));
    barAction.textContent = open ? 'Hide' : 'Setup';
  };
  bar.addEventListener('click', () => {
    setOpen(!('open' in root.dataset));
    onToggle();
  });
  // The session log records in both modes; its export and clear are a maker's.
  if (maker) wireDiagnostics(root, o.log);
  // This phone's sound: the bar unfolds the sheet over a running Game, so it is at hand during a Match too.
  root.querySelector('.other-session')!.before(soundSwitch(o.sound));
  // Joining a different Session means leaving this one: the page reopens as a Peer of that Session. This Session's own
  // code is refused in words (`otherSession`): the page stays, and so does every Peer of it.
  const other = root.querySelector<HTMLDetailsElement>('.other-session')!;
  const enter = root.querySelector<HTMLFormElement>('.enter')!;
  const roomInput = enter.elements.namedItem('room') as HTMLInputElement;
  const otherRefusal = root.querySelector<HTMLElement>('.other-refusal')!;
  other.addEventListener('toggle', () => {
    if (other.open) roomInput.focus();
  });
  roomInput.addEventListener('input', () => {
    roomInput.value = sessionCode(roomInput.value);
    otherRefusal.textContent = '';
  });
  enter.addEventListener('submit', (e) => {
    e.preventDefault();
    const to = otherSession(roomInput.value, code);
    if (to === undefined) return;
    if ('refusal' in to) otherRefusal.textContent = to.refusal;
    else location.assign(`?room=${to.code}`);
  });
  /** The Game Start starts: the lobby's pick, saved across a reload of the Host's page, if this phone offers it, else Pong (`firstPick`). */
  let game = firstPick(shown, lobby.picked)!;
  lobby.setGame(game);
  gameSeg.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-g]');
    if (!btn) return;
    game = shown.find((g) => g.id === btn.dataset['g']) ?? game;
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
  /** The Game whose templates the picker offers. */
  let segGame = '';
  let shownLog: Play['log'] | undefined;
  /** Whether another phone was ready at the last render, and whether one becoming ready has folded the sheet yet. */
  let peerWasReady = false;
  let foldedForPeer = false;
  setOpen(true);

  const render = () => {
    const { layout, match } = lobby;
    // The sheet folds away while the Host's Tile shows the Game and stays folded after: the result card offers what comes next.
    if (play.running !== wasRunning) {
      wasRunning = play.running;
      // Folded during a Match the bar is a corner pill (index.html `.sheet[data-playing]`).
      if (play.running) {
        setOpen(false);
        root.dataset['playing'] = '';
      } else delete root.dataset['playing'];
    }
    // The first other phone to become ready in the lobby folds the sheet to its bar, so this phone's own number shows
    // too; only once, so a person who opens the sheet again keeps it open.
    const peerReady = session.roster().some((e) => e.present && e.sync.synced && e.info.deviceId !== session.self.deviceId);
    if (peerReady && !peerWasReady && !foldedForPeer && !match) {
      foldedForPeer = true;
      setOpen(false);
    }
    peerWasReady = peerReady;
    const placed = layout?.devices.length ?? 0;
    const faults = maker ? play.log.filter((l) => l.kind === 'fault').length : 0;
    const running = games.find((g) => g.id === lobby.game) ?? game;
    barMeta.textContent = play.running
      ? `${running.name} · ${play.paused ? 'paused' : 'playing'}${faults ? ` · ${faults} fault${faults === 1 ? '' : 's'}` : ''}`
      : `${placed} phone${placed === 1 ? '' : 's'}${layout ? ` · ${TEMPLATE_WORDS[layout.template]}` : ''}`;
    gameSeg.querySelectorAll<HTMLButtonElement>('button[data-g]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset['g'] === (match ? running : game).id));
      b.disabled = match !== undefined;
    });
    // The templates the Game names (the lobby lays the phones in the first), offered only when there is a choice.
    const offered = templatesOf(game);
    if (game.id !== segGame) {
      segGame = game.id;
      seg.innerHTML = offered.map((t) => `<button type="button" role="radio" data-t="${t}">${TEMPLATE_WORDS[t][0]!.toUpperCase()}${TEMPLATE_WORDS[t].slice(1)}</button>`).join('');
    }
    seg.hidden = offered.length < 2;
    seg.querySelectorAll<HTMLButtonElement>('button[data-t]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset['t'] === layout?.template));
      b.disabled = match !== undefined;
    });
    // Phones in hand only for a Game that takes them.
    roles.hidden = game.controllers.max === 0;
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
    // A refusal is a warning; the last Match is news.
    reason.classList.toggle('last', !refusal);
    // The install offer's row (`installOffer`): for good after this Device's first finished Match, unless installed.
    const pitch = o.install.offer().row;
    installRow.hidden = !pitch;
    if (pitch && !installRow.hasChildNodes()) installRow.innerHTML = offerHtml(pitch);

    // The game log, in Maker mode: its newest line on the folded bar while a Match runs, every line in the sheet.
    const newest = play.log.at(-1);
    barLog.hidden = !maker || !play.running || !newest;
    if (maker && play.log !== shownLog) {
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
              ? `<input type="text" data-player="${esc(p.playerId)}" value="${esc(p.name)}"${inColour((match?.players ?? lobby.players).findIndex((x) => x.playerId === p.playerId))} maxlength="24" autocomplete="off" spellcheck="false" aria-label="Player ${n} name"${match ? ' disabled' : ''}><span class="meta">${where}</span>`
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
      if (e?.link === 'weak') return `${statusDot('warn')} weak connection`;
      const synced = e?.sync.synced === true;
      // Players see the dot, and "connecting" until the phone's clock is in; a maker sees the clock figures.
      if (!maker) return `${statusDot(synced ? 'ok' : 'wait')}${synced ? '' : ' connecting'}`;
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
      const seat = lobby.players.findIndex((p) => p.deviceId === d.id);
      const meta = [placementHint(layout!, i), seat >= 0 && `<span${inColour(seat)}>${esc(lobby.players[seat]!.name)}</span>`, late(d.id)].filter(Boolean).join(' · ');
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
  return {
    render,
    get open() {
      return 'open' in root.dataset;
    },
    unfold() {
      setOpen(true);
      onToggle();
    },
  };
}

/** The ◀ (towards the first Tile) or ▶ (towards the last) of a move button. */
function arrow(delta: -1 | 1): string {
  return `<svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="${delta < 0 ? 'M8.5 1v10L1.5 6z' : 'M1.5 1v10l7-5z'}"/></svg>`;
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
