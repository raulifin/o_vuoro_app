import { describe, expect, it } from 'vitest';
import {
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