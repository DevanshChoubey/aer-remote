import { createFakeTransport } from '@/ble/testing/fakeDispenser';
import type { BleConnection } from '@/ble/transport';
import { decodeFirst } from '@/protocol/cbor';
import {
  fetchStatusMsg,
  refillMsg,
  retrieveSchedulesMsg,
  setSchedulesMsg,
  sprayNowMsg,
  stopAutoSprayMsg,
  testLedMsg,
} from '@/protocol/messages';
import { parseSchedules, toReply, type Reply } from '@/protocol/replies';
import type { Schedule } from '@/protocol/schedule';
import { parseStatus } from '@/protocol/status';
import { charUuid, DEFAULT_CHANNELS } from '@/protocol/uuids';

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const sched: Schedule = {
  start: { h: 8, m: 0 },
  end: { h: 9, m: 0 },
  days: ['mon', 'fri'],
  interval: 20,
};

async function open(opts = {}): Promise<{
  conn: BleConnection;
  chunks: Uint8Array[];
  t: ReturnType<typeof createFakeTransport>;
}> {
  const t = createFakeTransport({ d1: opts });
  const conn = await t.connect('d1', 1000);
  const chunks: Uint8Array[] = [];
  await conn.subscribe(DEFAULT_CHANNELS.reply, (b) => chunks.push(b));
  return { conn, chunks, t };
}

function reply(bytes: Uint8Array): Reply {
  const d = decodeFirst(bytes);
  const r = d ? toReply(d.value) : null;
  if (!r) throw new Error('not a reply');
  return r;
}

describe('fake dispenser', () => {
  it('answers fetchStatus on the command char with a 157 reply', async () => {
    const { conn, chunks } = await open({ batteryMv: 2900 });
    await conn.write(DEFAULT_CHANNELS.command, fetchStatusMsg(5).bytes);
    await flush();
    expect(chunks).toHaveLength(1);
    const r = reply(chunks[0] ?? new Uint8Array());
    expect([r.mT, r.mN, r.ack]).toEqual([157, 5, 200]);
    expect(parseStatus(r)).toMatchObject({ batteryMv: 2900, autoSpray: null });
  });

  it('ignores writes on a non-command characteristic', async () => {
    const { conn, chunks } = await open();
    await conn.write(charUuid('0002'), fetchStatusMsg(1).bytes);
    await flush();
    expect(chunks).toHaveLength(0);
  });

  it('honours a custom commandChar', async () => {
    const { conn, chunks } = await open({ commandChar: charUuid('0002') });
    await conn.write(charUuid('0002'), fetchStatusMsg(1).bytes);
    await flush();
    expect(chunks).toHaveLength(1);
  });

  it('round-trips schedules and clears them', async () => {
    const { conn, chunks, t } = await open();
    await conn.write(DEFAULT_CHANNELS.schedule, setSchedulesMsg(1, [sched]).bytes);
    await conn.write(DEFAULT_CHANNELS.command, retrieveSchedulesMsg(2).bytes);
    await flush();
    expect(chunks).toHaveLength(2);
    expect(reply(chunks[0] ?? new Uint8Array()).mT).toBe(153);
    expect(parseSchedules(reply(chunks[1] ?? new Uint8Array()))).toEqual([sched]);
    expect(t.state('d1').schedules).toEqual([sched]);
  });

  it('tracks spray, stop, refill and led state', async () => {
    const { conn, chunks, t } = await open();
    await conn.write(DEFAULT_CHANNELS.command, sprayNowMsg(1, 20).bytes);
    await conn.write(DEFAULT_CHANNELS.command, testLedMsg(2).bytes);
    await conn.write(DEFAULT_CHANNELS.command, fetchStatusMsg(3).bytes);
    await flush();
    expect(parseStatus(reply(chunks[2] ?? new Uint8Array()))).toMatchObject({
      autoSpray: 20,
      spraysSinceRefill: 1,
    });
    expect(t.state('d1').ledBlinks).toBe(1);
    await conn.write(DEFAULT_CHANNELS.command, stopAutoSprayMsg(4).bytes);
    await conn.write(DEFAULT_CHANNELS.command, refillMsg(5).bytes);
    await flush();
    expect(t.state('d1')).toMatchObject({ autoSpray: null, spraysSinceRefill: 0 });
    expect(t.state('d1').writes.map((w) => w.mT)).toEqual([104, 113, 107, 106, 105]);
  });

  it('rejects connect when busy and for unknown devices', async () => {
    const t = createFakeTransport({ b: { busy: true } });
    await expect(t.connect('b', 1000)).rejects.toThrow();
    await expect(t.connect('nope', 1000)).rejects.toThrow();
  });

  it('splits replies into two notifications that reassemble', async () => {
    const { conn, chunks } = await open({ splitReplies: true });
    await conn.write(DEFAULT_CHANNELS.command, fetchStatusMsg(9).bytes);
    await flush();
    expect(chunks).toHaveLength(2);
    const joined = new Uint8Array([...(chunks[0] ?? []), ...(chunks[1] ?? [])]);
    expect(reply(joined).mN).toBe(9);
  });

  it('reassembles a request split across writes', async () => {
    const { conn, chunks } = await open();
    const bytes = fetchStatusMsg(4).bytes;
    await conn.write(DEFAULT_CHANNELS.command, bytes.slice(0, 3));
    await flush();
    expect(chunks).toHaveLength(0);
    await conn.write(DEFAULT_CHANNELS.command, bytes.slice(3));
    await flush();
    expect(chunks).toHaveLength(1);
  });

  it('sends a stale reply first when lateReplyFromPrevious is set', async () => {
    const { conn, chunks } = await open({ lateReplyFromPrevious: true });
    await conn.write(DEFAULT_CHANNELS.command, fetchStatusMsg(7).bytes);
    await flush();
    expect(chunks.map((c) => reply(c).mN)).toEqual([6, 7]);
  });

  it('sends no reply when dropReplies is set but still applies the write', async () => {
    const { conn, chunks, t } = await open({ dropReplies: true });
    await conn.write(DEFAULT_CHANNELS.command, testLedMsg(1).bytes);
    await flush();
    expect(chunks).toHaveLength(0);
    expect(t.state('d1').ledBlinks).toBe(1);
  });

  it('disconnects after the nth write, without a reply, and rejects later writes', async () => {
    const { conn, chunks } = await open({ disconnectAfter: 2 });
    const dropped = jest.fn();
    conn.onDisconnect(dropped);
    await conn.write(DEFAULT_CHANNELS.command, fetchStatusMsg(1).bytes);
    await conn.write(DEFAULT_CHANNELS.command, fetchStatusMsg(2).bytes);
    await flush();
    expect(chunks).toHaveLength(1);
    expect(dropped).toHaveBeenCalledTimes(1);
    await expect(conn.write(DEFAULT_CHANNELS.command, fetchStatusMsg(3).bytes)).rejects.toThrow();
  });

  it('exposes characteristics and scans', async () => {
    const t = createFakeTransport({ d1: {} });
    const conn = await t.connect('d1', 1000);
    const chars = await conn.characteristics();
    expect(chars.find((c) => c.uuid === DEFAULT_CHANNELS.reply)?.notifiable).toBe(true);
    const found: string[] = [];
    await t.scan((d) => found.push(d.id), 1000).done;
    expect(found).toEqual(['d1']);
    expect(await t.adapterState()).toBe('on');
    expect(await t.requestPermissions()).toBe(true);
  });
});
