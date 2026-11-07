import type { JsonValue } from './types';

/**
 * Throws a `TypeError` at the call site unless `value` is plain JSON: the same
 * payload must survive structured clone (links) and JSON (WebRTC) identically,
 * so functions, `undefined`, non-finite numbers, class instances (`Map`,
 * `Date`, …) and cycles are refused rather than silently altered.
 */
export function assertJson(value: unknown, path: string): asserts value is JsonValue {
  check(value, path, new Set());
}

/** `assertJson` as a check, for values off a link or the net. */
export function isJson(value: unknown): value is JsonValue {
  try {
    check(value, '', new Set());
    return true;
  } catch {
    return false;
  }
}

function check(v: unknown, path: string, open: Set<object>): void {
  switch (typeof v) {
    case 'string':
    case 'boolean':
      return;
    case 'number':
      if (Number.isFinite(v)) return;
      throw new TypeError(`${path} is ${v}, not JSON`);
    case 'object': {
      if (v === null) return;
      if (open.has(v)) throw new TypeError(`${path} is circular, not JSON`);
      const proto = Object.getPrototypeOf(v) as unknown;
      const isArray = Array.isArray(v);
      if (!isArray && proto !== Object.prototype && proto !== null) {
        throw new TypeError(`${path} is a ${v.constructor?.name ?? 'non-plain object'}, not JSON`);
      }
      open.add(v);
      if (isArray) v.forEach((item, i) => check(item, `${path}[${i}]`, open));
      else for (const [k, item] of Object.entries(v)) check(item, `${path}.${k}`, open);
      open.delete(v);
      return;
    }
    default:
      throw new TypeError(`${path} is ${typeof v === 'function' ? 'a function' : typeof v}, not JSON`);
  }
}
