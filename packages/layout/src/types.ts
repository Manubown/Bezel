import type { PeerId } from '@mgc/core';

/** All lengths are millimetres in "world" space unless stated otherwise. */
export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Physical screen size of one device, derived from CSS px / pxPerMm. */
export interface DeviceSize {
  id: PeerId;
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
