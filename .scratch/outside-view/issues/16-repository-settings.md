# 16: The repository's About box, topics and labels

**What to build:** The repository's front page says what this is before the README is read, and its issue tracker is ready for the forms of ticket 15. Set through the command line on the maintainer's account; the maintainer approved this on 2026-11-12 (spec D20).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Description: "Put your phones side by side and they become one game board. Free party games in the browser, nothing to install. Open source, with an SDK for your own games."
- [x] Website: the public address
- [x] Topics: `party-game`, `local-multiplayer`, `multiplayer-game`, `browser-game`, `mobile-game`, `pwa`, `webrtc`, `peer-to-peer`, `multi-screen`, `game-sdk`, `typescript`, `pong`, `air-hockey`, `trystero`
- [x] Labels exist: `bug`, `game-idea`, `good first issue`, `help wanted`, `internal`, and the triage words of the agents' label doc
- [x] Issues #1 and #2 carry `internal`; neither is closed or edited otherwise
- [x] Private vulnerability reporting is on
- [x] The Projects tab is off if unused; Discussions stay off
- [x] Each setting is read back from the API and the read-back is pasted in a comment
- [x] Not done here: the social preview image (it can only be uploaded in the browser; ticket 17)

## Comments

### 2026-11-12, Ticket16RepoSettings (implementation)

