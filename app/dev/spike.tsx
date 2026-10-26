// Dev-only hardware spike (Task 7). Throwaway: plain React Native, no theme, no copy catalogue.
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createRnTransport } from '@/ble/rnTransport';
import type { BleConnection, BleTransport, FoundDevice } from '@/ble/transport';
import { DispenserSession, openSession } from '@/device/session';
import { zoneInfo } from '@/device/time';
import {
  fetchStatusMsg,
  retrieveSchedulesMsg,
  removeSchedulesMsg,
  setSchedulesMsg,
  setTimeMsg,
  sprayNowMsg,
  stopAutoSprayMsg,
  testLedMsg,
  type OutgoingMessage,
} from '@/protocol/messages';
import { parseSchedules, type Reply } from '@/protocol/replies';
import type { Schedule } from '@/protocol/schedule';
import { parseStatus } from '@/protocol/status';

const hex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

const TEST_SCHEDULE: Schedule = {
  start: { h: 8, m: 0 },
  end: { h: 8, m: 30 },
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  interval: 20,
};
const SCAN_MS = 8000;
const CONNECT_MS = 8000;
const PASS_BAR_MS = 5000;
const REPEATS = 10;
const HOME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

type Log = (line: string) => void;

// Module-level on purpose: this throwaway screen has exactly one live link.
const live: { session: DispenserSession | null; transport: BleTransport | null } = {
  session: null,
  transport: null,
};

/** Wraps a transport so every write, notification and connect time lands in the log. */
function loggingTransport(inner: BleTransport, log: Log): BleTransport {
  return {
    adapterState: async () => {
      const s = await inner.adapterState();
      log(`adapter: ${s}`);
      return s;
    },
    requestPermissions: async () => {
      const ok = await inner.requestPermissions();
      log(`permissions: ${ok}`);
      return ok;
    },
    scan: (onFound, ms) => inner.scan(onFound, ms),
    connect: async (id, ms) => {
      const t0 = Date.now();
      try {
        const conn = await inner.connect(id, ms);
        log(`connect ok in ${Date.now() - t0} ms`);
        return logged(conn, log);
      } catch (e) {
        log(`connect failed after ${Date.now() - t0} ms: ${String(e)}`);
        throw e;
      }
    },
  };
}

function logged(conn: BleConnection, log: Log): BleConnection {
  return {
    deviceId: conn.deviceId,
    characteristics: async () => {
      const list = await conn.characteristics();
      log(
        `chars: ${list.map((c) => `${c.uuid.slice(4, 8)}${c.writable ? ' W' : ''}${c.notifiable ? ' N' : ''}`).join(', ')}`,
      );
      return list;
    },
    write: async (char, bytes) => {
      log(`TX ${char.slice(4, 8)}: ${hex(bytes)}`);
      await conn.write(char, bytes);
    },
    subscribe: (char, onData, onError) =>
      conn.subscribe(
        char,
        (b) => {
          log(`RX ${char.slice(4, 8)}: ${hex(b)}`);
          onData(b);
        },
        (e) => {
          log(`MONITOR ERROR: ${e.message}`);
          onError?.(e);
        },
      ),
    onDisconnect: (cb) => conn.onDisconnect(cb),
    disconnect: async () => {
      log('disconnect');
      await conn.disconnect();
    },
  };
}

