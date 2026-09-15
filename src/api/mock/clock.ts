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
export function daysAgo(days: number, hour = 9): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}
