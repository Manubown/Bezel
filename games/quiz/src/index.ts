import { defineGame, type DeviceId, type MatchInfo, type PlayerId } from '@mgc/sdk';

/**
 * Tunables, in one place: tests import them. Times are shared-clock milliseconds.
 */
export const QUIZ = {
  /** Questions per Match: the first ones of `QUESTIONS` in the Match's seeded order. */
  questions: 5,
  /** How long the Holders have to answer a question, ms. */
  answerMs: 15_000,
  /** How long the right answer and the scores stay up before the next question, ms. */
  revealMs: 4000,
  /** Points for a right answer the moment the question appears. They fall linearly to `slowest` at the deadline. */
  fastest: 1000,
  /** Points for a right answer at the deadline. A wrong answer, or none, scores 0. */
  slowest: 500,
} as const;

/** The built-in questions. `answer` is the index of the right one of the four `choices`. */
export const QUESTIONS: readonly { text: string; choices: readonly [string, string, string, string]; answer: number }[] = [
  { text: 'Which planet is called the Red Planet?', choices: ['Venus', 'Mars', 'Jupiter', 'Mercury'], answer: 1 },
  { text: 'How many legs does a spider have?', choices: ['6', '8', '10', '12'], answer: 1 },
  { text: 'What is the chemical symbol for gold?', choices: ['Ag', 'Gd', 'Au', 'Go'], answer: 2 },
  { text: 'Which is the largest ocean?', choices: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  { text: 'How many minutes are there in a day?', choices: ['1440', '1240', '1640', '960'], answer: 0 },
  { text: 'Which instrument has 88 keys?', choices: ['Organ', 'Accordion', 'Piano', 'Harp'], answer: 2 },
  { text: 'What is the capital of Canada?', choices: ['Toronto', 'Ottawa', 'Vancouver', 'Montreal'], answer: 1 },
  { text: 'Which gas do plants take in from the air?', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], answer: 2 },
  { text: 'Who painted the Mona Lisa?', choices: ['Leonardo', 'Michelangelo', 'Raphael', 'Donatello'], answer: 0 },
  { text: 'How many sides does a hexagon have?', choices: ['5', '6', '7', '8'], answer: 1 },
  { text: 'At how many °F does water freeze?', choices: ['0', '32', '100', '212'], answer: 1 },
  { text: 'Which is the smallest prime number?', choices: ['0', '1', '2', '3'], answer: 2 },
];

/** Questions in one Match. */
const TOTAL = Math.min(QUIZ.questions, QUESTIONS.length);

/** Where a question is: open for answers, or showing the right one. */
export type Phase = 'ask' | 'reveal';

/** The board's state, published to every Device: only what everybody may know. */
export type BoardState = {
  kind: 'board';
  phase: Phase;
  /** The question's place in this Match, from 0. */
  round: number;
  question: string;
  choices: string[];
  /** Shared time the answers close (`ask`) or the next question comes (`reveal`), ms. */
  until: number;
  /** The Players who answered this question, in the order their answers reached the host. */
  answered: PlayerId[];
  /** Every Player's points; this question's count from its reveal on. */
  scores: Record<PlayerId, number>;
  /** From the reveal on: the right choice, and what each Player got for this question. */
  answer?: number;
  gained?: Record<PlayerId, number>;
};

/** One Controller's own state, published to that Controller alone: its Holder's answer and, after the reveal, what it earned. */
export type ControllerState = {
  kind: 'controller';
  phase: Phase;
  round: number;
  question: string;
  choices: string[];
  /** The Holder's choice for this question; null until it answered. */
  picked: number | null;
  /** The Holder's points; this question's count from its reveal on. */
  score: number;
  /** From the reveal on: the right choice, and what the Holder's answer earned. */
  answer?: number;
  gained?: number;
};

/**
 * What the host publishes: a `BoardState` to every Device, then a
 * `ControllerState` to each held Controller alone. A Controller's view hears
 * both kinds, and its `latest()` is whichever came last, so every view tells
 * them apart by `kind`.
 */
export type QuizState = BoardState | ControllerState;

/** What a Controller sends: its Holder's answer, an index into `choices`. */
export type QuizMessage = { t: 'answer'; choice: number };