**Changed** (on GitHub, `Manubown/Bezel`, through `gh` on the maintainer's account; no file in the repository changes except this ticket)
- About box: description and website `https://manubown.github.io/Bezel/` set; the 14 topics added (there were none).
- Projects tab off (`--enable-projects=false`). Discussions untouched (were off, stay off).
- Labels created: `game-idea`, `internal`, `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`. Already there and left as they were: `bug`, `good first issue`, `help wanted`, `wontfix` (and `accessibility`, `documentation`, `duplicate`, `enhancement`, `invalid`, `question`).
- Issues #1 and #2: label `internal` added, nothing else.
- Private vulnerability reporting switched on.

Commands run:

```
gh repo edit Manubown/Bezel --description "Put your phones side by side and they become one game board. Free party games in the browser, nothing to install. Open source, with an SDK for your own games." --homepage "https://manubown.github.io/Bezel/" --add-topic party-game,local-multiplayer,multiplayer-game,browser-game,mobile-game,pwa,webrtc,peer-to-peer,multi-screen,game-sdk,typescript,pong,air-hockey,trystero --enable-projects=false
gh label create game-idea       -R Manubown/Bezel --color fbca04 --description "An idea for a new Game"
gh label create internal        -R Manubown/Bezel --color ededed --description "The makers' own planning, written for the makers"
gh label create needs-triage    -R Manubown/Bezel --color d4c5f9 --description "Maintainer needs to evaluate this issue"
gh label create needs-info      -R Manubown/Bezel --color d876e3 --description "Waiting on reporter for more information"
gh label create ready-for-agent -R Manubown/Bezel --color 0e8a16 --description "Fully specified, ready for an AFK agent"
gh label create ready-for-human -R Manubown/Bezel --color 1d76db --description "Requires human implementation"
gh issue edit 1 -R Manubown/Bezel --add-label internal
gh issue edit 2 -R Manubown/Bezel --add-label internal
gh api -X PUT repos/Manubown/Bezel/private-vulnerability-reporting
```

Every command exited 0; none was refused.

**Decisions**
- Triage label descriptions are the "Meaning" column of `docs/agents/triage-labels.md`, so the tracker and the doc say the same thing. `wontfix` already existed with GitHub's default description and was not edited.
- Projects counted as unused: before the change the repository's public Projects page read "Open 0 (0) / Closed 0 (0)", the account's public projects page "0 open and 0 closed projects found", neither issue's timeline had a project event, and the repository has 0 pull requests.
- Existing labels were not renamed, recoloured or deleted: the ticket asks that the listed labels exist, not that the others go.

**Verified** (read back after the change)

Before: description `""`, homepage `""`, topics `null`, `hasProjectsEnabled: true`, `hasDiscussionsEnabled: false`, private vulnerability reporting `{"enabled":false}`, issues #1 and #2 open with no labels, 10 labels (the six created above missing).

```
$ gh repo view Manubown/Bezel --json description,homepageUrl,repositoryTopics,hasProjectsEnabled,hasDiscussionsEnabled,visibility
{"description":"Put your phones side by side and they become one game board. Free party games in the browser, nothing to install. Open source, with an SDK for your own games.","hasDiscussionsEnabled":false,"hasProjectsEnabled":false,"homepageUrl":"https://manubown.github.io/Bezel/","topics":["air-hockey","browser-game","game-sdk","local-multiplayer","mobile-game","multi-screen","multiplayer-game","party-game","peer-to-peer","pong","pwa","trystero","typescript","webrtc"],"visibility":"PUBLIC"}

$ gh api repos/Manubown/Bezel --jq '{description,homepage,topics,has_projects,has_discussions,has_wiki,visibility,name,archived}'
{"archived":false,"description":"Put your phones side by side and they become one game board. Free party games in the browser, nothing to install. Open source, with an SDK for your own games.","has_discussions":false,"has_projects":false,"has_wiki":false,"homepage":"https://manubown.github.io/Bezel/","name":"Bezel","topics":["air-hockey","browser-game","game-sdk","local-multiplayer","mobile-game","multi-screen","multiplayer-game","party-game","peer-to-peer","pong","pwa","trystero","typescript","webrtc"],"visibility":"public"}

$ gh api repos/Manubown/Bezel/topics
{"names":["air-hockey","browser-game","game-sdk","local-multiplayer","mobile-game","multi-screen","multiplayer-game","party-game","peer-to-peer","pong","pwa","trystero","typescript","webrtc"]}

$ gh label list -R Manubown/Bezel --limit 100
accessibility	Barrier affecting people with disabilities	#f143ab
bug	Something isn't working	#d73a4a
documentation	Improvements or additions to documentation	#0075ca
duplicate	This issue or pull request already exists	#cfd3d7
enhancement	New feature or request	#a2eeef
good first issue	Good for newcomers	#7057ff
help wanted	Extra attention is needed	#008672
invalid	This doesn't seem right	#e4e669
question	Further information is requested	#d876e3
wontfix	This will not be worked on	#ffffff
game-idea	An idea for a new Game	#fbca04
internal	The makers' own planning, written for the makers	#ededed
needs-triage	Maintainer needs to evaluate this issue	#d4c5f9
needs-info	Waiting on reporter for more information	#d876e3
ready-for-agent	Fully specified, ready for an AFK agent	#0e8a16
ready-for-human	Requires human implementation	#1d76db

$ gh api repos/Manubown/Bezel/private-vulnerability-reporting
{"enabled":true}

$ gh issue view 1 -R Manubown/Bezel --json number,title,state,labels,assignees,milestone
{"assignees":[],"labels":["internal"],"milestone":null,"number":1,"state":"OPEN","title":"Extract @mgc/platform from apps/pwa and publish the packages for an external Hub"}
$ gh api repos/Manubown/Bezel/issues/1/timeline --jq '[.[] | {event, label: .label.name}]'
[{"event":"labeled","label":"internal"}]

$ gh issue view 2 -R Manubown/Bezel --json number,title,state,labels,assignees,milestone
{"assignees":[],"labels":["internal"],"milestone":null,"number":2,"state":"OPEN","title":"Opaque Hub payload per Player and per Match in MatchInfo, returned via end(result)"}
$ gh api repos/Manubown/Bezel/issues/2/timeline --jq '[.[] | {event, label: .label.name}]'
[{"event":"labeled","label":"internal"}]

$ gh api graphql -f query='query{repository(owner:"Manubown",name:"Bezel"){usesCustomOpenGraphImage hasProjectsEnabled hasDiscussionsEnabled}}' --jq .data.repository
{"hasDiscussionsEnabled":false,"hasProjectsEnabled":false,"usesCustomOpenGraphImage":false}
```

- Issues not edited otherwise: the sha256 of each issue's title and body is the same before and after (#1 body `3aaa8ca4…`, title `797ca6bb…`; #2 body `210bd568…`, title `a0ac10cc…`); state, assignees and milestone unchanged; the only timeline event of each is the `labeled internal` above.
- Visibility (public), name, archived state, Wiki (off) and Discussions (off) unchanged. Nothing was pushed; no branch protection was touched.

**Not verified**
- Private projects of the account: listing ProjectsV2 needs the `read:project` scope, which the `gh` token does not have (`INSUFFICIENT_SCOPES`). The public pages, the issue timelines and the empty pull-request list showed no project in use.
- How the About box and topics look on the repository page in a browser; only the API was read.
- The social preview image is still GitHub's default (`usesCustomOpenGraphImage: false`): it is ticket 17's, uploaded in the browser.
