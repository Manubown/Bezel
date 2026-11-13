# Documentation

| Path | What it is | Read it when |
|---|---|---|
| [`guide/`](guide/README.md) | the developer guide: getting started, tutorial, concepts, testing, phones, troubleshooting, API reference | you build a Game |
| [`architecture.md`](architecture.md) | how the packages fit, one phone's path from page load to a running Game, the SDK seam, where a change goes | you change the platform |
| [`sdk-design.md`](sdk-design.md) | the `@mgc/sdk` contract: data, interfaces, wire protocol, ordering and error rules, the design-it-twice rationale | you change anything a Game can see |
| [`platform-design.md`](platform-design.md) | the pre-M2 deepening of `core`/`layout`/`apps/pwa` that produced the `Session` interface and the lobby seam | you want to know why `Session` looks the way it does |
| [`adr/`](adr/) | the five binding decisions: PWA runtime, host-authoritative star, state stream not lockstep, sandboxed data seam, world millimetres | before contradicting one |
| [`PLAN.md`](PLAN.md) | research, prior art, transport facts, milestones M0–M5 with what each proved | you want the history or the roadmap |
| [`agents/`](agents/) | conventions for coding agents: the in-repo issue tracker, triage labels, domain docs | you file or pick up a ticket |
| [`liveLogs/`](liveLogs/) | the NDJSON session logs the phones exported during the makers' live runs 1–6 (2026-11-07 to 2026-11-10); [`liveLogs/README.md`](liveLogs/README.md) says which run each file comes from, `.scratch/live-test-1/findings.md` analyses them | you want a real log to look at or to compare against |

Terms are defined once, in [`../GLOSSARY.md`](../GLOSSARY.md). Specs, tickets and friction logs live in [`../.scratch/`](../.scratch/) by feature.
