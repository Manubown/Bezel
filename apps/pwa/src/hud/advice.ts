import type { HudOptions } from '../hud';
import { Dropouts, describeDropping } from '../join';

/**
 * The Host's advice line, once one Device's connection ended three times in a row without lasting (`Dropouts`),
 * until that phone's connection lasts; in Maker mode with the count. It heads the sheet (`sheet`, the HUD's root), so
 * it shows above the bar folded or open and never covers it; not while a Match runs. Returns its render; it reads the
 * roster on every call, so call it on every change of it.
 */
export function dropoutAdvice(sheet: HTMLElement, o: Pick<HudOptions, 'session' | 'play' | 'maker'>): () => void {
  const { session, play, maker } = o;
  const line = document.createElement('p');
  line.className = 'advice';
  line.setAttribute('role', 'status');
  line.hidden = true;
  sheet.prepend(line);
  const dropouts = new Dropouts();
  /** When the named phone's connection will have lasted: the line goes then without a change of the roster. */
  let due: number | undefined;
  const render = (): void => {
    const now = performance.now();
    const roster = session.roster();
    dropouts.see(roster.flatMap((e) => (e.present ? [e.info.deviceId] : [])), now);
    const dropping = dropouts.dropping(now);
    clearTimeout(due);
    due = dropping?.until === undefined ? undefined : window.setTimeout(render, dropping.until - now);
    line.hidden = !dropping || play.running;
    if (!dropping) return;
    // Named as the roster names it (its row reads "disconnected" while it is away).
    const name = roster.find((e) => e.info.deviceId === dropping.deviceId)?.info.name || 'A phone';
    const words = describeDropping(name, dropping.drops);
    line.textContent = maker ? `${words.line} · ${words.makers}` : words.line;
  };
  return render;
}
