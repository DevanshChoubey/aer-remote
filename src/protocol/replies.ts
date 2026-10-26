import type { CborMap, CborValue } from './cbor';
import { decodeScheduleEntry, type Schedule } from './schedule';

export interface Reply {
  mT: number;
  mN: number;
  ack: number;
  body: CborMap;
}

const isMap = (v: CborValue | undefined): v is CborMap =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);

export function toReply(v: CborValue): Reply | null {
  if (!isMap(v)) return null;
  const { mT, mN, ack } = v;
  if (typeof mT !== 'number' || typeof mN !== 'number') return null;
  return { mT, mN, ack: typeof ack === 'number' ? ack : 0, body: v };
}

function toBytes(v: CborValue | undefined): Uint8Array | null {
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v) && v.every((x) => typeof x === 'number'))
    return Uint8Array.from(v as number[]);
  return null;
}

export function parseSchedules(r: Reply): Schedule[] {
  const list = r.body.S;
  if (!Array.isArray(list)) return [];
  const out: Schedule[] = [];
  for (const item of list) {
    const bytes = isMap(item) ? toBytes(item.s) : null;
    if (bytes) out.push(decodeScheduleEntry(bytes));
  }
  return out;
}
