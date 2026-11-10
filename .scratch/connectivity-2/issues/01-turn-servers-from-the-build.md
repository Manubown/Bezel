# 01: A build carries its maintainer's TURN servers, and says so in the log

**What to build:** The dead public relay constant is gone. A build reads its TURN servers from one build-time setting, the same for the dev server, a local build and the hosted build; a phone's session log says whether it has a relay and, when the setting is unusable, why. A wizard walks the maintainer through getting the servers and putting them where each build reads them. Spec D1, D7.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] No setting: the page has no relay and connects as before; its `device` line says `turn: false`
- [x] A provider's ICE servers array yields its `turn:`/`turns:` entries with their credentials; its STUN entry is dropped
- [x] A setting that is not JSON, not an array, without a TURN server, or with a TURN server without credentials yields no relay and a problem text on the `device` line
- [x] `?noturn` still leaves the relay out and still travels in the QR
- [x] The hosted build (both channels) reads the setting from a repository secret
- [x] The wizard captures the servers from the clipboard as JSON or as the JavaScript literal a dashboard shows, writes the local setting, offers to set the secret, and passes `bash -n`

## Comments

### 2026-11-10, Main (implementation)

**Changed**
- `apps/pwa/src/turn.ts` (new): `parseTurnServers(json)` → `{ servers, problem? }`.
- `apps/pwa/src/main.ts`: `TURN_SERVERS` deleted; the setting is `import.meta.env.VITE_MGC_TURN_SERVERS`; `device` logs `turn` (servers in use) and `turnProblem`.
- `.github/workflows/pages.yml`: `VITE_MGC_TURN_SERVERS` from `secrets.MGC_TURN_SERVERS` on the master build and the stable build.
- `scripts/setup-turn.sh` (new, from the `/wizard` template; `pnpm setup-turn`): Metered account → credential → clipboard → `apps/pwa/.env.local` → check with Metered's testing page → `gh secret set MGC_TURN_SERVERS`. `.gitignore`: `.env.local`, `.env.*.local`.

**Verified**
- Wizard: `bash -n` clean (Git Bash); its `turn_json` fed Metered's documented JavaScript literal, strict JSON, an array without TURN and non-array text: the first two yield one line of JSON with the TURN entries, the last two exit 1 with the reason. After the review: a TURN entry without credentials is refused like `turn.ts` refuses it, and a kept `.env.local` value goes through `turn_json` again before it is used.
- Whole workspace: `pnpm typecheck` clean, `pnpm test` 28 files, 209 tests passed. Browser smoke (two tabs, Pong): `device.turn: false` without the setting, the Match plays.
- `pnpm vitest run apps/pwa/test/turn.test.ts`: 3 tests passed.
- **The maintainer's setup, checked 2026-11-11:** `apps/pwa/.env.local` holds four TURN entries (`standard.relay.metered.ca`, ports 80 and 443, UDP, TCP and TLS), ignored by git; the repository secret `MGC_TURN_SERVERS` exists (set 2026-11-10 23:02 UTC). In Chromium, a relay-only `RTCPeerConnection` gathered a `relay` candidate from each of the four within 0.25 s, and two relay-only connections in one page opened a data channel in 0.35 s and echoed a message over a `relay ↔ relay` pair (49 ms). The dev server's page logs `device.turn: true`.
- Correction to 2026-11-10: "no TURN server could be reached from this machine" was wrong. The same probe gathers relay candidates now; the hosts tried then (`openrelay.metered.ca`, `staticauth.openrelay.metered.ca` with the shared secret) simply did not answer.
- Not verified: the hosted build. The secret's value cannot be read back, and the code that reads it is not pushed; its first published page's `device` line (`turn: true`, no `turnProblem`) is the check (ticket 05, step 1).

**Why the old relay never worked:** `.scratch/live-test-1/findings.md` §1d.
