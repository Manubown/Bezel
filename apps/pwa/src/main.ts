import { TrysteroTransport, hostSession, joinSession, type DeviceId } from '@mgc/core';
import { inProcessLink, runMatch, type MatchHandle, type MatchInfo, type MatchResult, type NetFrame } from '@mgc/sdk';
import { claimDeviceId, claimPlayerId, deviceInfo, pageZoom } from './device';
import { GAMES } from './games';
import { LOG_LINES, logLineOf } from './gamelog';
import { openHud, type Play } from './hud';
import { openLobby, sessionLobbyStore } from './lobby';
import { describePause, pauseOnDeviceLoss, type PauseNotice } from './pause';
import { drawMetronome, startCanvasLoop } from './metronome';
import { createRecorder } from './recorder';
import { RECONNECTING, REJOIN_GRACE_MS, decideRejoin, linkLostDetail, type Rejoin } from './rejoin';
import { describeClose } from './result';
import { drawPreview } from './scene';
import { awake, keepAwake } from './wake';

const APP_ID = 'mobilegameconnect';
/** Match frames between Devices; the SDK never sees the channel. */
const MATCH_CHANNEL = 'match';
// No 0/O/1/I/L: codes stay readable when typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** sessionStorage: the room this tab hosts; a reloaded Host keeps its code, so its Peers find it again. */
const HOST_ROOM_KEY = 'mgc.hostRoom';
/**
 * `?turn` adds a TURN relay to the ICE servers (Open Relay's public test servers; the credentials are
 * public by design). For networks where the direct path dies (live test 1: iPhones on a Personal
 * Hotspot); a relay adds latency, so it is opt-in and the QR carries the flag to every Peer.
 */
const TURN_SERVERS: RTCIceServer[] = [
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];

const stage = document.getElementById('stage') as HTMLCanvasElement;
/** A running Match's view: a positioned layer over the stage. */
const gameLayer = document.getElementById('game') as HTMLElement;
const hudRoot = document.getElementById('hud') as HTMLElement;

function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** The code this tab hosts: the one it hosted before a reload, else a new one. */
function hostRoomCode(): string {
  const code = sessionStorage.getItem(HOST_ROOM_KEY) ?? newRoomCode();
  sessionStorage.setItem(HOST_ROOM_KEY, code);
  return code;
}

/**
 * Transport → Session → lobby → Match → lobby. The Host's Start freezes a
 * Match in the lobby; every Device in it runs its part through the SDK, the
 * Host's own Tile as an ordinary view; when the Match closes, every Device is
 * back in the lobby. A Device that joins meanwhile waits there.
 */
