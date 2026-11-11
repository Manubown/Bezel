import { describe, expect, it } from 'vitest';
import { OwnAddressWithholding, isOwnAddress, withholdingOwn, withoutOwnAddresses } from '../src/own-addresses';
import { RELAY_STABLE_MS } from '../src/relay-escalation';

const OWN_MDNS = 'candidate:1 1 udp 2113937151 3f2a8c1e-0b7d-4c55-9d0e-1f2a3b4c5d6e.local 51000 typ host generation 0 network-cost 999';
const OWN_TCP = 'candidate:2 1 tcp 1518280447 10.134.2.7 9 typ host tcptype active';
const OWN_BARE = 'candidate:3 1 udp 2113937151 10.134.2.7 51000 typ host';
const REFLEXIVE = 'candidate:4 1 udp 1677729535 84.17.3.9 46154 typ srflx raddr 0.0.0.0 rport 0 generation 0';
const RELAYED = 'candidate:5 1 udp 33562623 203.0.113.5 61000 typ relay raddr 84.17.3.9 rport 46154 generation 0';

describe('own addresses in ICE', () => {
  it('names a `typ host` candidate, whatever follows the type, and no other kind', () => {
    expect([OWN_MDNS, OWN_TCP, OWN_BARE, REFLEXIVE, RELAYED].map(isOwnAddress)).toEqual([true, true, true, false, false]);
  });

  it('takes exactly the own-address candidate lines out of a session description, with either line ending', () => {
    const lines = ['v=0', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', `a=${OWN_MDNS}`, `a=${REFLEXIVE}`, `a=${OWN_BARE}`, `a=${RELAYED}`, 'a=ice-ufrag:abcd', ''];
    const kept = ['v=0', 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', `a=${REFLEXIVE}`, `a=${RELAYED}`, 'a=ice-ufrag:abcd', ''];
    expect(withoutOwnAddresses(lines.join('\r\n'))).toBe(kept.join('\r\n'));
    expect(withoutOwnAddresses(lines.join('\n'))).toBe(kept.join('\n'));
  });
});

describe('OwnAddressWithholding', () => {
  it('switches on at the `after`-th short-lived connection in a row, and says so once', () => {
    const policy = new OwnAddressWithholding(2);
    policy.joined('a', 0);
    expect(policy.left('a', 4000)).toBe(false);
    expect(policy.active).toBe(false);
    policy.joined('a', 5000);
    expect(policy.left('a', 9000)).toBe(true);
    expect(policy.active).toBe(true);
    expect(policy.failures).toBe(2);
    policy.joined('a', 10000);
    expect(policy.left('a', 11000)).toBe(false);
    expect(policy.active).toBe(true);
  });

  it('restarts the count when a connection that lived RELAY_STABLE_MS ends', () => {
    const policy = new OwnAddressWithholding(2);
    policy.joined('a', 0);
    policy.left('a', RELAY_STABLE_MS - 1);
    policy.joined('b', 20000);
    policy.left('b', 20000 + RELAY_STABLE_MS);
    policy.joined('a', 60000);
    expect(policy.left('a', 61000)).toBe(false);
    expect(policy.failures).toBe(1);
  });

  it('does not judge the connections the transport dropped itself, nor a leave it never saw join', () => {
    const policy = new OwnAddressWithholding(1);
    policy.joined('a', 0);
    policy.reset();
    expect(policy.left('a', 1000)).toBe(false);
    expect(policy.left('b', 1000)).toBe(false);
    expect(policy.active).toBe(false);
    // The same peer again after the reset: its lifetime counts from the new join.
    policy.joined('a', 50000);
    expect(policy.left('a', 50000 + RELAY_STABLE_MS)).toBe(false);
    expect(policy.active).toBe(false);
  });

  it('never switches on with `after` 0', () => {
    const policy = new OwnAddressWithholding(0);
    policy.joined('a', 0);
    expect(policy.left('a', 100)).toBe(false);
    expect(policy.active).toBe(false);
  });
});

/** The few members of RTCPeerConnection the wrapper touches; `gather` fires a candidate event as the browser would. */
class FakeConnection extends EventTarget {
  sdp = '';
  remote: RTCSessionDescriptionInit | null = null;
  get localDescription(): { type: string; sdp: string } | null {
    return this.sdp ? { type: 'offer', sdp: this.sdp } : null;
  }
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remote = description;
  }
  gather(candidate: string | null): void {
    const ev = new Event('icecandidate');
    Object.assign(ev, { candidate: candidate === null ? null : { candidate } });
    this.dispatchEvent(ev);
  }
}

/** A wrapped connection as Trystero uses one: the handler assigned to `onicecandidate` collects what would be signaled. */
function wrapped(withhold: () => boolean) {
  // A stand-in for the browser's constructor: only the members above exist.
  const Wrapped = withholdingOwn(FakeConnection as unknown as typeof RTCPeerConnection, withhold);
  const pc = new Wrapped();
  const signaled: (string | null)[] = [];
  pc.onicecandidate = (ev) => signaled.push(ev.candidate?.candidate ?? null);
  return { pc, fake: pc as unknown as FakeConnection, signaled };
}

describe('withholdingOwn', () => {
  it('passes other candidates at once and holds own addresses until the remote description is set, then passes them when not withholding', async () => {
    const { pc, fake, signaled } = wrapped(() => false);
    fake.gather(OWN_MDNS);
    fake.gather(REFLEXIVE);
    expect(signaled).toEqual([REFLEXIVE]);
    await pc.setRemoteDescription({ type: 'answer', sdp: 'v=0\r\n' });
    expect(fake.remote).toEqual({ type: 'answer', sdp: 'v=0\r\n' });
    expect(signaled).toEqual([REFLEXIVE, OWN_MDNS]);
    fake.gather(OWN_TCP);
    fake.gather(null);
    expect(signaled).toEqual([REFLEXIVE, OWN_MDNS, OWN_TCP, null]);
  });

  it('drops own addresses, held and later ones, when withholding at the moment the remote description is set', async () => {
    let withhold = false;
    const { pc, fake, signaled } = wrapped(() => withhold);
    fake.gather(OWN_MDNS);
    withhold = true;
    await pc.setRemoteDescription({ type: 'answer', sdp: 'v=0\r\n' });
    fake.gather(OWN_TCP);
    fake.gather(RELAYED);
    expect(signaled).toEqual([RELAYED]);
    // Decided once per connection: a policy that changes afterwards does not release them.
    withhold = false;
    fake.gather(OWN_BARE);
    expect(signaled).toEqual([RELAYED]);
  });

  it('reads the local description without own addresses in either mode', () => {
    const { pc, fake } = wrapped(() => false);
    expect(pc.localDescription).toBeNull();
    fake.sdp = `v=0\r\na=${OWN_MDNS}\r\na=${REFLEXIVE}\r\n`;
    expect(pc.localDescription?.type).toBe('offer');
    expect(pc.localDescription?.sdp).toBe(`v=0\r\na=${REFLEXIVE}\r\n`);
  });
});
