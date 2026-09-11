import { describe, expect, it } from 'vitest';
import {
  calculateExpectedMinutesForDay,
  calculatePlannedEnd,
  calculateTotalWorkedMinutes,
  calculateWorkedMinutes,
  formatDuration,
  formatTime,
  parseTime,
} from './time';

describe('work-time calculations', () => {
  it('calculates a normal day', () => {
    expect(calculateWorkedMinutes('07:30', '15:15')).toBe(465);
    expect(formatDuration(0, true)).toBe('+0:00');
  });

  it('calculates positive and negative balances', () => {
    expect(formatDuration(15, true)).toBe('+0:15');
    expect(formatDuration(-15, true)).toBe('-0:15');
  });

  it('handles cross-midnight work', () => {
    expect(calculateWorkedMinutes('22:00', '06:00')).toBe(480);
  });

  it('calculates the planned end', () => {
    expect(calculatePlannedEnd('07:26', 465)).toBe('15:11');
    expect(formatTime(465)).toBe('07:45');
  });

  it('adds multiple work periods before applying the daily target', () => {
    expect(calculateTotalWorkedMinutes([
      { startTime: '08:00', endTime: '12:00' },
      { startTime: '13:00', endTime: '16:45' },
    ])).toBe(465);
  });

  it('rejects malformed times', () => {
    expect(() => parseTime('7:30')).toThrow();
    expect(() => parseTime('25:00')).toThrow();
  });
});

describe('daily expected minutes and balance (regression for -19:05 import bug)', () => {
  it('a normal single-entry day balances to zero', () => {
    const worked = calculateWorkedMinutes('07:30', '15:15');
    const expected = calculateExpectedMinutesForDay([{ expectedMinutes: 465 }], 465);
    expect(worked).toBe(465);
    expect(worked - expected).toBe(0);
  });

  it('a split day only subtracts the expected duration once, regardless of entry order', () => {
    const inOrder = [{ expectedMinutes: 465 }, { expectedMinutes: 0 }];
    const reversed = [{ expectedMinutes: 0 }, { expectedMinutes: 465 }];
    expect(calculateExpectedMinutesForDay(inOrder, 465)).toBe(465);
    expect(calculateExpectedMinutesForDay(reversed, 465)).toBe(465);

    const worked = calculateTotalWorkedMinutes([
      { startTime: '07:47', endTime: '15:15' },
      { startTime: '16:01', endTime: '16:20' },
    ]);
    expect(worked).toBe(467);
    expect(worked - calculateExpectedMinutesForDay(reversed, 465)).toBe(2);
  });

  it('a whole day with expectedMinutes 0 is never replaced by the standard duration', () => {
    const expected = calculateExpectedMinutesForDay([{ expectedMinutes: 0 }], 465);
    expect(expected).toBe(0);
    expect(expected).not.toBe(465);
    const worked = calculateWorkedMinutes('13:00', '13:52');
    expect(worked - expected).toBe(52);
  });

  it('falls back to the standard duration only when there are no entries for the day', () => {
    expect(calculateExpectedMinutesForDay([], 465)).toBe(465);
  });
});