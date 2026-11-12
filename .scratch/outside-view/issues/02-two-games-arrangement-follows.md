# 02: Two Games for players, and the arrangement follows the Game

**What to build:** A first phone offers Pong and Air Hockey, Pong first, each as a card that says how many play and how the phones lie. Picking a Game sets its arrangement, so Start is never refused for a wrong one. The other five Games appear in Maker mode only (spec D2, D6).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] With Maker mode off the Game list is Pong, then Air Hockey; with it on, every discovered Game as today
- [ ] A Device that never picked gets Pong; a remembered pick is used only if it is in the list the Device shows
- [ ] Picking a Game selects the first template its Manifest names; the arrangement picker shows only when the Game names more than one, and offers only those
- [ ] No start is refused for the arrangement; the other refusals (too few phones, too many) still say what is missing
- [ ] The Controllers control shows only when the picked Game takes Controllers
- [ ] Each Game card states Players and arrangement in words a stranger reads ("2 players · phones in a row")
- [ ] The list and the remembered pick are covered by unit tests; the arrangement rule is covered where the lobby is tested today, over the in-memory transport
- [ ] Two-tab browser smoke: Pong in a row and Air Hockey end to end each start on the first press of Start
