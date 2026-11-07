import type { PeerId, Transport } from '@mgc/core';
import { TEMPLATE_IDS } from './templates';
import type { DeviceRect, Layout, TemplateId } from './types';

export const LAYOUT_CHANNEL = 'layout';

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

/** Host → everyone (or one late joiner). */
export function publishLayout(transport: Transport, layout: Layout, to?: PeerId): void {
  transport.send(LAYOUT_CHANNEL, layout, to);
}

/** Peer side: receive validated layouts from the host only. */
export function subscribeLayout(transport: Transport, hostId: () => PeerId | undefined, onLayout: (l: Layout) => void): () => void {
  return transport.onMessage(LAYOUT_CHANNEL, (data, from) => {
    if (from === hostId() && isLayout(data)) onLayout(data);
  });
}
