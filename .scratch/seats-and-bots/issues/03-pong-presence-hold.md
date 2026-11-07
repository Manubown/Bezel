# 03: Pong: touch presence — a needed Player must keep touching

**What to build:** Transport-level leave detection takes 10–13 s, so a Player whose phone has silently gone (or who has walked away) leaves the other side playing into nothing. Pong enforces presence softly through touch: a human Player's side is *present* while a pointer is down on their Tile or their last touch is less than `PONG.presence.holdMs` (5000) old. When a needed human side is not present the host holds play: the ball freezes where it is (serve wait does not run), paddles still follow input, and every Tile draws "<name>, touch your screen" naming the missing Player(s). Play continues the moment that Player touches again. The first serve of the Match waits until every human side has touched once ("touch to start"). Bots are always present. This is Pong-only game logic; the pwa's device-lost pause is unchanged and still applies.

**Blocked by:** 02 (Pong: sides from seats, bot opponent, one-Tile play)

**Status:** ready-for-agent

- [ ] `PongState` carries the hold (which sides are missing); views draw the overlay from state, nothing else
- [ ] Pong test: before any touch the ball does not serve; after both humans touch it serves
- [ ] Pong test: a human lifts the finger; 4.9 s later play continues, at 5.1 s the state holds that side and the ball's position stops changing; a `down` from that Device's Tile releases the hold on the next tick and the ball continues from where it stopped (no re-serve)
- [ ] Pong test: a bot side never causes a hold; with one human and a bot only the human is required
- [ ] Pong test: paddles still follow input while held; a point is never scored while held
- [ ] Smoke (two tabs): lift the pointer on one tab → ~5 s later both tabs show "<name>, touch your screen" and the ball is frozen; touch again → play resumes mid-rally
- [ ] Typecheck and suite green
