# MobileGameConnect

A platform that joins a group of phones placed together into one shared play surface, and lets games plug into it.

## Language

### Connectivity

**Session**:
A group of Devices connected to one Host. Its lifetime is the connection; a Session outlives any single Match.
_Avoid_: Room, lobby (the lobby is a screen inside a Session, not the Session)

**Device**:
One phone taking part in a Session, with a stable identity across reconnects.
_Avoid_: Client, node, screen

**Host**:
The Device that runs the authoritative game logic and routes all messages.
_Avoid_: Server, master

**Peer**:
Any Device in a Session that is not the Host.
_Avoid_: Client, guest

### Surface

**Tile**:
A Device's rectangle on the shared play surface: position, size, and rotation in world millimetres. Also the role of a Device that is part of the Layout.
_Avoid_: Screen, cell, segment

**Layout**:
The set of Tiles that together make up one play surface.
_Avoid_: Arrangement, grid, template (a template is a preset that produces a Layout)

**Surface**:
The mapping between world millimetres and one Device's screen.
_Avoid_: Viewport, camera

**World**:
The shared physical coordinate space of a Layout, measured in millimetres.
_Avoid_: Game space, canvas space

### Play

**Game**:
A pluggable bundle (manifest, host logic, view) that can be played in a Match.
_Avoid_: App, plugin, module

**Match**:
One run of one Game inside a Session, with a frozen set of Devices, Players, and Layout.
_Avoid_: Round (a round is a Game-internal unit), game (ambiguous with Game)

**Player**:
A participant in a Match, with a stable identity issued by the platform. A Player may hold a Controller or no Device at all.
_Avoid_: User, account, seat

**Controller**:
The role of a Device that is held in hand during a Match, not part of the Layout, and shows a private view. A Controller may be passed between Players.
_Avoid_: Gamepad, remote, hand device

**Holder**:
The Player currently holding a given Controller. Changes when the Controller is passed; the Game decides when.
_Avoid_: Owner, assignee, current user

**Input**:
One touch or pointer event from a Device, expressed in world coordinates with a shared timestamp.
_Avoid_: Event, touch, gesture
