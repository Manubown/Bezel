import { TrysteroTransport, hostSession, joinSession, type DeviceInfo } from '@mgc/core';
import { Surface, TEMPLATE_IDS, buildLayout, isLayout, type Layout, type TemplateId } from '@mgc/layout';
import QRCode from 'qrcode';
import { claimDeviceId, deviceInfo, deviceSize } from './device';
import { drawMetronome, startCanvasLoop } from './metronome';
import { drawScene } from './scene';

const APP_ID = 'mobilegameconnect';
/** Host → everyone: the current arrangement. */
const LAYOUT_CHANNEL = 'layout';
// No 0/O/1/I/L: codes stay readable when typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TEMPLATE_LABEL: Record<TemplateId, string> = { row: 'Row', column: 'Column', grid: 'Grid' };

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;

function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function keepAwakeOnFirstTap(): void {
  const request = () => {
    navigator.wakeLock?.request('screen').catch(() => undefined);
    window.removeEventListener('pointerdown', request);
  };
  window.addEventListener('pointerdown', request);
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

async function runHost(self: DeviceInfo): Promise<void> {
  const code = newRoomCode();
  const joinUrl = new URL(location.href);
  joinUrl.search = `?room=${code}`;
  const session = hostSession(new TrysteroTransport({ appId: APP_ID, roomId: code }), self);
  let template: TemplateId = 'row';
  let layout: Layout = buildLayout('row', [deviceSize(self)]);
  let surface = new Surface(layout.devices[0]!, self.pxPerMm);

  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, joinUrl.toString(), { width: 168, margin: 0, color: { dark: '#121212', light: '#f2f0ea' } });

  hud.className = 'sheet';
  hud.dataset['open'] = '';
  hud.innerHTML = `
    <button class="bar" type="button" aria-expanded="true">
      <span class="code">${code}</span>
      <span class="bar-meta"></span>
      <span class="bar-action">Hide</span>
    </button>
    <div class="body">
      <div class="join">
        <div class="qr"></div>
        <p class="hint">Scan to join, or open <b>${joinUrl.host}</b> and enter the code.</p>
      </div>
      <div class="seg" role="radiogroup" aria-label="Arrangement">
        ${TEMPLATE_IDS.map((t) => `<button type="button" role="radio" data-t="${t}" aria-checked="${t === template}">${TEMPLATE_LABEL[t]}</button>`).join('')}
      </div>
      <ol class="roster"></ol>
    </div>`;
  hud.querySelector('.qr')!.append(qr);
  const bar = hud.querySelector<HTMLButtonElement>('.bar')!;
  const barMeta = hud.querySelector('.bar-meta')!;
  const barAction = hud.querySelector('.bar-action')!;
  const roster = hud.querySelector<HTMLOListElement>('.roster')!;

  bar.addEventListener('click', () => {
    const open = !('open' in hud.dataset);
    if (open) hud.dataset['open'] = '';
    else delete hud.dataset['open'];
    bar.setAttribute('aria-expanded', String(open));
    barAction.textContent = open ? 'Hide' : 'Setup';
  });
  hud.querySelector('.seg')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-t]');
    if (!btn) return;
    template = btn.dataset['t'] as TemplateId;
    hud.querySelectorAll('button[data-t]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    relayout();
  });

  let layoutKey = '';
  /**
   * Rebuilds and publishes the layout only when present devices or template changed; clock reports
   * just re-render. Roster order is join order and survives a reconnect, so a returning phone gets its Tile back.
   */
  const relayout = () => {
    const sizes = session
      .roster()
      .filter((e) => e.present)
      .map((e) => deviceSize(e.info));
    const key = template + '|' + sizes.map((s) => `${s.id}:${s.w.toFixed(1)}x${s.h.toFixed(1)}`).join(',');
    if (key !== layoutKey) {
      layoutKey = key;
      layout = buildLayout(template, sizes);
      surface = new Surface(layout.devices[0]!, self.pxPerMm);
      session.send(LAYOUT_CHANNEL, layout);
    }
    render();
  };

  const render = () => {
    const entries = session.roster();
    const byId = new Map(entries.map((e) => [e.info.deviceId, e]));
    const placed = layout.devices.length;
    barMeta.textContent = `${placed} phone${placed === 1 ? '' : 's'} · ${TEMPLATE_LABEL[template]}`;
    const rows = layout.devices.map((d, i) => {
      if (i === 0) return `<li><span class="n">1</span><span class="who">This phone</span><span class="meta">${placementHint(layout, 0)}</span></li>`;
      const e = byId.get(d.id);
      const synced = e?.sync.synced === true;
      return (
        `<li><span class="n">${i + 1}</span><span class="who">${e?.info.name ?? d.id.slice(0, 6)}</span>` +
        `<span class="meta">${placementHint(layout, i)}</span>` +
        `<span class="sync">${statusDot(synced ? 'ok' : 'wait')} ${synced ? syncStats(e.sync) : 'syncing'}</span></li>`
      );
    });
    for (const e of entries) if (!e.present) rows.push(`<li class="pending"><span class="n">·</span><span class="who">${e.info.name}</span><span class="meta">disconnected</span></li>`);
    roster.innerHTML = rows.join('');
  };

  session.onChange(relayout);
  relayout();
  startCanvasLoop(canvas, (f) => drawScene(f, surface, layout, session.clock.now()));
}

function runPeer(code: string, self: DeviceInfo): void {
  const session = joinSession(new TrysteroTransport({ appId: APP_ID, roomId: code }), self);
  let layout: Layout | undefined;
  let surface: Surface | undefined;
  let index = -1;

  hud.className = 'strip';
  hud.innerHTML = `<span class="code">${code}</span><span class="state"></span><span class="meta"></span>`;
  const state = hud.querySelector('.state')!;
  const meta = hud.querySelector('.meta')!;

  const render = () => {
    const c = session.roster().find((e) => e.info.deviceId === session.self.deviceId)?.sync;
    if (session.status === 'searching') {
      state.innerHTML = `${statusDot('off')} Looking for the host`;
      meta.textContent = 'keep the host screen open';
    } else if (session.status === 'syncing') {
      state.innerHTML = `${statusDot('wait')} Syncing clocks`;
      meta.textContent = 'measuring the offset to the host';
    } else if (layout && index >= 0) {
      state.innerHTML = `${statusDot('ok')} Phone ${index + 1} of ${layout.devices.length}`;
      meta.textContent = `${placementHint(layout, index)} · ${syncStats(c)}`;
    } else {
      state.innerHTML = `${statusDot('ok')} Synced`;
      meta.textContent = `waiting for arrangement · ${syncStats(c)}`;
    }
  };

  const applyLayout = (l: Layout) => {
    index = l.devices.findIndex((d) => d.id === session.self.deviceId);
    const rect = l.devices[index];
    layout = l;
    surface = rect ? new Surface(rect, self.pxPerMm) : undefined;
    render();
  };

  session.onChange(render);
  session.onMessage(LAYOUT_CHANNEL, (data, from) => {
    if (from === session.roster()[0]?.info.deviceId && isLayout(data)) applyLayout(data);
  });
  render();
  startCanvasLoop(canvas, (f) => {
    const t = session.clock.now();
    if (session.status === 'ready' && layout && surface) drawScene(f, surface, layout, t);
    else drawMetronome(f, t, session.status === 'ready');
  });
}

async function start(): Promise<void> {
  keepAwakeOnFirstTap();
  const self = deviceInfo(await claimDeviceId());
  const room = new URLSearchParams(location.search).get('room')?.toUpperCase();
  if (room) runPeer(room, self);
  else await runHost(self);
}

void start();
