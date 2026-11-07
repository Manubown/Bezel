import { Listeners, type PeerId, type Transport } from './transport';

export interface LatencyModel {
  /** One-way delay in ms for a message from `from` to `to`. */
  (from: PeerId, to: PeerId): number;
}

/**
 * In-process hub connecting MemoryTransports with simulated one-way latency.
 * Uses setTimeout so tests can drive it with fake timers.
 */
export class MemoryHub {
  private readonly nodes = new Map<PeerId, MemoryTransport>();

  constructor(private readonly latency: LatencyModel = () => 0) {}

  connect(id: PeerId): MemoryTransport {
    const node = new MemoryTransport(id, this);
    const existing = [...this.nodes.values()];
    this.nodes.set(id, node);
    for (const other of existing) {
      other.listeners.join.forEach((h) => h(id));
      node.listeners.join.forEach((h) => h(other.selfId));
    }
    return node;
  }

  disconnect(id: PeerId): void {
    if (!this.nodes.delete(id)) return;
    for (const other of this.nodes.values()) other.listeners.leave.forEach((h) => h(id));
  }

  peersOf(id: PeerId): PeerId[] {
    return [...this.nodes.keys()].filter((p) => p !== id);
  }

  deliver(from: PeerId, to: PeerId | undefined, channel: string, data: unknown): void {
    const targets = to === undefined ? this.peersOf(from) : [to];
    for (const t of targets) {
      const node = this.nodes.get(t);
      if (!node) continue;
      setTimeout(() => {
        // Re-check: node may have left while in flight.
        if (this.nodes.get(t) === node) node.listeners.dispatch(channel, data, from);
      }, this.latency(from, t));
    }
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
  close(): void {
    this.hub.disconnect(this.selfId);
  }
}
