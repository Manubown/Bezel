/**
 * The servers a phone talks to besides the site's host and the other phones, as the privacy page names them (spec D18).
 * `apps/pwa/test/signaling.test.ts` holds the relays and the STUN servers' source to the code.
 */

/**
 * The signaling relays: Trystero's default Nostr relays for the app's id. The transport passes no relay list, so the
 * installed Trystero picks five of its defaults by the app id (`APP_ID`, `apps/pwa/src/signaling.ts`); the test opens
 * the transport and compares the WebSockets it opens with these.
 */
export const SIGNALING_RELAYS: readonly string[] = [
  'relay.nostr.blockhenge.com',
  'relay.flashapp.me',
  'relay.nostrmap.net',
  'relay.bullishbounty.com',
  'relay.novospes.com',
];

/**
 * Trystero's default STUN servers, read from its version `STUN_READ_FROM` (`@trystero-p2p/core`, `dist/peer.mjs`). The
 * transport passes no ICE servers of its own, only the build's Relay, which Trystero adds to these (`turnConfig`).
 */
export const STUN = { google: ['stun.l.google.com', 'stun1.l.google.com', 'stun2.l.google.com'], cloudflare: 'stun.cloudflare.com' };

/** The Trystero version `STUN` was read from: the test fails on any other, until the list is read again. */
export const STUN_READ_FROM = '0.26.0';

/**
 * The Relay of the build published at the site's address (`VITE_MGC_TURN_SERVERS` from the repository secret,
 * `.github/workflows/pages.yml`), read off that build. No test can see the secret; a build without it has no Relay.
 */
export const RELAY_HOST = 'standard.relay.metered.ca';
