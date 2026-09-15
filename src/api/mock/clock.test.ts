import { afterEach, describe, expect, it, vi } from 'vitest';
import { daysAgo, daysSince } from './clock';

/**
 * A fixture's day has to be its day at every hour of the clock.
 *
 * `conversations.test.ts` asserted it with a millisecond difference divided
 * by a day, and that suite was red between midnight and 09:30 with every
 * fixture correct: the first scripted conversation is `daysAgo(0, 9)`, and
 * before 09:30 the difference is negative and rounds to `-0`. Nobody would
 * have seen it in office hours. These run the clock instead of waiting for
 * it.
 */
describe('daysAgo og daysSince', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Local midnight, a quarter past nine, and a minute to midnight — the three
  // places the two readings of «a day» come apart. 2026-09-16 is a Wednesday
  // well clear of a daylight saving change, so nothing here rides on one.
  const hours = [
    ['midnatt', '2026-09-16T00:05:00'],
    ['rett før fixturens klokkeslett', '2026-09-16T09:15:00'],
    ['midt på dagen', '2026-09-16T12:00:00'],
    ['rett før midnatt', '2026-09-16T23:59:00'],
  ] as const;

  for (const [when, now] of hours) {
    it(`gir samme dag ${when}`, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));

      for (const days of [0, 1, 3, 6, 29, 400]) {
        // `Object.is`, not `toBe` alone: `-0` is the failure this exists to
        // catch, and it is equal to 0 under `==` and under `===`.
        expect(Object.is(daysSince(daysAgo(days)), days), `${days} dager siden`).toBe(true);
      }
    });
  }

  it('teller kalenderdøgn, ikke 24 timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T00:30:00'));

    // 23 hours ago, but yesterday: the grouping says «I går», not «I dag».
    expect(daysSince('2026-09-15T01:30:00')).toBe(1);
    // 30 minutes ago, and today.
    expect(daysSince('2026-09-16T00:00:00')).toBe(0);
  });

  it('gir 0 for et tidspunkt senere i dag', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T00:05:00'));

    // What `daysAgo(0, 9)` actually produces at this hour. A future timestamp
    // on today's date is today; see the note in clock.ts on why it is not
    // clamped, and `bucketFor` in grouping.ts for the view agreeing.
    expect(Object.is(daysSince('2026-09-16T09:30:00'), 0)).toBe(true);
  });
});
