# Contributing

Short version: `pnpm install`, change something, `pnpm typecheck && pnpm test`, open a PR against `master`. The rest of this file is what the checks do not catch.

## Set up

| Tool | Version | Pinned in |
|---|---|---|
| Node | 22 (22.23.4 or newer: Astro needs it for the site) | `.github/workflows/pages.yml` (what CI runs) |
| pnpm | 10.33.0 | `package.json` `packageManager`; `corepack enable` picks it up |

```sh
pnpm install
pnpm dev          # Vite dev server over self-signed HTTPS on the LAN
pnpm test         # vitest over packages/, games/, apps/
pnpm typecheck    # tsc -p . in every workspace package but the site (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
pnpm pages        # the site and both app builds as Pages publishes them, into apps/site/dist, checked
```

The workspace is `apps/*`, `packages/*`, `games/*` (`pnpm-workspace.yaml`); `apps/site` is the site, an Astro project that `astro check` checks when it builds. CI (`pages.yml`) runs install with `--frozen-lockfile`, then typecheck, test and `pnpm pages`, and publishes `apps/site/dist` to GitHub Pages on every push to `master`.

## Where things go

Read [`docs/architecture.md`](docs/architecture.md) §1 for the dependency rules (a Game imports `@mgc/sdk` only, and its test fails on anything else; `@mgc/sdk` depends on `@mgc/layout` only; `@mgc/layout` on nothing) and §5 for where each kind of change goes.

### Adding a Game

```sh
pnpm new-game <slug> "<Name>"        # copies games/_template, rewrites ids and names
pnpm install --no-frozen-lockfile    # the new workspace package changes pnpm-lock.yaml; commit it
pnpm vitest run games/<slug>
```

- Ids are `mgc.<slug>`, package names `@mgc/<slug>`. The PWA discovers `games/*/src/index.ts` by glob; register nothing.
- Keep the template's test shape: rules over `createTestMatch`, and the imports-only test that pins `@mgc/sdk` as the sole dependency.
- Give the Game a `README.md` in its folder saying what SDK path it exercises and what it taught; the five Games built on the template do.
- While building, keep a friction log at `.scratch/<slug>/friction.md`: one entry per SDK, platform, doc or tooling problem, with the file:line, what you expected, what happened, the workaround. Friction logs are where SDK fixes come from (`.scratch/sdk-friction-1/spec.md` is the consolidation of the first five).

### Changing the SDK

Anything a Game can see is a contract: `packages/sdk/src/{types,game,wire}.ts`. A change there updates, in the same PR: `docs/sdk-design.md` (the contract), `docs/guide/api.md` (every export, signature copied from the source), the test harness if the surface grew, and the template if a new Game should use it. Frames crossing the `Link` stay JSON (`JsonValue`) and versioned (`WIRE_VERSION`): the same bytes cross WebRTC and, in M3, an iframe boundary.

### Changing the lobby or HUD

`apps/pwa/src/lobby.ts` owns every rule about who may start what; its refusal messages are quoted verbatim in `docs/guide/troubleshooting.md` §Starting, so a changed message changes the guide. `apps/pwa/test/lobby.test.ts` covers the rules.

## Docs

- `docs/guide/` is the developer-facing documentation and is versioned with the code. Where a page cites a file as `path:line`, the citation is a claim about that line: when you move code, fix the citation; when you change behaviour, fix the sentence. `.scratch/dev-onboarding/issues/02-developer-guide.md` describes the script that verifies every citation resolves.
- Use the terms in `GLOSSARY.md` exactly (Session, Device, Host, Peer, Tile, Layout, Surface, World, Game, Match, Player, Controller, Holder, Input) and avoid the synonyms it lists.
- A decision that constrains future work gets an ADR in `docs/adr/NNNN-<slug>.md`; contradicting an existing ADR is a conversation, not a silent override (`docs/agents/domain.md`).

## Issues and tickets

The issue tracker is in the repo: one directory per feature under `.scratch/<feature>/`, a `spec.md`, and `issues/NN-<slug>.md` tickets with a `Status:` line (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `resolved`). Conventions: [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md), [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md). Open decisions that need a human are collected in `.scratch/sdk-friction-1/spec.md` Part B.

## Commits and PRs

- One concern per commit; the subject says what changed and why in plain words (see `git log`).
- A PR that changes behaviour on phones says how it was tried: `createTestMatch` tests, browser tabs on one machine, or real phones (and which), with the exported session log attached when something went wrong (`docs/guide/running-on-phones.md` §The session log).
- No PR lands with a red `pnpm typecheck` or `pnpm test`.

## Releases

There is no version number. Pages serves the site at <https://manubown.github.io/Bezel/> (brand.json's `address`) and the app twice below it: <https://manubown.github.io/Bezel/next/> is `master`, live after every push; <https://manubown.github.io/Bezel/play/> is the app for everyone, built from the commit the `stable` git tag points at. A known-good commit is promoted with `pnpm stable <ref>`, which moves the tag and pushes it; Pages then rebuilds `play/` from that commit (`.github/workflows/pages.yml`). Move the tag after a successful run on real phones, not after a green CI. The old address of the stable build, `/Bezel/stable/`, forwards to `play/`; the site's root opened with a join code forwards to `next/`, and opened from an installed icon to `play/`. `pnpm pages` builds the same into `apps/site/dist` and checks that every link resolves and every forward keeps its query; `pnpm --filter @mgc/site preview` serves it under `/Bezel/`.

Both hosted app builds take their TURN relay from the repository secret `MGC_TURN_SERVERS`; `pnpm setup-turn` (from Git Bash on Windows) sets it and the dev server's `apps/pwa/.env.local` (`docs/guide/running-on-phones.md` §Connectivity flags). A fork without the secret builds a PWA without a relay.
