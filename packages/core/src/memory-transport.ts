import { Listeners, type PeerId, type Transport } from './transport';

export interface LatencyModel {
  /** One-way delay in ms for a message from `from` to `to`. */
  (from: PeerId, to: PeerId): number;
}

/** A severed pair; `channel` undefined = every channel. */
interface Cut {
  readonly a: PeerId;
  readonly b: PeerId;
  readonly channel: string | undefined;
}

/** A node's registration: a fresh one per connect and reconnect. */
interface Registration {
  readonly node: MemoryTransport;
}

/**
 * In-process hub connecting MemoryTransports with simulated one-way latency.
 * Uses setTimeout so tests can drive it with fake timers. A message travels
 * between two registrations: it is dropped if either end leaves or reconnects
 * while it is in flight.
 */
export class MemoryHub {
  private readonly nodes = new Map<PeerId, Registration>();
  private cuts: Cut[] = [];

  constructor(private readonly latency: LatencyModel = () => 0) {}

  connect(id: PeerId): MemoryTransport {
    const node = new MemoryTransport(id, this);
    this.register(node);
    return node;
  }

  disconnect(id: PeerId): void {
    if (!this.nodes.delete(id)) return;
    for (const { node } of this.nodes.values()) node.listeners.leave.forEach((h) => h(id));
  }

  /**
   * `node` drops every connection and is found again as the same instance, so its listeners stay:
   * it sees each of the others leave, they see it leave, then all see the joins. Its severed pairs
   * heal (the new connections pass). A no-op for a node that is closed or replaced, then or meanwhile.
   */
  reconnect(node: MemoryTransport): void {
    const id = node.selfId;
    const current = (): boolean => this.nodes.get(id)?.node === node;
    if (!current()) return;
    for (const other of this.peersOf(id)) node.listeners.leave.forEach((h) => h(other));
    if (!current()) return;
    this.disconnect(id);
    this.cuts = this.cuts.filter((c) => c.a !== id && c.b !== id);
    this.register(node);
  }

  /** A dead link: drops every message between `a` and `b` (on `channel` only, if given) both ways, silently, with no leave. */
  sever(a: PeerId, b: PeerId, channel?: string): void {
    this.cuts.push({ a, b, channel });
  }

  /** Undoes every `sever` between `a` and `b`. A `reconnect` of either does it too. */
  heal(a: PeerId, b: PeerId): void {
    this.cuts = this.cuts.filter((c) => !((c.a === a && c.b === b) || (c.a === b && c.b === a)));
  }

  peersOf(id: PeerId): PeerId[] {
    return [...this.nodes.keys()].filter((p) => p !== id);
  }

  deliver(from: PeerId, to: PeerId | undefined, channel: string, data: unknown): void {
    const sender = this.nodes.get(from);
    if (!sender) return;
    const targets = to === undefined ? this.peersOf(from) : [to];
    for (const t of targets) {
      const receiver = this.nodes.get(t);
      if (!receiver || this.severed(from, t, channel)) continue;
      setTimeout(() => {
        // Re-check: either end may have left or reconnected, or the link died, while in flight.
        if (this.nodes.get(from) !== sender || this.nodes.get(t) !== receiver || this.severed(from, t, channel)) return;
        receiver.node.listeners.dispatch(channel, data, from);
      }, this.latency(from, t));
    }
  }

  private register(node: MemoryTransport): void {
    const id = node.selfId;
    const existing = [...this.nodes.values()];
    this.nodes.set(id, { node });
    for (const { node: other } of existing) {
      other.listeners.join.forEach((h) => h(id));
      node.listeners.join.forEach((h) => h(other.selfId));
    }
  }

  private severed(from: PeerId, to: PeerId, channel: string): boolean {
    return this.cuts.some(
      (c) => ((c.a === from && c.b === to) || (c.a === to && c.b === from)) && (c.channel === undefined || c.channel === channel),
    );
  }
}

export class MemoryTransport implements Transport {
  readonly listeners = new Listeners();

  constructor(
    readonly selfId: PeerId,
    private readonly hub: MemoryHub,
  ) {}

  send(channel: string, data: unknown, to?: PeerId): void {
    this.hub.deliver(this.selfId, to, channel, data);
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
    return this.hub.peersOf(this.selfId);
  }
  reset(): void {
    this.hub.reconnect(this);
  }
  close(): void {
    this.hub.disconnect(this.selfId);
  }
}
