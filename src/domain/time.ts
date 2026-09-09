export const DEFAULT_EXPECTED_MINUTES = 7 * 60 + 45;

export function parseTime(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error('Time must use HH:mm format.');
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error('Time is outside the valid range.');
  }

  return hours * 60 + minutes;
}

export function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const remainder = (normalized % 60).toString().padStart(2, '0');
  return `${hours}:${remainder}`;
}

export function calculateWorkedMinutes(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return end >= start ? end - start : end + 1440 - start;
}

export function calculatePlannedEnd(startTime: string, expectedMinutes: number): string {
  return formatTime(parseTime(startTime) + expectedMinutes);
}

export function formatDuration(minutes: number, signed = false): string {
  const sign = minutes < 0 ? '-' : signed ? '+' : '';
  const absolute = Math.abs(minutes);
  return `${sign}${Math.floor(absolute / 60)}:${(absolute % 60).toString().padStart(2, '0')}`;
}

export function calculateTotalWorkedMinutes(periods: readonly { startTime: string; endTime: string }[]): number {
  return periods.reduce((total, period) => total + calculateWorkedMinutes(period.startTime, period.endTime), 0);
}