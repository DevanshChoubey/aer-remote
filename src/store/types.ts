import type { DeviceStatus } from '@/protocol/status';
import type { Schedule } from '@/protocol/schedule';
import type { Channels } from '@/protocol/uuids';

export interface SavedDispenser {
  id: string;
  name: string;
  homeTimeZone: string;
  channels?: Channels;
  /** Whether the dispenser's clock was set the last time we connected. */
  clockSet?: boolean;
  lastStatus?: DeviceStatus & { at: string };
  schedules?: { list: Schedule[]; at: string };
}

export interface DispenserStore {
  list(): Promise<SavedDispenser[]>;
  get(id: string): Promise<SavedDispenser | null>;
  upsert(d: SavedDispenser): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(cb: () => void): () => void;
}
