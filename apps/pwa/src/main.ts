import { TrysteroTransport, hostSession, joinSession } from '@mgc/core';
import pong from '@mgc/pong';
import { inProcessLink, runMatch, type MatchHandle, type MatchInfo, type MatchResult, type NetFrame } from '@mgc/sdk';
import { claimDeviceId, claimPlayerId, deviceInfo } from './device';
import { openHud, type Play } from './hud';
import { openLobby } from './lobby';
import { drawMetronome, startCanvasLoop } from './metronome';
import { drawPreview } from './scene';

const APP_ID = 'mobilegameconnect';
/** Match frames between Devices; the SDK never sees the channel. */
const MATCH_CHANNEL = 'match';
// No 0/O/1/I/L: codes stay readable when typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** The Game the Host's Start runs. */
const GAME = pong;
const link = inProcessLink(() => Promise.resolve({ default: GAME }));

const stage = document.getElementById('stage') as HTMLCanvasElement;
/** A running Match's view: a positioned layer over the stage. */
const gameLayer = document.getElementById('game') as HTMLElement;
const hudRoot = document.getElementById('hud') as HTMLElement;

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

/**
 * Transport → Session → lobby → Match → lobby. The Host's Start freezes a
 * Match in the lobby; every Device in it runs its part through the SDK, the
 * Host's own Tile as an ordinary view; when the Match closes, every Device is
 * back in the lobby. A Device that joins meanwhile waits there.
 */
async function start(): Promise<void> {
  keepAwakeOnFirstTap();
  const deviceId = await claimDeviceId();
  const self = deviceInfo(deviceId);
  const room = new URLSearchParams(location.search).get('room')?.toUpperCase();
  const code = room ?? newRoomCode();
  const transport = new TrysteroTransport({ appId: APP_ID, roomId: code });
  const session = room ? joinSession(transport, self) : hostSession(transport, self);
  const lobby = openLobby(session, self.pxPerMm, claimPlayerId(deviceId));
  const host = () => session.roster()[0]?.info.deviceId;

  const play: Play = { running: false, last: undefined };
  /** The Match running on this Device. */
  let current: { matchId: string; handle: MatchHandle } | undefined;
  /** A Device runs a Match once: after it closed here, it is not rejoined. */
  let joined: string | undefined;
  const hud = await openHud(hudRoot, { session, lobby, code, game: GAME.manifest, play, abort: () => current?.handle.stop('aborted') });

  const begin = (match: MatchInfo): void => {
    joined = match.matchId;
    play.running = true;
    gameLayer.hidden = false;
    let result: MatchResult | undefined;
    const handle = runMatch({
      link,
      match,
      self: { deviceId, pxPerMm: self.pxPerMm, mount: gameLayer },
      now: () => session.clock.now(),
      // A Peer's frames are for the Host alone; the Host's go where its runtime says.
      send: (frame, to) => session.send(MATCH_CHANNEL, frame, session.role === 'host' ? to : host()),
      onEvent: (e) => {
        if (e.t === 'fault') console.warn(`${GAME.manifest.name}: fault in ${e.where}: ${e.message}`);
        if (e.t === 'ended') result = e.result;
        if (e.t !== 'closed' || current?.matchId !== match.matchId) return;
        current = undefined;
        play.running = false;
        play.last = { reason: e.reason, players: match.players, ...(result && { result }) };
        gameLayer.hidden = true;
        lobby.close(); // the Host's reopens the lobby on every Device; on a Peer, a no-op
        hud.render();
      },
      authority: session.role === 'host',
    });
    current = { matchId: match.matchId, handle };
    hud.render();
  };

  lobby.onChange(() => {
    const { match } = lobby;
    // The Match went away under this Device: the Host closed it, or the Session ended.
    if (current && current.matchId !== match?.matchId) current.handle.stop(session.status === 'searching' ? 'link-lost' : 'aborted');
    if (!current && match && match.matchId !== joined && match.devices.some((d) => d.deviceId === deviceId)) begin(match);
  });
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
