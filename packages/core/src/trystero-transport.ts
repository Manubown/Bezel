import { joinRoom, selfId, type JsonValue, type MessageAction, type NostrRoomConfig, type Room } from 'trystero';
import { RelayEscalation } from './relay-escalation';
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
  /** Extra `RTCPeerConnection` configuration (transport policy, ...). `iceServers` here replaces Trystero's default STUN servers and `turnConfig`. */
  rtcConfig?: RTCConfiguration;
  /** TURN servers appended to the ICE servers, for networks where a direct path fails. */
  turnConfig?: RTCIceServer[];
  /** With `turnConfig`: after this many resets in a row whose connections did not last, later joins use the relay only. Omitted or without `turnConfig`: never. */
  relayAfter?: number;
  /** The transport switched between using every path and the relay only; `failures` is the streak that caused a switch to the relay. */
  onRelayOnly?(relayOnly: boolean, failures: number): void;
}

/** A constructor for Trystero's `rtcPolyfill` that records every connection it makes in `made`, dropping closed ones as it goes. */
function recording(made: Set<RTCPeerConnection>): typeof RTCPeerConnection {
  return class extends RTCPeerConnection {
    constructor(config?: RTCConfiguration) {
      super(config);
      for (const pc of made) if (pc.connectionState === 'closed') made.delete(pc);
      made.add(this);
    }
  };
}

/**
 * All channels are multiplexed over one Trystero action so every peer has the
 * action registered before any message can arrive.
 *
 * With `turnConfig` and `relayAfter`, a `RelayEscalation` decides on each `reset()` whether the
 * rejoin uses every path or the relay only (`iceTransportPolicy: 'relay'`).
 */
export class TrysteroTransport implements Transport {
  readonly selfId: PeerId = selfId;
  private readonly listeners = new Listeners();
  private readonly config: NostrRoomConfig;
  private readonly roomId: string;
  private readonly relay: RelayEscalation | null = null;
  private readonly onRelayOnly: ((relayOnly: boolean, failures: number) => void) | undefined;
  /** With relay escalation: the connections Trystero made for this transport that may still be open, including ones `getPeers()` does not list yet. */
  private readonly made = new Set<RTCPeerConnection>();
  /** Fires at the relay probe deadline. */
  private probe: ReturnType<typeof setTimeout> | undefined;
  private room!: Room;
  private action!: MessageAction<JsonValue>;
  private closed = false;

  constructor(opts: TrysteroOptions) {
    this.config = { appId: opts.appId };
    if (opts.password !== undefined) this.config.password = opts.password;
    if (opts.rtcConfig !== undefined) this.config.rtcConfig = opts.rtcConfig;
    if (opts.turnConfig !== undefined) this.config.turnConfig = opts.turnConfig;
    if (opts.turnConfig?.length && opts.relayAfter !== undefined) {
      this.relay = new RelayEscalation(opts.relayAfter);
      this.config.rtcPolyfill = recording(this.made);
    }
    this.onRelayOnly = opts.onRelayOnly;
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
   * Trystero keeps a left room's connections for about two minutes and hands every one it does not
   * see as closed or failed to a rejoin of the same app, even one whose data path died; closing them
   * first makes the rejoin negotiate new ones. The old room is muted first, so its late events cannot
   * reach the listeners. The new room finds its peers over the network, so the leaves reported here
   * always come before their joins.
   */
  reset(): void {
    if (this.closed) return;
    const peers = Object.keys(this.room.getPeers());
    const relay = this.relay;
    const was = relay?.mode;
    const mode = relay?.reset(performance.now());
    this.rejoin(mode !== was);
    for (const id of peers) this.listeners.leave.forEach((h) => h(id));
    if (relay && mode !== was) this.onRelayOnly?.(true, relay.failures);
  }
  close(): void {
    this.closed = true;
    clearTimeout(this.probe);
    void this.room.leave();
  }

  /**
   * Leaves the room and joins it again in the current mode. A switch of mode also closes every other
   * connection this transport made (still in Trystero's handshake, or dropped by the room but kept
   * for the app): Trystero would hand a live one to the new room in place of a new one made with the
   * new configuration.
   */
  private rejoin(switched: boolean): void {
    const old = this.room;
    old.onPeerJoin = null;
    old.onPeerLeave = null;
    this.action.onMessage = null;
    for (const pc of Object.values(old.getPeers())) pc.close();
    if (switched) {
      for (const pc of this.made) pc.close();
      this.made.clear();
    }
    void old.leave();
    this.join();
    this.arm();
  }
  private join(): void {
    const config = this.relay?.mode === 'relay' ? { ...this.config, rtcConfig: { ...this.config.rtcConfig, iceTransportPolicy: 'relay' as const } } : this.config;
    this.room = joinRoom(config, this.roomId);
    this.action = this.room.makeAction<JsonValue>('mgc');
    this.action.onMessage = (env, { peerId }) => {
      if (isEnvelope(env)) this.listeners.dispatch(env.c, env.d, peerId);
    };
    this.room.onPeerJoin = (id) => {
      if (this.relay) {
        this.relay.joined(id, performance.now());
        this.arm();
      }
      this.listeners.join.forEach((h) => h(id));
    };
    this.room.onPeerLeave = (id) => {
      if (this.relay) {
        this.relay.left(id, performance.now());
        this.arm();
      }
      this.listeners.leave.forEach((h) => h(id));
    };
  }
  /** Sets the probe timer to the policy's deadline, or clears it. */
  private arm(): void {
    clearTimeout(this.probe);
    const at = this.relay?.deadline ?? null;
    this.probe = at === null ? undefined : setTimeout(() => this.expire(), Math.max(0, at - performance.now()));
  }
  /** At the probe deadline the relay did not answer: no peer is up, so rejoin on every path without leaves to report. */
  private expire(): void {
    this.probe = undefined;
    if (this.closed || !this.relay) return;
    if (!this.relay.expire(performance.now())) return this.arm();
    this.rejoin(true);
    this.onRelayOnly?.(false, 0);
  }
}
