import add from './en/add';
import common from './en/common';
import dispenser from './en/dispenser';
import errors from './en/errors';
import home from './en/home';
import schedule from './en/schedule';
import settings from './en/settings';

const namespaces: Record<string, Record<string, string>> = {
  common,
  home,
  add,
  dispenser,
  schedule,
  settings,
  errors,
};

/** Dev: throws on a missing key. Prod: returns the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dot = key.indexOf('.');
  const ns = dot > 0 ? key.slice(0, dot) : '';
  const name = key.slice(dot + 1);
  const template = namespaces[ns]?.[name];
  if (template === undefined) {
    if (__DEV__) throw new Error(`Missing translation key: ${key}`);
    return key;
  }
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, v: string) =>
    vars[v] !== undefined ? String(vars[v]) : whole,
  );
}
