export { Surface, type Rect, type Vec2 } from '@mgc/layout';
export type {
  CloseReason,
  Device,
  DeviceId,
  HolderEntry,
  Input,
  JsonValue,
  Manifest,
  MatchInfo,
  MatchResult,
  PauseReason,
  Player,
  PlayerId,
  Range,
  RawInput,
  Sender,
  Tile,
} from './types';
export {
  defineGame,
  type Frame,
  type Game,
  type GameSpec,
  type HostContext,
  type HostHandlers,
  type ViewContext,
  type ViewHandlers,
} from './game';
export { runMatch, type MatchEvent, type MatchHandle, type MatchOptions } from './match';
export { inProcessLink } from './in-process';
export { PLAYER_COLOURS, playerColour } from './palette';
export {
  WIRE_VERSION,
  type ClockWire,
  type Down,
  type Fault,
  type HostDown,
  type HostUp,
  type Link,
  type LinkFactory,
  type Log,
  type NetDown,
  type NetFrame,
  type NetUp,
  type RejectOf,
  type Shared,
  type Up,
  type ViewDown,
  type ViewUp,
} from './wire';
