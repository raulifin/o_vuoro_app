import { listEntries, getSettings } from '../storage/db';
import { calculateWorkedMinutes, calculateTotalWorkedMinutes, formatDuration } from '../domain/time';

function download(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function todayFilename(extension: string): string {
  return `worktime-backup-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export async function exportJson(): Promise<void> {
  const [entries, settings] = await Promise.all([listEntries(), getSettings()]);
  download(JSON.stringify({ schema: 'o-vuoro-worktime', version: 1, exportedAt: new Date().toISOString(), settings, entries }, null, 2), todayFilename('json'), 'application/json');
}

function csvValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function exportCsv(): Promise<void> {
  const [entries, settings] = await Promise.all([listEntries(), getSettings()]);
  const grouped = new Map<string, typeof entries>();
  entries.forEach((entry) => grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry]));
  const rows = [...grouped.entries()].flatMap(([date, dayEntries]) => {
    const workedForDay = calculateTotalWorkedMinutes(dayEntries.filter((entry) => entry.startTime && entry.endTime));
    return dayEntries.map((entry, index) => {
      const worked = entry.startTime && entry.endTime ? calculateWorkedMinutes(entry.startTime, entry.endTime) : undefined;
      const expected = index === 0 ? formatDuration(settings.standardExpectedMinutes) : '';
      const balance = index === 0 && dayEntries.some((dayEntry) => dayEntry.startTime && dayEntry.endTime) ? formatDuration(workedForDay - settings.standardExpectedMinutes, true) : '';
      return [date, entry.startTime, entry.endTime, worked === undefined ? '' : formatDuration(worked), expected, balance, entry.note].map(csvValue).join(',');
    });
  });
  download(['date,start_time,end_time,worked,expected,balance,note', ...rows].join('\n'), todayFilename('csv'), 'text/csv');
}