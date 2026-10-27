// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pushesToMain } = require('../../scripts/check-push-target.js');

const SHA = 'a'.repeat(40);

describe('pre-push main guard', () => {
  it('blocks a push to main', () => {
    expect(pushesToMain(`refs/heads/main ${SHA} refs/heads/main ${SHA}\n`)).toBe(true);
  });

  it('blocks pushing any local branch onto main', () => {
    expect(pushesToMain(`refs/heads/lane/x ${SHA} refs/heads/main ${SHA}\n`)).toBe(true);
  });

  it('allows a push to a branch, and an empty push', () => {
    expect(pushesToMain(`refs/heads/main ${SHA} refs/heads/lane/x ${SHA}\n`)).toBe(false);
    expect(pushesToMain('')).toBe(false);
  });
});
