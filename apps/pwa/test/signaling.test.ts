import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { TrysteroTransport } from '@mgc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIGNALING_RELAYS, STUN_READ_FROM } from '../../site/src/servers';
import { APP_ID } from '../src/signaling';

/** A WebSocket that never connects: it records the address it was opened for and nothing leaves the process. */
function recordingSockets(opened: string[]): typeof WebSocket {
  return class {
    readonly readyState = 0;
    readonly url: string;
    constructor(url: string) {
      this.url = url;
      opened.push(url);
    }
    send(): void {}
    close(): void {}
  } as unknown as typeof WebSocket;
}

describe('the servers the privacy page names (spec D18)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('are the signaling relays the transport opens for the app id', () => {
    // The transport passes no relay list, so the installed Trystero picks its default Nostr relays by the app id; its
    // own code runs here, up to the WebSockets it opens on joining a Session.
    const opened: string[] = [];
    vi.stubGlobal('WebSocket', recordingSockets(opened));
    new TrysteroTransport({ appId: APP_ID, roomId: 'TEST' }).close();
    expect(opened.map((url) => new URL(url).host).sort()).toEqual([...SIGNALING_RELAYS].sort());
  });

  it('are the STUN servers of the Trystero they were read from', () => {
    // Trystero does not export its default STUN servers (`defaultIceServers` in @trystero-p2p/core's dist/peer.mjs is
    // outside the package's exports), and puts them only into the RTCPeerConnection it makes once another phone answers
    // on a relay, so no test can ask for them without a network. Pinned instead: the version the page's list was read
    // from. An update fails here until someone reads the new defaults and changes the page and this version.
    const fromCore = createRequire(createRequire(import.meta.url).resolve('@mgc/core'));
    const { version } = JSON.parse(readFileSync(fromCore.resolve('trystero/package.json'), 'utf8')) as { version: string };
    expect(version).toBe(STUN_READ_FROM);
  });
});
