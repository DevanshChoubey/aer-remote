// Dev-only hardware spike (Task 7). Throwaway: themed with the shared primitives, no copy catalogue.
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';

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
import { ThemeProvider } from '@/theme';
import { Box, Button, Column, Row, Screen, Txt } from '@/ui';

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
const GAP_MS = 1000;
const HOME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

type Log = (line: string) => void;

// Module-level on purpose: this throwaway screen has exactly one live link.
const live: {
  session: DispenserSession | null;
  raw: BleTransport | null;
  transport: BleTransport | null;
  lastConnectError: string;
} = { session: null, raw: null, transport: null, lastConnectError: '' };

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
    scan: (onFound, ms, opts) => inner.scan(onFound, ms, opts),
    connect: async (id, ms) => {
      const t0 = Date.now();
      try {
        const conn = await inner.connect(id, ms);
        log(`connect ok in ${Date.now() - t0} ms`);
        return logged(conn, log);
      } catch (e) {
        live.lastConnectError = e instanceof Error ? e.message : String(e);
        log(`connect failed after ${Date.now() - t0} ms: ${live.lastConnectError}`);
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

function SpikeScreen(): React.JSX.Element {
  const [lines, setLines] = useState<string[]>([]);
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // A remount rebuilds the logging wrapper so it logs to the new screen state.
    live.transport = null;
    return () => {
      void live.session?.close();
      live.session = null;
      live.transport = null;
    };
  }, []);

  const log = useCallback<Log>((line) => {
    setLines((prev) => [...prev.slice(-300), `${new Date().toISOString().slice(11, 23)} ${line}`]);
  }, []);

  const getTransport = useCallback((): BleTransport => {
    live.raw ??= createRnTransport();
    live.transport ??= loggingTransport(live.raw, log);
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

  const scanWith = async (unfiltered: boolean): Promise<void> => {
    const t = getTransport();
    await t.requestPermissions();
    if ((await t.adapterState()) !== 'on') throw new Error('bluetooth not ready');
    setFound([]);
    const handle = t.scan(
      (d) => {
        setFound((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d]));
        log(`found ${d.id} ${d.name ?? '-'} rssi ${d.rssi ?? '?'}`);
      },
      SCAN_MS,
      { unfiltered },
    );
    await handle.done;
    log('scan finished');
  };

  const connect = async (): Promise<void> => {
    if (!selected) throw new Error('pick a device first');
    await live.session?.close();
    live.session = null;
    await getTransport().requestPermissions();
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
    await getTransport().requestPermissions();
    const times: number[] = [];
    let pass = 0;
    for (let i = 1; i <= REPEATS; i++) {
      live.lastConnectError = '';
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
        log(`run ${i}: ${ms <= PASS_BAR_MS ? 'ok' : 'SLOW'} ${ms} ms`);
      } catch (e) {
        log(
          `run ${i}: FAIL after ${Date.now() - t0} ms (${live.lastConnectError || String(e)}; ${String(e)})`,
        );
      }
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
    log(
      `PASS BAR: ${pass}/${REPEATS} within ${PASS_BAR_MS} ms (gap ${GAP_MS} ms between runs); times ${times.join(', ')} ms`,
    );
  };

  const actions: [string, () => Promise<void>][] = [
    ['Scan', () => scanWith(false)],
    ['Scan (no filter)', () => scanWith(true)],
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

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen title="BLE spike (dev only)" scroll>
      <Row gap={2} wrap>
        {found.map((d) => (
          <Button
            key={d.id}
            variant={selected === d.id ? 'primary' : 'secondary'}
            label={`${selected === d.id ? '* ' : ''}${d.name ?? 'device'} ${d.id}`}
            onPress={() => setSelected(d.id)}
          />
        ))}
      </Row>
      <Row gap={2} wrap>
        {actions.map(([label, fn]) => (
          <Button
            key={label}
            variant="secondary"
            label={label}
            disabled={busy}
            onPress={() => void run(label, fn)}
          />
        ))}
        <Button variant="ghost" label="Clear log" onPress={() => setLines([])} />
      </Row>
      <Box bg="surface" border="border" radius="sm" p={2}>
        <Column>
          {lines.map((l, i) => (
            <Txt key={i} variant="caption" selectable>
              {l}
            </Txt>
          ))}
        </Column>
      </Box>
    </Screen>
  );
}

export default function Spike(): React.JSX.Element {
  return (
    <ThemeProvider>
      <SpikeScreen />
    </ThemeProvider>
  );
}
