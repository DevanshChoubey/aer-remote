import { toReply } from '@/protocol/replies';
import {
  batteryPercent,
  isBatteryTooLow,
  parseStatus,
  refillPercent,
  REFILL_SPRAYS,
} from '@/protocol/status';

const reply = (body: Record<string, unknown>): NonNullable<ReturnType<typeof toReply>> => {
  const r = toReply({ mT: 157, mN: 9, ack: 200, ...body } as never);
  if (!r) throw new Error('bad reply');
  return r;
};

describe('status', () => {
  it('parses a status reply', () => {
    const r = reply({
      bV: 2506,
      fV: '3.0.6-T1',
      cS: 122,
      sC: { sn: [1, 2, 0, 0], sc: [3, 0, 0], bn: [0, 0, 1] },
    });
    expect(parseStatus(r)).toEqual({
      batteryMv: 2506,
      firmware: '3.0.6-T1',
      autoSpray: 20,
      spraysSinceRefill: 7,
    });
  });

  it('maps auto-spray states', () => {
    const f = (cS: number): unknown => parseStatus(reply({ cS })).autoSpray;
    expect([111, 0, 112, 121, 131, 113, 122, 132, 114, 123, 133, 999].map(f)).toEqual([
      null,
      null,
      10,
      10,
      10,
      20,
      20,
      20,
      40,
      40,
      40,
      null,
    ]);
  });

  it('handles absent fields and map counters', () => {
    expect(parseStatus(reply({}))).toEqual({
      batteryMv: 0,
      firmware: '',
      autoSpray: null,
      spraysSinceRefill: 0,
    });
    expect(
      parseStatus(reply({ sC: { sn: { a: 2, b: [3, 'x'] }, z: 'q' } })).spraysSinceRefill,
    ).toBe(5);
  });

  it('computes battery and refill', () => {
    expect(batteryPercent(3100)).toBe(100);
    expect(batteryPercent(2750)).toBe(50);
    expect(batteryPercent(2300)).toBe(0);
    expect(batteryPercent(3500)).toBe(100);
    expect(isBatteryTooLow(2399)).toBe(true);
    expect(isBatteryTooLow(2400)).toBe(false);
    expect(REFILL_SPRAYS).toBe(2200);
    expect(refillPercent(1100)).toBe(50);
    expect(refillPercent(5000)).toBe(0);
    expect(refillPercent(-5)).toBe(100);
  });
});
