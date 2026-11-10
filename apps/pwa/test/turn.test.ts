import { describe, expect, it } from 'vitest';
import { parseTurnServers } from '../src/turn';

describe('parseTurnServers', () => {
  it('has no servers and no problem when the build sets nothing', () => {
    expect(parseTurnServers(undefined)).toEqual({ servers: [] });
    expect(parseTurnServers('  ')).toEqual({ servers: [] });
  });

  it("keeps a provider's turn and turns entries with their credentials and drops its stun entry", () => {
    const array = [
      { urls: 'stun:stun.relay.example:80' },
      { urls: 'turn:relay.example:80', username: 'u', credential: 'p' },
      { urls: ['turns:relay.example:443?transport=tcp', 'stun:relay.example:443'], username: 'u', credential: 'p' },
    ];
    expect(parseTurnServers(JSON.stringify(array))).toEqual({
      servers: [
        { urls: ['turn:relay.example:80'], username: 'u', credential: 'p' },
        { urls: ['turns:relay.example:443?transport=tcp'], username: 'u', credential: 'p' },
      ],
    });
  });

  it('names what is wrong with a setting it cannot use, and uses none of it', () => {
    expect(parseTurnServers('[{ urls: "turn:x" }]')).toMatchObject({ servers: [], problem: expect.stringContaining('not JSON') });
    expect(parseTurnServers('{"urls":"turn:relay.example:80"}')).toEqual({ servers: [], problem: 'not an array of ICE servers' });
    expect(parseTurnServers('[{"urls":"stun:stun.example:3478"}]')).toEqual({ servers: [], problem: 'no turn: or turns: server in the array' });
    // One entry without credentials spoils the setting: half a relay configuration is a relay that never answers.
    const half = [{ urls: 'turn:a.example:80', username: 'u', credential: 'p' }, { urls: 'turn:b.example:80' }];
    expect(parseTurnServers(JSON.stringify(half))).toEqual({ servers: [], problem: 'turn:b.example:80 has no username and credential' });
  });
});