export default function Spike(): React.JSX.Element {
  const [lines, setLines] = useState<string[]>([]);
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const log = useCallback<Log>((line) => {
    setLines((prev) => [...prev.slice(-300), `${new Date().toISOString().slice(11, 23)} ${line}`]);
  }, []);

  const getTransport = useCallback((): BleTransport => {
    live.transport ??= loggingTransport(createRnTransport(), log);
    return live.transport;
  }, [log]);

  const run = async (label: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(true);
    log(`> ${label}`);
    try {
      await fn();
    } catch (e) {
      log(`ERROR ${label}: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const need = (): { id: string; s: DispenserSession } => {
    const s = live.session;
    if (!selected || !s) throw new Error('connect first');
    return { id: selected, s };
  };

  const send = async (build: (mN: number) => OutgoingMessage): Promise<Reply> => {
    const { s } = need();
    const reply = await s.send(build(s.nextMN()));
    log(`reply mT=${reply.mT} mN=${reply.mN} ack=${reply.ack}`);
    return reply;
  };

  const scan = async (): Promise<void> => {
    const t = getTransport();
    if ((await t.adapterState()) !== 'on') throw new Error('bluetooth not ready');
    setFound([]);
    const handle = t.scan((d) => {
      setFound((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d]));
      log(`found ${d.id} ${d.name ?? '-'} rssi ${d.rssi ?? '?'}`);
    }, SCAN_MS);
    await handle.done;
    log('scan finished');
  };

  const connect = async (): Promise<void> => {
    if (!selected) throw new Error('pick a device first');
    await live.session?.close();
    live.session = null;
    const t0 = Date.now();
    const opened = await openSession(getTransport(), selected, HOME_ZONE, undefined, {
      connectTimeoutMs: CONNECT_MS,
    });
    live.session = opened.session;
    log(`session open in ${Date.now() - t0} ms, clockSet=${opened.clockSet}`);
    log(`channels: ${JSON.stringify(opened.channels)}`);
    log(`status: ${JSON.stringify(opened.status)}`);
  };

  const fetchStatus = async (): Promise<void> => {
    log(JSON.stringify(parseStatus(await send(fetchStatusMsg))));
  };

  const setTime = async (): Promise<void> => {
    const tz = zoneInfo(HOME_ZONE, new Date());
    await send((mN) => setTimeMsg(mN, Math.floor(Date.now() / 1000), tz));
  };

  const spray = async (): Promise<void> => {
    await send((mN) => sprayNowMsg(mN, 0));
  };

  const auto = async (interval: 10 | null): Promise<void> => {
    await send((mN) => (interval === null ? stopAutoSprayMsg(mN) : sprayNowMsg(mN, interval)));
  };

  const readSchedules = async (): Promise<void> => {
    log(JSON.stringify(parseSchedules(await send(retrieveSchedulesMsg))));
  };

  const saveSchedule = async (): Promise<void> => {
    await send(removeSchedulesMsg);
    await new Promise((r) => setTimeout(r, 3000));
    await send((mN) => setSchedulesMsg(mN, [TEST_SCHEDULE]));
  };

  const removeSchedules = async (): Promise<void> => {
    await send(removeSchedulesMsg);
  };

  const blink = async (): Promise<void> => {
    await send(testLedMsg);
  };

  const disconnect = async (): Promise<void> => {
    await live.session?.close();
    live.session = null;
  };

  const passBar = async (): Promise<void> => {
    if (!selected) throw new Error('pick a device first');
    await live.session?.close();
    live.session = null;
    const times: number[] = [];
    let pass = 0;
    for (let i = 1; i <= REPEATS; i++) {
      const t0 = Date.now();
      try {
        // One attempt per run so a flaky link counts as a failure, as the pass bar demands.
        const opened = await openSession(getTransport(), selected, HOME_ZONE, undefined, {
          connectTimeoutMs: PASS_BAR_MS,
          connectAttempts: 1,
        });
        const ms = Date.now() - t0;
        await opened.session.close();
        times.push(ms);
        if (ms <= PASS_BAR_MS) pass++;
        log(`run ${i}: ok ${ms} ms`);
      } catch (e) {
        log(`run ${i}: FAIL after ${Date.now() - t0} ms (${String(e)})`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    log(`PASS BAR: ${pass}/${REPEATS} within ${PASS_BAR_MS} ms; times ${times.join(', ')} ms`);
  };

  const actions: [string, () => Promise<void>][] = [
    ['Scan', scan],
    ['Connect', connect],
    ['Fetch status', fetchStatus],
    ['Set time', setTime],
    ['Spray now', spray],
    ['Auto 10', () => auto(10)],
    ['Auto off', () => auto(null)],
    ['Read schedules', readSchedules],
    ['Save test schedule', saveSchedule],
    ['Remove schedules', removeSchedules],
    ['Blink', blink],
    ['Disconnect', disconnect],
    [`${REPEATS}x connect + status`, passBar],
  ];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>BLE spike (dev only)</Text>
      <View style={styles.row}>
        {found.map((d) => (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            accessibilityLabel={`Select ${d.name ?? d.id}`}
            accessibilityState={{ selected: selected === d.id }}
            style={[styles.btn, selected === d.id && styles.selected]}
            onPress={() => setSelected(d.id)}
          >
            <Text>{`${selected === d.id ? '* ' : ''}${d.name ?? 'device'} ${d.id}`}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {actions.map(([label, fn]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            style={[styles.btn, busy && styles.dim]}
            onPress={() => void run(label, fn)}
          >
            <Text>{label}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear log"
          style={styles.btn}
          onPress={() => setLines([])}
        >
          <Text>Clear log</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.log}>
        {lines.map((l, i) => (
          <Text key={i} selectable style={styles.mono}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, paddingTop: 48, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  selected: { borderWidth: 3 },
  dim: { opacity: 0.4 },
  log: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8 },
  mono: { fontSize: 11 },
});
