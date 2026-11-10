/** What a build's TURN setting holds: the relay servers to use, or why there are none. */
export interface TurnSetting {
  servers: RTCIceServer[];
  /** Set when the setting was given and is unusable; goes into the session log. */
  problem?: string;
}

const isTurnUrl = (url: unknown): url is string => typeof url === 'string' && /^turns?:/i.test(url);

/**
 * The TURN servers of this build: `VITE_MGC_TURN_SERVERS`, a JSON array of ICE servers as a TURN provider's
 * dashboard hands it out (`[{ "urls": "turn:…", "username": "…", "credential": "…" }, …]`). Only `turn:` and
 * `turns:` URLs are kept (the transport has its own STUN servers), each with its entry's credentials; an entry
 * without one is dropped. No setting means no relay: Devices connect directly or not at all.
 */
export function parseTurnServers(json: string | undefined): TurnSetting {
  if (json === undefined || json.trim() === '') return { servers: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { servers: [], problem: `not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!Array.isArray(parsed)) return { servers: [], problem: 'not an array of ICE servers' };
  const servers: RTCIceServer[] = [];
  for (const entry of parsed as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const { urls, username, credential } = entry as Record<string, unknown>;
    const turn = (Array.isArray(urls) ? urls : [urls]).filter(isTurnUrl);
    if (turn.length === 0) continue;
    // A TURN server without credentials refuses every allocation: the relay would look configured and never answer.
    if (typeof username !== 'string' || typeof credential !== 'string') return { servers: [], problem: `${turn[0]} has no username and credential` };
    servers.push({ urls: turn, username, credential });
  }
  return servers.length > 0 ? { servers } : { servers: [], problem: 'no turn: or turns: server in the array' };
}
