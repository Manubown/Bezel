export type { Vec2, Rect, DeviceSize, DeviceRect, TemplateId, Layout } from './types';
export { Surface, aabbOf, unionRect } from './surface';
export { buildLayout, DEFAULT_GAP_MM, TEMPLATE_IDS } from './templates';
export { LAYOUT_CHANNEL, isLayout, publishLayout, subscribeLayout } from './channel';
