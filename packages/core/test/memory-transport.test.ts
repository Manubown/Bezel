import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryHub, type MemoryTransport } from '../src';

/** Every join and leave each transport reports, as `<self>: <event> <id>`. */
function events(...ts: MemoryTransport[]): string[] {
  const seen: string[] = [];
  for (const t of ts) {
    t.onPeerJoin((id) => seen.push(`${t.selfId}: join ${id}`));
    t.onPeerLeave((id) => seen.push(`${t.selfId}: leave ${id}`));
  }
  return seen;
}

/** Everything `t` receives on channel `ch`, as `<from>: <data>`. */
function inbox(t: MemoryTransport, ch = 'ch'): string[] {
  const got: string[] = [];
  t.onMessage(ch, (data, from) => got.push(`${from}: ${String(data)}`));
  return got;
}

describe('MemoryHub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reset(): every other node sees a leave, then a join, and the node’s own listeners still fire', () => {
    const hub = new MemoryHub(() => 5);
    const a = hub.connect('a');
    const b = hub.connect('b');
    const c = hub.connect('c');
    const seen = events(a, b, c);
    const atA = inbox(a);
    const atB = inbox(b);
    b.send('ch', 'in flight'); // sent to the old connection: lost with it
    hub.sever('a', 'c');

    a.reset();

    expect(seen).toEqual(['a: leave b', 'a: leave c', 'b: leave a', 'c: leave a', 'b: join a', 'a: join b', 'c: join a', 'a: join c']);
    expect(a.peers()).toEqual(['b', 'c']);
    b.send('ch', 'after', 'a');
    c.send('ch', 'past the old sever', 'a');
    a.send('ch', 'from a', 'b');
    vi.advanceTimersByTime(10);
    expect(atA).toEqual(['b: after', 'c: past the old sever']);
    expect(atB).toEqual(['a: from a']);

    // Closed, a node stays closed.
    c.close();
    c.reset();
    expect(a.peers()).toEqual(['b']);
  });

  it('sever drops both ways without a leave, on one channel if named; heal undoes it', () => {
    const hub = new MemoryHub(() => 5);
    const a = hub.connect('a');
    const b = hub.connect('b');
    const seen = events(a, b);
    const atA = [inbox(a), inbox(a, 'clk')];
    const atB = [inbox(b), inbox(b, 'clk')];

    hub.sever('a', 'b');
    a.send('ch', 'cut');
    b.send('clk', 'cut');
    vi.advanceTimersByTime(10);
    expect([atA, atB]).toEqual([[[], []], [[], []]]);

    hub.heal('a', 'b');
    hub.sever('b', 'a', 'clk');
    a.send('ch', 'passes');
    a.send('clk', 'cut');
    b.send('clk', 'cut');
    vi.advanceTimersByTime(10);
    expect([atA, atB]).toEqual([[[], []], [['a: passes'], []]]);

    // A message in flight when the link dies is lost with it.
    hub.heal('a', 'b');
    b.send('ch', 'in flight');
    hub.sever('a', 'b');
    vi.advanceTimersByTime(10);
    expect(atA[0]).toEqual([]);
    expect(seen).toEqual([]);
  });
});
