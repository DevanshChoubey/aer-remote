import { MAX_SCHEDULES } from '@/core';
import { t } from '@/i18n';

import type { DraftProblem } from './useScheduleDraft';

/** The user-facing message for each way a schedule can be invalid. */
export function problemCopy(problem: DraftProblem): string {
  switch (problem) {
    case 'endNotAfterStart':
      return t('schedule.problemEndBeforeStart');
    case 'noDays':
      return t('schedule.problemNoDays');
    case 'noSprays':
      return t('schedule.problemNoSprays');
    case 'tooManySprays':
      return t('schedule.problemTooManySprays');
    case 'tooMany':
      return t('schedule.problemTooMany', { max: MAX_SCHEDULES });
  }
}
