import { TEMPLATE_IDS } from './templates';

/** All lengths are millimetres in "world" space unless stated otherwise. Type aliases, not interfaces, so they are `JsonValue` and can appear in a Game's state. */
export type Vec2 = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

/** Physical screen size of one device, derived from CSS px / pxPerMm. */
export interface DeviceSize {
  /** The Device id; layout treats it as an opaque string. */
  id: string;
  w: number;
  h: number;
}

/**
 * Placement of one device in world space. `x,y` is the world position of the
 * screen's top-left corner; `rot` (radians, clockwise) rotates the screen's
 * local axes about that corner. Local space: origin top-left, x right, y down.
 */
export interface DeviceRect extends DeviceSize {
  x: number;
  y: number;
  rot: number;
}

export type TemplateId = 'row' | 'column' | 'grid';

export interface Layout {
  template: TemplateId;
  /** Order matches placement order; index is the number shown on each phone. */
  devices: DeviceRect[];
  /** Axis-aligned world bounding box of all devices. */
  bounds: Rect;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isDeviceRect(v: unknown): v is DeviceRect {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    isFiniteNumber(r['x']) &&
    isFiniteNumber(r['y']) &&
    isFiniteNumber(r['w']) &&
    isFiniteNumber(r['h']) &&
    isFiniteNumber(r['rot'])
  );
}

/** Pure validator for a `Layout` received from elsewhere (e.g. over the wire). */
export function isLayout(v: unknown): v is Layout {
  if (!v || typeof v !== 'object') return false;
  const l = v as Record<string, unknown>;
  const b = l['bounds'] as Record<string, unknown> | undefined;
  return (
    TEMPLATE_IDS.includes(l['template'] as TemplateId) &&
    Array.isArray(l['devices']) &&
    l['devices'].every(isDeviceRect) &&
    !!b &&
    isFiniteNumber(b['x']) &&
    isFiniteNumber(b['y']) &&
    isFiniteNumber(b['w']) &&
    isFiniteNumber(b['h'])
  );
}
