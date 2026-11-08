import { joinRoom, selfId, type JsonValue, type MessageAction, type NostrRoomConfig, type Room } from 'trystero';
import { Listeners, type PeerId, type Transport } from './transport';

/** Wire envelope: `{ c: channel, d: payload }`. Payloads must be JSON. */
type Envelope = { c: string; d: JsonValue };

function isEnvelope(v: JsonValue): v is Envelope {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && typeof v['c'] === 'string' && 'd' in v;
}

export interface TrysteroOptions {
  appId: string;
  roomId: string;
  /** Optional shared secret; peers without it cannot join. */
  password?: string;
  /** Extra `RTCPeerConnection` configuration (ICE servers, transport policy); Trystero's default STUN servers stay. */
  rtcConfig?: RTCConfiguration;
  /** TURN servers appended to the ICE servers, for networks where a direct path fails. */
  turnConfig?: RTCIceServer[];
}

/**
 * All channels are multiplexed over one Trystero action so every peer has the
 * action registered before any message can arrive.
 */
export class TrysteroTransport implements Transport {
  readonly selfId: PeerId = selfId;
  private readonly listeners = new Listeners();
  private readonly config: NostrRoomConfig;
  private readonly roomId: string;
  private room!: Room;
  private action!: MessageAction<JsonValue>;
  private closed = false;

  constructor(opts: TrysteroOptions) {
    this.config = { appId: opts.appId };
    if (opts.password !== undefined) this.config.password = opts.password;
    if (opts.rtcConfig !== undefined) this.config.rtcConfig = opts.rtcConfig;
    if (opts.turnConfig !== undefined) this.config.turnConfig = opts.turnConfig;
    this.roomId = opts.roomId;
    this.join();
  }

  send(channel: string, data: unknown, to?: PeerId): void {
    const env: Envelope = { c: channel, d: data as JsonValue };
    // A channel that dies mid-send rejects; that peer's leave reaches the Session on its own.
    (to === undefined ? this.action.send(env) : this.action.send(env, { target: to })).catch(() => {});
  }
  onMessage(channel: string, handler: (data: unknown, from: PeerId) => void): () => void {
    return this.listeners.onMessage(channel, handler);
  }
  onPeerJoin(handler: (id: PeerId) => void): () => void {
    return this.listeners.add(this.listeners.join, handler);
  }
  onPeerLeave(handler: (id: PeerId) => void): () => void {
    return this.listeners.add(this.listeners.leave, handler);
  }
  peers(): PeerId[] {
    return Object.keys(this.room.getPeers());
  }
  /** The live `RTCPeerConnection` per peer, for diagnostics (ICE state, selected candidate pair). */
  connections(): Record<PeerId, RTCPeerConnection> {
    return this.room.getPeers();
  }
  /**
   * Trystero keeps a left room's connections for about two minutes and hands them to a rejoin of
   * the same app, dead or not; closing them first makes the rejoin negotiate new ones. The old
   * room is muted first, so its late events cannot reach the listeners. The new room finds its
   * peers over the network, so the leaves reported here always come before their joins.
   */
  reset(): void {
    if (this.closed) return;
    const old = this.room;
    const peers = Object.entries(old.getPeers());
    old.onPeerJoin = null;
    old.onPeerLeave = null;
    this.action.onMessage = null;
    for (const [, pc] of peers) pc.close();
    void old.leave();
    this.join();
    for (const [id] of peers) this.listeners.leave.forEach((h) => h(id));
  }
  close(): void {
    this.closed = true;
    void this.room.leave();
  }

  private join(): void {
    this.room = joinRoom(this.config, this.roomId);
    this.action = this.room.makeAction<JsonValue>('mgc');
    this.action.onMessage = (env, { peerId }) => {
      if (isEnvelope(env)) this.listeners.dispatch(env.c, env.d, peerId);
    };
    this.room.onPeerJoin = (id) => this.listeners.join.forEach((h) => h(id));
    this.room.onPeerLeave = (id) => this.listeners.leave.forEach((h) => h(id));
  }
}