const LETTERS = ['A', 'B', 'C', 'D'] as const;
const FG = '#f2f0ea';
const DIM = 'rgba(242, 240, 234, 0.55)';
const PANEL = 'rgba(242, 240, 234, 0.1)';
const FAINT = 'rgba(242, 240, 234, 0.04)';
const BG = '#121212';
const GOOD = '#63c98a';
const BAD = '#e26d5a';

const nameOf = (match: MatchInfo, playerId: PlayerId): string => match.players.find((p) => p.playerId === playerId)?.name ?? playerId;

/** Deterministic randoms in [0, 1) from the Match seed (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `text` in lines no wider than `width` at `g`'s font, broken between words: Canvas2D does not wrap. */
function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const longer = line === '' ? word : `${line} ${word}`;
    if (line !== '' && g.measureText(longer).width > width) {
      lines.push(line);
      line = word;
    } else line = longer;
  }
  return line === '' ? lines : [...lines, line];
}

/**
 * Quiz: one Tile on the table is the board; every other phone is a
 * Controller in a Player's hand (`seats: 'controllers'`: the lobby makes each
 * Controller phone's holder a Player). The board shows the question, who has
 * still to answer, and at the reveal the right answer and what everyone
 * earned; each Controller shows the question and its four choices as buttons
 * to its Holder, then "locked in", then right or wrong. A question closes when
 * every Holder answered or `QUIZ.answerMs` ran out; the right answer and the
 * scores stay up for `QUIZ.revealMs`. A right answer earns more the sooner it
 * reached the host. After `QUIZ.questions` questions the most points win.
 *
 * Each Player holds one Controller for the whole Match: the Controller it is
 * seated at (`Player.deviceId`); a Player without a seat takes the next
 * Controller nobody holds. A Controller left over has no Holder and waits.
 *
 * The host is event-driven (`tickHz: 0`): Controllers' messages and two
 * timers move it. Whether an answer was right stays on the host until the
 * reveal, and each Controller learns its own from a state published to it alone.
 */
