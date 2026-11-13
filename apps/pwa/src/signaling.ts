/**
 * The app's id on the signaling relays: every Session is a room under it, and Trystero picks the Nostr relays the phones
 * use by it, the ones the privacy page names (`apps/site/src/servers.ts`, held to this by `test/signaling.test.ts`).
 * A new id means other relays and a privacy page read again.
 */
export const APP_ID = 'mobilegameconnect';
