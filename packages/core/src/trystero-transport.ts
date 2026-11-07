import { joinRoom, selfId, type JsonValue, type NostrRoomConfig, type Room } from 'trystero';
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
}

/**
 * All channels are multiplexed over one Trystero action so every peer has the
 * action registered before any message can arrive.
 */
export class TrysteroTransport implements Transport {
  readonly selfId: PeerId = selfId;
  private readonly listeners = new Listeners();
  private readonly room: Room;
  private readonly action;

  constructor(opts: TrysteroOptions) {
    const config: NostrRoomConfig = { appId: opts.appId };
    if (opts.password !== undefined) config.password = opts.password;
    this.room = joinRoom(config, opts.roomId);
    this.action = this.room.makeAction<JsonValue>('mgc');
    this.action.onMessage = (env, { peerId }) => {
      if (isEnvelope(env)) this.listeners.dispatch(env.c, env.d, peerId);
    };
    this.room.onPeerJoin = (id) => this.listeners.join.forEach((h) => h(id));
    this.room.onPeerLeave = (id) => this.listeners.leave.forEach((h) => h(id));
  }

  send(channel: string, data: unknown, to?: PeerId): void {
    const env: Envelope = { c: channel, d: data as JsonValue };
    void (to === undefined ? this.action.send(env) : this.action.send(env, { target: to }));
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
  close(): void {
    void this.room.leave();
  }
}