async function start(): Promise<void> {
  const deviceId = await claimDeviceId();
  const self = deviceInfo(deviceId);
  const params = new URLSearchParams(location.search);
  const room = params.get('room')?.toUpperCase();
  const code = room ?? hostRoomCode();
  const turn = params.has('turn');
  // The session log: every event this page sees, kept across reloads, exported from the HUD.
  let sharedNow = (): number => performance.now();
  const rec = createRecorder({ now: () => sharedNow(), deviceId, role: room ? 'peer' : 'host', code, awake });
  rec.log('device', {
    ua: navigator.userAgent,
    platform: self.name,
    pxPerMm: self.pxPerMm,
    zoom: pageZoom(),
    viewport: { w: self.width, h: self.height },
    screen: { w: screen.width, h: screen.height },
    dpr: self.dpr,
    touchPoints: navigator.maxTouchPoints,
    cores: navigator.hardwareConcurrency,
    standalone: matchMedia('(display-mode: standalone)').matches,
    url: location.href,
    turn,
  });
  rec.observe();
  // The screen stays on from the first tap on the page, lobby and Match alike, for the page's lifetime (D11).
  keepAwake();
  // Phones are measured upright. The lock only works installed/fullscreen; in a browser tab index.html's `#rotate` overlay asks instead.
  (screen.orientation as ScreenOrientation & { lock?(o: string): Promise<void> }).lock?.('portrait').catch(() => {});
  const trystero = new TrysteroTransport({ appId: APP_ID, roomId: code, ...(turn && { turnConfig: TURN_SERVERS }) });
  const transport = rec.transport(trystero, () => trystero.connections());
  const session = room ? joinSession(transport, self) : hostSession(transport, self);
  sharedNow = () => session.clock.now();
  // Dev only: the console (and a browser smoke) can cut this page's connections with `__mgc.transport.reset()`.
  if (import.meta.env.DEV) Object.assign(window, { __mgc: { transport, session } });
  const lobby = openLobby(session, self.pxPerMm, claimPlayerId(deviceId), room ? undefined : sessionLobbyStore(code));
  const host = () => session.roster()[0]?.info.deviceId;
  // Connectivity and clock: the roster as it changes (status, who is present, each Device's rtt/offset).
  let rosterKey = '';
  session.onChange(() => {
    const roster = session.roster().map((e) => ({ deviceId: e.info.deviceId, name: e.info.name, present: e.present, ...e.sync }));
    const key = JSON.stringify([session.status, roster]);
    if (key === rosterKey) return;
    rosterKey = key;
    rec.log('roster', { status: session.status, roster });
  });
  session.onDeviceLost((id) => rec.log('device-lost', { deviceId: id }));
  session.onDeviceBack((id) => rec.log('device-back', { deviceId: id }));
  rec.links(session);
  // The lobby: the Match it froze (the whole MatchInfo once), and the Game it names.
  let loggedMatch: string | undefined;
  lobby.onChange(() => {
    const { match } = lobby;
    if (match?.matchId === loggedMatch) return;
    loggedMatch = match?.matchId;
    if (match) rec.log('match', { game: lobby.game, template: lobby.layout?.template, match });
    else rec.log('lobby', {});
  });

  const play: Play = { running: false, paused: undefined, stopped: undefined, last: undefined, log: [] };
  /** The Match running on this Device: `host` is the Session's Host when it began; `stop` closes it, `detail` replacing the runtime's words on the card. */
  let current: { matchId: string; handle: MatchHandle; host: DeviceId | undefined; stop(reason: 'aborted' | 'link-lost', detail?: string): void } | undefined;
  /** A Device runs a Match once: after it closed here, it is not rejoined, unless it closed because the Session dropped. */
  let joined: string | undefined;
  /** The running Match's pause as its runtime last reported it. */
  let matchPause: PauseNotice | undefined;
  /** `current` rides out a reconnect (`rejoin.ts`): from its first `keep` until the `hello` or the close, and the grace timer runs as long. */
  let rejoining = false;
  let grace: number | undefined;
  let graceExpired = false;
  const endRejoin = (): void => {
    rejoining = false;
    clearTimeout(grace);
    grace = undefined;
    graceExpired = false;
  };
  const hud = await openHud(hudRoot, { session, lobby, code, games: GAMES.map((g) => g.manifest), play, abort: () => current?.handle.stop('aborted'), log: rec });
  /** At most one HUD render per animation frame for the game log: a game may log on every frame. */
  let logRender = 0;
  const renderLog = (): void => {
    logRender ||= requestAnimationFrame(() => {
      logRender = 0;
      hud.render();
    });
  };

  const begin = (match: MatchInfo): void => {
    joined = match.matchId;
    const game = GAMES.find((g) => g.manifest.id === lobby.game);
    if (!game) {
      console.error(`This phone has no Game ${lobby.game ?? '(none named)'}: it sits Match ${match.matchId} out`);
      return;
    }
    play.running = true;
    play.paused = undefined;
    matchPause = undefined;
    play.stopped = undefined;
    play.log = [];
    gameLayer.hidden = false;
    let result: MatchResult | undefined;
    /** The card's detail when this Device stopped the Match for a reason its runtime cannot name (`linkLostDetail`). */
    let said: string | undefined;
    // Who sits where in the Match: a pause names the lost Device's Player.
    const seated = new Map(match.players.flatMap((p) => (p.deviceId === undefined ? [] : [[p.deviceId, p.name] as const])));
    let unfollow = (): void => {};
    const handle = runMatch({
      link: inProcessLink(() => Promise.resolve({ default: game })),
      match,
      self: { deviceId, pxPerMm: self.pxPerMm, mount: gameLayer },
      now: () => session.clock.now(),
      // A Peer's frames are for the Host alone; the Host's go where its runtime says.
      send: (frame, to) => session.send(MATCH_CHANNEL, frame, session.role === 'host' ? to : host()),
      onEvent: (e) => {
        const name = game.manifest.name;
        if (e.t === 'fault') console.warn(`${name}: fault in ${e.where}: ${e.message}`, ...(e.stack ? [`\n${e.stack}`] : []));
        if (e.t === 'log') console.log(`${name} ${e.side}:`, ...e.args);
        if (e.t === 'view-closed' || e.t === 'closed') console.info(`${name}: ${e.t === 'closed' ? 'match' : 'this phone’s view'} closed (${e.reason}): ${e.detail}`);
        const { t: kind, ...detail } = e;
        rec.log(`match:${kind}`, { matchId: match.matchId, ...detail });
        const line = logLineOf(e);
        if (line) play.log = [...play.log, line].slice(-LOG_LINES);
        if (e.t === 'ended') result = e.result;
        if (e.t === 'paused' || e.t === 'resumed') {
          matchPause = e.t === 'paused' ? describePause(match, e.reason, seated) : undefined;
          // While reconnecting, `RECONNECTING` stays up until the `hello` (`follow`).
          if (!rejoining) play.paused = matchPause;
          hud.render();
        }
        if (e.t === 'view-closed') {
          play.stopped = { headline: 'The game stopped on this phone', detail: `${describeClose(e.reason, e.detail).headline} · the match goes on for the others` };
          hud.render();
        }
        if (e.t !== 'closed' || current?.matchId !== match.matchId) {
          if (line) renderLog();
          return;
        }
        unfollow();
        endRejoin();
        current = undefined;
        play.running = false;
        play.paused = undefined;
        matchPause = undefined;
        play.stopped = undefined;
        play.last = { reason: e.reason, detail: said ?? e.detail, players: match.players, ...(result && { result }) };
        gameLayer.hidden = true;
        lobby.close(); // the Host's reopens the lobby on every Device; on a Peer, a no-op
        hud.render();
      },
      authority: session.role === 'host',
    });
    current = {
      matchId: match.matchId,
      handle,
      host: host(),
      stop: (reason, detail) => {
        said = detail;
        handle.stop(reason);
      },
    };
    if (session.role === 'host') unfollow = pauseOnDeviceLoss(session, match, handle);
    hud.render();
  };

  const follow = (): void => {
    const { match } = lobby;
    const r: Rejoin = { status: session.status, lobbyMatchId: match?.matchId, currentMatchId: current?.matchId, rejoining, graceExpired, hostId: host(), matchHostId: current?.host };
    switch (decideRejoin(r)) {
      case 'keep':
        rejoining = true;
        // One grace per reconnect, from its first `keep`, however often the Session goes `syncing` and back meanwhile.
        grace ??= window.setTimeout(() => {
          graceExpired = true;
          follow();
        }, REJOIN_GRACE_MS);
        play.paused = RECONNECTING;
        hud.render();
        break;
      case 'hello':
        endRejoin();
        current?.handle.hello();
        // The Host answers with its pause, if any (a `paused` event when it differs); meanwhile the runtime's last word on it.
        play.paused = matchPause;
        hud.render();
        break;
      case 'stop-link-lost':
        current?.stop('link-lost', linkLostDetail(r));
        // Lost with the connection, not closed: when the Session finds the Host again, this Device rejoins it.
        joined = undefined;
        break;
      case 'stop-aborted':
        current?.stop('aborted');
        break;
      case 'none':
        break;
    }
    // Only once the Session is ready, so the Match runs on the Host's clock (a reloaded Peer gets the Match while syncing).
    if (!current && match && session.status === 'ready' && match.matchId !== joined && match.devices.some((d) => d.deviceId === deviceId)) begin(match);
  };
  lobby.onChange(follow);
  session.onChange(follow);
  session.onMessage(MATCH_CHANNEL, (data, from) => {
    // Down frames originate on the Host only; the runtimes check what they take.
    if (current && (session.role === 'host' || from === host())) current.handle.deliver(data as NetFrame, from);
  });

  startCanvasLoop(stage, (f) => {
    if (play.running) return; // the Game owns the screen
    if (session.status === 'ready' && lobby.layout && lobby.surface) drawPreview(f, lobby.surface, lobby.layout);
    else drawMetronome(f, session.clock.now(), session.status === 'ready');
  });
}

void start();
