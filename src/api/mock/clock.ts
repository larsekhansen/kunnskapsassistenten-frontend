/**
 * When a fixture happened, counted back from now.
 *
 * Relative and not written-out dates, so the thread list keeps exercising its
 * own grouping — «I dag», «Siste 7 dager», «Siste 30 dager», a month by name,
 * a year — however long after they were written somebody opens the app. Fixed
 * dates would all have drifted into «2025» by themselves.
 *
 * Its own file because two modules need it and neither may import the other:
 * the NKOM fixture in fixtures.ts, and the scripted conversations in
 * conversations/threads.ts, which fixtures.ts reads.
 */

const MS_PER_DAY = 86_400_000;

/** Midnight local time, so a day here is the calendar day, not 24 hours. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * A CALENDAR day back, not 24 hours back: `setDate` shifts the date and the
 * clock is then set outright, so `daysAgo(0)` is today whether the app is
 * opened at 08:00 or at 23:00. That is what the grouping asks — see
 * `bucketFor` in src/views/threads/grouping.ts — and a fixture that answered
 * «24 hours» would slide between «I dag» and «Siste 7 dager» over the course
 * of a day.
 *
 * `hour` is what keeps two fixtures on the same day apart. Between midnight
 * and that hour the timestamp is a few hours into the future, which is
 * deliberate: the alternative is to clamp it to now, and then every fixture
 * on the same day collapses onto the same instant and the list loses its
 * order. The grouping treats a future date as today on purpose.
 */
export function daysAgo(days: number, hour = 9): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}

/**
 * The inverse: how many calendar days ago a timestamp from `daysAgo` was.
 *
 * Here so that a caller asking «which day is this fixture on» asks it the way
 * `daysAgo` answered, rather than dividing a millisecond difference by a day.
 * That division is wrong twice over for `daysAgo(0)`: before `hour` it gives
 * a negative number — `-0`, which `toBe(0)` rejects — and after `hour + 12`
 * it rounds up to 1. Measured red at 00:05 on 2026-09-16.
 *
 * The same sum as `daysBetween` in grouping.ts and threadTime.ts, and
 * deliberately not shared with them: those are the view's, this is the mock
 * API's, and neither layer may import the other.
 */
export function daysSince(timestamp: string, now: Date = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(timestamp))) / MS_PER_DAY);
}
