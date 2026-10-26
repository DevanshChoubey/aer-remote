import * as fs from 'fs';
import * as path from 'path';
import { DEVICE_ERROR_CODES } from '@/device/errors';
import { t } from '@/i18n';
import add from '@/i18n/en/add';
import common from '@/i18n/en/common';
import dispenser from '@/i18n/en/dispenser';
import errors from '@/i18n/en/errors';
import home from '@/i18n/en/home';
import schedule from '@/i18n/en/schedule';
import settings from '@/i18n/en/settings';

const NAMESPACES: Record<string, Record<string, string>> = {
  common,
  home,
  add,
  dispenser,
  schedule,
  settings,
  errors,
};

const ROOT = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

describe('i18n', () => {
  it('returns the app name', () => {
    expect(t('common.appName')).toBe('Aer Remote');
  });

  it('interpolates variables', () => {
    expect(t('common.levelShortOk', { name: 'Battery', percent: 42 })).toBe('Battery 42%');
  });

  it('throws on a missing key in dev', () => {
    expect(() => t('common.nope')).toThrow(/Missing translation key/);
    expect(() => t('nonsense.key')).toThrow();
  });

  it('throws on an unreplaced variable in dev', () => {
    expect(() => t('common.levelShortOk', { name: 'Battery' })).toThrow(/percent/);
    expect(t('common.appName')).toBe('Aer Remote');
  });

  it('does not resolve inherited object keys', () => {
    expect(() => t('common.toString')).toThrow(/Missing translation key/);
    expect(() => t('constructor.name')).toThrow();
  });

  it('has no empty strings', () => {
    for (const [ns, entries] of Object.entries(NAMESPACES)) {
      for (const [k, v] of Object.entries(entries)) {
        expect(`${ns}.${k}:${v.trim().length > 0}`).toBe(`${ns}.${k}:true`);
      }
    }
  });

  it('has plain-words copy for every device error code', () => {
    for (const code of DEVICE_ERROR_CODES) expect(t(`errors.${code}`).length).toBeGreaterThan(10);
    expect(DEVICE_ERROR_CODES).toContain('batteryTooLow');
    expect(t('errors.unreachable')).toMatch(/close the Godrej app or any other phone/i);
  });

  it('carries the unofficial notice', () => {
    expect(t('settings.unofficialNotice')).toMatch(/not affiliated with Godrej/i);
  });

  it('defines every key referenced as t(...) in src and app', () => {
    const files = [...walk(path.join(ROOT, 'src')), ...walk(path.join(ROOT, 'app'))];
    const missing: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*'([a-z]+)\.([A-Za-z0-9]+)'/g)) {
        const [, ns, key] = m;
        if (ns === undefined || key === undefined || NAMESPACES[ns]?.[key] === undefined) {
          missing.push(`${path.relative(ROOT, file)}: ${ns}.${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
