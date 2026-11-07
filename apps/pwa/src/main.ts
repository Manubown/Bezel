import { TrysteroTransport, hostSession, joinSession } from '@mgc/core';
import pass from '@mgc/pass';
import pong from '@mgc/pong';
import { inProcessLink, runMatch, type MatchHandle, type MatchInfo, type MatchResult, type NetFrame } from '@mgc/sdk';
import { claimDeviceId, claimPlayerId, deviceInfo } from './device';
import { LOG_LINES, logLineOf } from './gamelog';
import { openHud, type Play } from './hud';
import { openLobby } from './lobby';
import { describePause, pauseOnDeviceLoss } from './pause';
import { drawMetronome, startCanvasLoop } from './metronome';
import { describeClose } from './result';
import { drawPreview } from './scene';
import { keepAwakeOnTouch } from './wake';

const APP_ID = 'mobilegameconnect';
/** Match frames between Devices; the SDK never sees the channel. */
const MATCH_CHANNEL = 'match';
// No 0/O/1/I/L: codes stay readable when typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** sessionStorage: the room this tab hosts; a reloaded Host keeps its code, so its Peers find it again. */
const HOST_ROOM_KEY = 'mgc.hostRoom';
/** The Games the Host can start (its HUD picks the first until told otherwise); every Device runs the one its lobby names. */
const GAMES = [pong, pass];

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
  const room = new URLSearchParams(location.search).get('room')?.toUpperCase();
  const code = room ?? hostRoomCode();
  const transport = new TrysteroTransport({ appId: APP_ID, roomId: code });
  const session = room ? joinSession(transport, self) : hostSession(transport, self);
  const lobby = openLobby(session, self.pxPerMm, claimPlayerId(deviceId));
  const host = () => session.roster()[0]?.info.deviceId;

  const play: Play = { running: false, paused: undefined, stopped: undefined, last: undefined, log: [] };
  /** The Match running on this Device. */
  let current: { matchId: string; handle: MatchHandle } | undefined;
  /** A Device runs a Match once: after it closed here, it is not rejoined, unless it closed because the Session dropped. */
  let joined: string | undefined;
  const hud = await openHud(hudRoot, { session, lobby, code, games: GAMES.map((g) => g.manifest), play, abort: () => current?.handle.stop('aborted') });
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
    play.stopped = undefined;
    play.log = [];
    gameLayer.hidden = false;
    // The screen stays on from the Match's first touch until it closes.
    const sleep = keepAwakeOnTouch();
    let result: MatchResult | undefined;
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
        const line = logLineOf(e);
        if (line) play.log = [...play.log, line].slice(-LOG_LINES);
        if (e.t === 'ended') result = e.result;
        if (e.t === 'paused' || e.t === 'resumed') {
          play.paused = e.t === 'paused' ? describePause(match, e.reason, seated) : undefined;
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
        sleep();
        current = undefined;
        play.running = false;
        play.paused = undefined;
        play.stopped = undefined;
        play.last = { reason: e.reason, detail: e.detail, players: match.players, ...(result && { result }) };
        gameLayer.hidden = true;
        lobby.close(); // the Host's reopens the lobby on every Device; on a Peer, a no-op
        hud.render();
      },
      authority: session.role === 'host',
    });
    current = { matchId: match.matchId, handle };
    if (session.role === 'host') unfollow = pauseOnDeviceLoss(session, match, handle);
    hud.render();
  };

  const follow = (): void => {
    const { match } = lobby;
    // The Match went away under this Device: the Host closed it, or the Session ended.
    if (current && current.matchId !== match?.matchId) {
      const dropped = session.status === 'searching';
      current.handle.stop(dropped ? 'link-lost' : 'aborted');
      // Lost with the connection, not closed: when the Session finds the Host again, this Device rejoins it.
      if (dropped) joined = undefined;
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
