# Security

Please report a security problem privately: [Security → Report a vulnerability](https://github.com/Manubown/Bezel/security/advisories/new). Only the maintainers and you can read the report. Do not open a public issue for it. There is no promised response time.

In scope: the site and the app at <https://manubown.github.io/Bezel/> (`play/`, `next/`) and the code in this repository.

## Known, and so by design

- **The Relay credential is in the public app.** A build that has a Relay carries its TURN username and password in the JavaScript every phone downloads (`VITE_MGC_TURN_SERVERS`, read in `apps/pwa/src/turn.ts`), so anyone can read them and use the Relay on the maintainer's allowance. A browser needs the credential to use the Relay, and there is no server of ours that could hand out short-lived ones.
- **A table is open to anyone who has its code.** A code is four characters from 31 (`apps/pwa/src/main.ts`), about 920,000 codes, and a table has no password: whoever knows or guesses the code can join, and shows up on the first phone's list of phones. The public signaling relays see a hashed form of the code and the offers to connect, which are encrypted with a key made from the code; someone who records the relays and tries every code can read those offers.
- **A Game runs inside the app's page**, with the app's rights; sandboxing Games in their own frames is planned, not built (`docs/PLAN.md` §6, M3). Only the Games in this repository are loaded.
- **A session log is shared only when someone exports it.** It holds the kind of phone, its browser, screen and connection details, the table code and the names typed in, but not IP addresses (`apps/pwa/src/recorder.ts`). Read a log before you attach it to a public issue.

What each party sees of a phone: the privacy paragraph in the [README](README.md#privacy).
