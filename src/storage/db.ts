import { DEFAULT_EXPECTED_MINUTES } from '../domain/time';

const DATABASE_NAME = 'o-vuoro';
const DATABASE_VERSION = 1;
const ENTRIES_STORE = 'entries';
const SETTINGS_STORE = 'settings';

export interface WorkEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  expectedMinutes: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  standardExpectedMinutes: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const entries = database.createObjectStore(ENTRIES_STORE, { keyPath: 'id' });
      entries.createIndex('date', 'date', { unique: false });
      database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open local storage.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
  });
}

export async function listEntries(): Promise<WorkEntry[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ENTRIES_STORE, 'readonly');
    const entries = await requestResult(transaction.objectStore(ENTRIES_STORE).getAll());
    return entries.sort((left, right) => right.date.localeCompare(left.date));
  } finally {
    database.close();
  }
}

export async function getEntryForDate(date: string): Promise<WorkEntry | undefined> {
  const entries = await listEntries();
  return entries.find((entry) => entry.date === date);
}

export async function getEntriesForDate(date: string): Promise<WorkEntry[]> {
  const entries = await listEntries();
  return entries.filter((entry) => entry.date === date).sort((left, right) => left.startTime.localeCompare(right.startTime));
}

export async function saveEntry(entry: WorkEntry): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ENTRIES_STORE, 'readwrite');
    transaction.objectStore(ENTRIES_STORE).put(entry);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save entry.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving entry was aborted.'));
    });
  } finally {
    database.close();
  }
}

export async function getSettings(): Promise<AppSettings> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SETTINGS_STORE, 'readonly');
    const stored = await requestResult(transaction.objectStore(SETTINGS_STORE).get('app')) as (AppSettings & { key: string }) | undefined;
    return stored ? { standardExpectedMinutes: stored.standardExpectedMinutes } : { standardExpectedMinutes: DEFAULT_EXPECTED_MINUTES };
  } finally {
    database.close();
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SETTINGS_STORE, 'readwrite');
    transaction.objectStore(SETTINGS_STORE).put({ key: 'app', ...settings });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save settings.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving settings was aborted.'));
    });
  } finally {
    database.close();
  }
}

export async function clearEntries(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ENTRIES_STORE, 'readwrite');
    transaction.objectStore(ENTRIES_STORE).clear();
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to clear entries.'));
    });
  } finally {
    database.close();
  }
}

export async function deleteEntry(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ENTRIES_STORE, 'readwrite');
    transaction.objectStore(ENTRIES_STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to delete entry.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Deleting entry was aborted.'));
    });
  } finally {
    database.close();
  }
}