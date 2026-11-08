export type PeerId = string;

export type MessageHandler = (data: unknown, from: PeerId) => void;

/**
 * Minimal peer-to-peer message transport. Channels are multiplexed string
 * labels; data must be structured-cloneable (JSON-ish). Delivery is reliable
 * and ordered per channel. Implementations: TrysteroTransport (WebRTC),
 * MemoryTransport (tests).
 */
export interface Transport {
  readonly selfId: PeerId;
  send(channel: string, data: unknown, to?: PeerId): void;
  onMessage(channel: string, handler: MessageHandler): () => void;
  onPeerJoin(handler: (id: PeerId) => void): () => void;
  onPeerLeave(handler: (id: PeerId) => void): () => void;
  peers(): PeerId[];
  /**
   * Forget every connection and rediscover: the others see a leave, then a join, for this id.
   * This side sees a leave for each of them, then a join as each is found again. A no-op after `close()`.
   */
  reset(): void;
  close(): void;
}

/** Shared listener bookkeeping for transport implementations. */
export class Listeners {
  private readonly byChannel = new Map<string, Set<MessageHandler>>();
  readonly join = new Set<(id: PeerId) => void>();
  readonly leave = new Set<(id: PeerId) => void>();

  onMessage(channel: string, handler: MessageHandler): () => void {
    let set = this.byChannel.get(channel);
    if (!set) {
      set = new Set();
      this.byChannel.set(channel, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  dispatch(channel: string, data: unknown, from: PeerId): void {
    this.byChannel.get(channel)?.forEach((h) => h(data, from));
  }

  add<T>(set: Set<T>, handler: T): () => void {
    set.add(handler);
    return () => set.delete(handler);
  }
}