export default defineGame<QuizState, QuizMessage>({
  manifest: {
    id: 'mgc.quiz',
    name: 'Quiz',
    version: '1.0.0',
    tiles: { min: 1, max: 1 },
    controllers: { min: 1, max: 4 },
    players: { min: 1, max: 4 },
    tickHz: 0,
    bots: false,
    seats: 'controllers',
    host: './index.js',
    view: './index.js',
  },

  host(ctx) {
    const { match } = ctx;
    const players = match.players.map((p) => p.playerId);
    /** Each held Controller and its Holder, for the whole Match: a Player's own seat first, then the free Controllers in order. */
    const controllers = match.devices.filter((d) => d.role === 'controller').map((d) => d.deviceId);
    const held: [DeviceId, PlayerId][] = match.players.flatMap((p): [DeviceId, PlayerId][] => (p.deviceId !== undefined && controllers.includes(p.deviceId) ? [[p.deviceId, p.playerId]] : []));
    const free = controllers.filter((c) => !held.some(([h]) => h === c));
    for (const p of match.players) {
      if (held.some(([, id]) => id === p.playerId)) continue;
      const c = free.shift();
      if (c !== undefined) held.push([c, p.playerId]);
    }
    for (const [controller, playerId] of held) ctx.setHolder(controller, playerId);

    // This Match's questions: the bank shuffled by the seed (Fisher–Yates), the first TOTAL of it.
    const rand = random(match.seed);
    const deck = [...QUESTIONS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    deck.length = TOTAL;

    const scores: Record<PlayerId, number> = Object.fromEntries(players.map((p) => [p, 0]));
    let round = 0;
    let phase: Phase = 'ask';
    let askedAt = 0;
    let until = 0;
    let pausedAt = 0;
    /** This question's answers, first first; `points` count from the reveal on. */
    let answers: { playerId: PlayerId; choice: number; points: number }[] = [];

    const board = (): BoardState => {
      const q = deck[round]!;
      return {
        kind: 'board',
        phase,
        round,
        question: q.text,
        choices: [...q.choices],
        until,
        answered: answers.map((a) => a.playerId),
        scores: { ...scores },
        ...(phase === 'reveal' && {
          answer: q.answer,
          gained: Object.fromEntries(players.map((p) => [p, answers.find((a) => a.playerId === p)?.points ?? 0])),
        }),
      };
    };
    const own = (playerId: PlayerId): ControllerState => {
      const q = deck[round]!;
      const mine = answers.find((a) => a.playerId === playerId);
      return {
        kind: 'controller',
        phase,
        round,
        question: q.text,
        choices: [...q.choices],
        picked: mine?.choice ?? null,
        score: scores[playerId]!,
        ...(phase === 'reveal' && { answer: q.answer, gained: mine?.points ?? 0 }),
      };
    };
    /** The board's state to every Device, then each held Controller its own, so that a Controller's `latest()` is its own. */
    const publish = (): void => {
      ctx.publish(board());
      for (const [controller, playerId] of held) ctx.publish(own(playerId), controller);
    };

    const ask = (): void => {
      phase = 'ask';
      answers = [];
      askedAt = ctx.now();
      until = askedAt + QUIZ.answerMs;
      ctx.timer('reveal', QUIZ.answerMs);
      publish();
    };
    const reveal = (): void => {
      phase = 'reveal';
      ctx.timer('reveal', null); // when every Holder answered early
      for (const a of answers) scores[a.playerId]! += a.points;
      until = ctx.now() + QUIZ.revealMs;
      ctx.timer('next', QUIZ.revealMs);
      const q = deck[round]!;
      ctx.log(`Answer ${LETTERS[q.answer]}: ${q.choices[q.answer]}`);
      publish();
    };
    const next = (): void => {
      if (round + 1 < deck.length) {
        round++;
        ask();
        return;
      }
      // Ties keep `match.players` order: the sort is stable.
      ctx.end({ scores: { ...scores }, ranking: [...players].sort((a, b) => scores[b]! - scores[a]!) });
    };

    ask();
    return {
      // `from.playerId` is the Holder when the answer reached the Host; a Controller without one, or a Tile, has none.
      onMessage(msg, from) {
        const { playerId } = from;
        if (phase !== 'ask' || playerId === undefined || answers.some((a) => a.playerId === playerId)) return;
        // A message is the sending phone's claim: check it is an answer this question has.
        const q = deck[round]!;
        if (msg.t !== 'answer' || !Number.isInteger(msg.choice) || msg.choice < 0 || msg.choice >= q.choices.length) return;
        // Timed by its arrival here, on the shared clock: a phone's own clock does not count.
        const late = Math.min(1, (ctx.now() - askedAt) / QUIZ.answerMs);
        const points = msg.choice === q.answer ? Math.round(QUIZ.fastest - (QUIZ.fastest - QUIZ.slowest) * late) : 0;
        answers.push({ playerId, choice: msg.choice, points });
        ctx.log(`${nameOf(match, playerId)} locked in`);
        if (held.every(([, p]) => answers.some((a) => a.playerId === p))) {
          reveal();
          return;
        }
        // Only the board and the answering Controller changed.
        ctx.publish(board());
        ctx.publish(own(playerId), from.deviceId);
      },
      onTimer(tag) {
        // A due `reveal` may already be on its way when the last Holder answers.
        if (tag === 'reveal' && phase === 'ask') reveal();
        else if (tag === 'next' && phase === 'reveal') next();
      },
      // The timers freeze with the pause; the answer time and the shown deadline move on by the paused time.
      onPause() {
        pausedAt = ctx.now();
      },
      onResume(now) {
        askedAt += now - pausedAt;
        until += now - pausedAt;
        publish();
      },
    };
  },

  view(ctx) {
    const { match } = ctx;
    if (ctx.role === 'controller') {
      /** The last state the host published to this Controller alone; the board's broadcasts reach it too and are ignored. */
      let mine: ControllerState | undefined;
      let ui: { who: HTMLElement; where: HTMLElement; question: HTMLElement; status: HTMLElement; buttons: HTMLButtonElement[] } | undefined;
      const render = (): void => {
        if (!ui) return;
        const holder = ctx.holder();
        const s = holder === null ? undefined : mine;
        ui.who.textContent = holder === null ? '' : `${nameOf(match, holder)} · ${s?.score ?? 0}`;
        ui.where.textContent = s ? `${s.round + 1} / ${TOTAL}` : '';
        ui.question.textContent = s?.question ?? '';
        const [status, tone] =
          holder === null ? ['Waiting for a player', DIM]
          : !s ? ['Get ready', DIM]
          : s.phase === 'ask' ? (s.picked === null ? ['Pick an answer', FG] : ['Locked in', FG])
          : s.picked === null ? ['Too slow', DIM]
          : s.picked === s.answer ? [`Right! +${s.gained ?? 0}`, GOOD]
          : ['Wrong', BAD];
        ui.status.textContent = status;
        ui.status.style.color = tone;
        ui.buttons.forEach((b, k) => {
          const choice = s?.choices[k];
          b.style.visibility = choice === undefined ? 'hidden' : 'visible';
          b.textContent = `${LETTERS[k]}\u2003${choice ?? ''}`; // an em space: HTML collapses ASCII ones
          // Open: every choice lit. Locked in: the pick lit. Revealed: the right one green, a wrong pick red.
          const [bg, fg] =
            !s ? [FAINT, DIM]
            : s.phase === 'reveal' && k === s.answer ? [GOOD, BG]
            : s.phase === 'reveal' && k === s.picked ? [BAD, BG]
            : s.phase === 'ask' && (s.picked === null || k === s.picked) ? [FG, BG]
            : [FAINT, DIM];
          b.style.background = bg;
          b.style.color = fg;
        });
      };
      return {
        // The buttons handle their own events.
        input: 'off',
        mount(root) {
          const doc = root.ownerDocument;
          // CSS px per platform mm on this phone (CSS `mm` is not it on phones); a Controller has no Surface to ask.
          const mm = root.clientWidth / ctx.screenMm.x;
          const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string): HTMLElementTagNameMap[K] => {
            const e = doc.createElement(tag);
            e.style.cssText = css;
            return e;
          };
          // Inline styles only: the view must not reach outside `root`, and the page's own CSS reaches in.
          const box = el('div', `position:absolute;inset:0;display:flex;flex-direction:column;gap:${3 * mm}px;padding:${4 * mm}px;box-sizing:border-box;background:${BG};color:${FG};font:500 ${4 * mm}px system-ui,sans-serif;user-select:none;-webkit-user-select:none`);
          const head = el('div', `display:flex;justify-content:space-between;gap:${2 * mm}px;color:${DIM};white-space:nowrap;overflow:hidden`);
          const who = el('span', 'overflow:hidden;text-overflow:ellipsis');
          const where = el('span', '');
          const question = el('div', `font:650 ${5.5 * mm}px system-ui,sans-serif;line-height:1.2;color:${FG}`);
          const status = el('div', `font:700 ${6 * mm}px system-ui,sans-serif;line-height:1.1;min-height:1.1em`);
          // Last in the tree: the headless test screen's pointer hits the last element appended.
          const grid = el('div', `flex:1;min-height:0;display:flex;flex-direction:column;gap:${2.5 * mm}px`);
          const buttons = LETTERS.map((_, k) => {
            const b = el('button', `flex:1;min-height:0;margin:0;border:0;border-radius:${3 * mm}px;padding:0 ${5 * mm}px;text-align:left;font:600 ${6 * mm}px system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;touch-action:manipulation`);
            b.type = 'button';
            b.addEventListener('pointerdown', () => {
              // The host takes the first answer anyway; this only spares the wire.
              if (ctx.holder() !== null && mine?.phase === 'ask' && mine.picked === null) ctx.send({ t: 'answer', choice: k });
            });
            return b;
          });
          // One node per `append`: the headless test screen's `append` takes only its first argument.
          head.append(who);
          head.append(where);
          for (const b of buttons) grid.append(b);
          box.append(head);
          box.append(question);
          box.append(status);
          box.append(grid);
          root.append(box);
          ui = { who, where, question, status, buttons };
          render();
        },
        onState(s) {
          if (s.kind !== 'controller') return;
          mine = s;
          render();
        },
        onHolder(controller) {
          if (controller === ctx.deviceId) render();
        },
      };
    }

    return {
      draw({ ctx: g, state: s, now, tile }) {
        if (!tile || s?.kind !== 'board') return;
        // Tile-local mm from here: the board reads upright on its own phone, however its Tile lies in the World.
        g.translate(tile.x, tile.y);
        g.rotate(tile.rot);
        const { w, h } = tile;
        const pad = w * 0.06;
        const inner = w - 2 * pad;
        const font = (weight: number, size: number): string => `${weight} ${size}px system-ui, sans-serif`;

        // Which question, and the seconds left to answer.
        g.textBaseline = 'top';
        g.font = font(500, w * 0.05);
        g.fillStyle = DIM;
        g.textAlign = 'left';
        g.fillText(`Question ${s.round + 1} of ${TOTAL}`, pad, pad);
        g.textAlign = 'right';
        g.fillText(s.phase === 'ask' ? `${Math.max(0, Math.ceil((s.until - now) / 1000))} s` : 'Answer', w - pad, pad);

        const size = w * 0.075;
        g.font = font(650, size);
        g.fillStyle = FG;
        g.textAlign = 'left';
        const lines = wrap(g, s.question, inner).slice(0, 4);
        lines.forEach((line, k) => g.fillText(line, pad, pad + w * 0.1 + k * size * 1.25, inner));
        let y = pad + w * 0.1 + lines.length * size * 1.25 + h * 0.03;
        const line = Math.min(w * 0.075, (h - pad - y - h * 0.12) / Math.max(2, match.players.length + 1));

        if (s.phase === 'ask') {
          // Who has still to answer: names, large; the ones already in, dimmed with a check.
          const waiting = match.players.filter((p) => !s.answered.includes(p.playerId));
          g.textBaseline = 'top';
          g.font = font(500, w * 0.05);
          g.fillStyle = DIM;
          g.fillText(waiting.length === 0 ? 'Everyone answered' : waiting.length === 1 ? 'Waiting for' : `Waiting for ${waiting.length}`, pad, y);
          y += w * 0.08;
          g.textBaseline = 'middle';
          match.players.forEach((p) => {
            const done = s.answered.includes(p.playerId);
            g.font = font(done ? 500 : 650, line * 0.7);
            g.fillStyle = done ? DIM : FG;
            g.textAlign = 'left';
            g.fillText(p.name, pad, y + line / 2, inner * 0.7);
            g.textAlign = 'right';
            g.fillStyle = done ? GOOD : DIM;
            g.fillText(done ? '✓' : '…', w - pad, y + line / 2);
            y += line;
          });
        } else {
          // The right answer, then what each Player earned and the standings so far.
          g.textBaseline = 'top';
          g.font = font(500, w * 0.05);
          g.fillStyle = DIM;
          g.fillText('Answer', pad, y);
          y += w * 0.07;
          g.fillStyle = GOOD;
          g.fillRect(pad, y, inner, line);
          g.textBaseline = 'middle';
          g.fillStyle = BG;
          g.font = font(700, line * 0.42);
          g.textAlign = 'left';
          g.fillText(LETTERS[s.answer ?? 0] ?? '', pad + line * 0.3, y + line / 2);
          g.font = font(600, line * 0.4);
          g.fillText(s.choices[s.answer ?? 0] ?? '', pad + line * 0.85, y + line / 2, inner - line);
          y += line + h * 0.03;
          const ranked = [...match.players].sort((a, b) => (s.scores[b.playerId] ?? 0) - (s.scores[a.playerId] ?? 0));
          ranked.forEach((p, k) => {
            const gained = s.gained?.[p.playerId] ?? 0;
            g.font = font(k === 0 ? 650 : 500, line * 0.65);
            g.textAlign = 'left';
            g.fillStyle = FG;
            g.fillText(`${k + 1}. ${p.name}`, pad, y + line / 2, inner * 0.55);
            g.textAlign = 'right';
            g.fillText(String(s.scores[p.playerId] ?? 0), w - pad, y + line / 2);
            g.fillStyle = gained > 0 ? GOOD : BAD;
            g.fillText(gained > 0 ? `+${gained}` : '0', w - pad - inner * 0.25, y + line / 2);
            y += line;
          });
          if (s.round + 1 === TOTAL) {
            g.textAlign = 'center';
            g.fillStyle = DIM;
            g.font = font(500, w * 0.05);
            g.fillText('Final standings', w / 2, Math.min(h - pad - w * 0.05, y + h * 0.02));
          }
        }
      },
    };
  },
});
