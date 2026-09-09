import { listEntries, saveEntry, saveSettings, type AppSettings, type WorkEntry } from '../storage/db';

interface BackupFile {
  schema: string;
  version: number;
  settings: AppSettings;
  entries: WorkEntry[];
}

function isEntry(value: unknown): value is WorkEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<WorkEntry>;
  return typeof entry.id === 'string' && typeof entry.date === 'string' && typeof entry.startTime === 'string' && typeof entry.endTime === 'string' && Number.isInteger(entry.expectedMinutes) && typeof entry.note === 'string' && typeof entry.createdAt === 'string' && typeof entry.updatedAt === 'string';
}

export async function importJson(file: File): Promise<number> {
  const parsed: unknown = JSON.parse(await file.text());
  if (!parsed || typeof parsed !== 'object') throw new Error('Backup must contain a JSON object.');
  const backup = parsed as Partial<BackupFile>;
  if (backup.schema !== 'o-vuoro-worktime' || backup.version !== 1 || !Array.isArray(backup.entries) || !backup.entries.every(isEntry)) {
    throw new Error('Unsupported or invalid backup file.');
  }
  if (!backup.settings || !Number.isInteger(backup.settings.standardExpectedMinutes)) {
    throw new Error('Backup settings are invalid.');
  }

  const existing = await listEntries();
  const existingIds = new Set(existing.map((entry) => entry.id));
  const newEntries = backup.entries.filter((entry) => !existingIds.has(entry.id));
  await Promise.all(newEntries.map((entry) => saveEntry(entry)));
  await saveSettings(backup.settings);
  return newEntries.length;
}