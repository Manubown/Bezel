import { RELAY_STABLE_MS } from './relay-escalation';

/**
 * A Device's own addresses in ICE are its `typ host` candidates: the addresses of its network
 * interfaces, as opposed to what a STUN server saw (`srflx`) or a TURN relay lent it (`relay`).
 * "Own address" here, because "host" already names the Device that owns the Session.
 */
export function isOwnAddress(candidate: string): boolean {
  return / typ host(?: |$)/.test(candidate);
}

/** `sdp` without the candidate lines of the Device's own addresses. */
export function withoutOwnAddresses(sdp: string): string {
  return sdp.replace(/^a=candidate:.* typ host(?: .*)?\r?\n/gm, '');
}

/**
 * When a Device stops signaling its own addresses. Pure and timer-free: every call takes the
 * current time in ms (any monotonic clock).
 *
 * A connection that ends within `RELAY_STABLE_MS` of coming up did not work; one that lived longer
 * restarts the count. After `after` such endings in a row the policy is `active`, and stays so:
 * the network that caused them does not change while the page lives.
 */
export class OwnAddressWithholding {
  private readonly after: number;
  private streak = 0;
  private on = false;
  /** Join time of each connection that is up. */
  private readonly open = new Map<string, number>();

  /** `after`: short-lived connections in a row that switch it on; `<= 0` or not finite never does. */
  constructor(after: number) {
    this.after = after > 0 && Number.isFinite(after) ? after : Infinity;
  }

  get active(): boolean {
    return this.on;
  }
  /** The streak of short-lived connections; once active, the one that caused it. */
  get failures(): number {
    return this.streak;
  }

  /** A connection to `id` came up. */
  joined(id: string, now: number): void {
    if (!this.open.has(id)) this.open.set(id, now);
  }
  /** The connection to `id` ended. Returns whether that switched withholding on. */
  left(id: string, now: number): boolean {
    const since = this.open.get(id);
    if (since === undefined) return false;
    this.open.delete(id);
    if (this.on) return false;
    if (now - since >= RELAY_STABLE_MS) this.streak = 0;
    else if (++this.streak >= this.after) this.on = true;
    return this.on;
  }
  /** The transport dropped every connection itself: none of them says anything about the network. */
  reset(): void {
    this.open.clear();
  }
}

/**
 * A constructor for Trystero's `rtcPolyfill` whose connections signal the Device's own addresses
 * only when `withhold()` is false at the moment the remote description is set, which is when a
 * connection made ahead of time gets its peer.
 *
 * Own addresses never leave in the session description: `localDescription` reads without them.
 * As trickled candidates they are held back until the remote description is set, then passed on or
 * dropped. A peer that never learns them still finds this Device: it sees where this Device's
 * connectivity checks come from (a peer-reflexive candidate).
 */
export function withholdingOwn(Base: typeof RTCPeerConnection, withhold: () => boolean): typeof RTCPeerConnection {
  return class extends Base {
    /** Own-address candidates gathered before the decision; null once it is made. */
    private held: RTCPeerConnectionIceEvent[] | null = [];
    private dropped = false;
    private handler: ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => unknown) | null = null;

    constructor(config?: RTCConfiguration) {
      super(config);
      this.addEventListener('icecandidate', (ev) => {
        if (ev.candidate && isOwnAddress(ev.candidate.candidate)) {
          if (this.held) return void this.held.push(ev);
          if (this.dropped) return;
        }
        this.handler?.call(this, ev);
      });
    }

    override get onicecandidate(): ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => unknown) | null {
      return this.handler;
    }
    override set onicecandidate(handler: ((this: RTCPeerConnection, ev: RTCPeerConnectionIceEvent) => unknown) | null) {
      this.handler = handler;
    }

    override get localDescription(): RTCSessionDescription | null {
      const own = super.localDescription;
      if (!own) return null;
      const init = { type: own.type, sdp: withoutOwnAddresses(own.sdp) };
      return { ...init, toJSON: () => init };
    }

    override async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
      await super.setRemoteDescription(description);
      const held = this.held;
      if (!held) return;
      this.held = null;
      this.dropped = withhold();
      if (!this.dropped) for (const ev of held) this.handler?.call(this, ev);
    }
  };
}
