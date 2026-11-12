# 10: Sound where it happens, and a way to switch it off

**What to build:** Pong and Air Hockey play short synthesised tones: a hit and a wall on the Tile the ball is on, a goal and the win on every Tile. Each Device has a sound setting, on by default, on the first phone's sheet and the other phones' strip. An Android phone vibrates briefly on a goal (spec D12).

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] The SDK's view context gains a read-only sound preference; the platform sets it from the Device's setting and a change reaches a running view; a test at the SDK's game seam covers on, off and a change during a Match
- [ ] The setting is kept on the Device across visits and shown as one control on the sheet and on the strip
- [ ] Tones are synthesised (no audio files); the audio context is created on the Player's "touch to start" touch
- [ ] A hit and a wall sound on the Tile the ball or puck is on and on no other; a goal and the win sound on every Tile; harness tests show which view asks for which tone for a given pair of states
- [ ] With the setting off a view asks for no tone and no vibration
- [ ] On Android a goal vibrates briefly; where vibration does not exist nothing fails
- [ ] A view that never got a touch (a middle Tile nobody plays at) stays silent without an error
- [ ] Left for phones, as boxes on ticket 17: an iPhone with the silent switch on and off; a three-phone row
- [ ] The developer guide's concepts page shows how a Game plays a tone and honours the preference
