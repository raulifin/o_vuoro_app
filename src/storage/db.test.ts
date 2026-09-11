import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEntries, getEntriesForDate, saveEntry, type WorkEntry } from './db';

function makeEntry(overrides: Partial<WorkEntry>): WorkEntry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    date: '2026-09-02',
    startTime: '07:47',
    endTime: '15:15',
    expectedMinutes: 465,
    note: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('IndexedDB persistence of expectedMinutes', () => {
  beforeEach(async () => {
    await clearEntries();
  });

  it('reads back expectedMinutes: 0 unchanged after a save/reload cycle', async () => {
    const entry = makeEntry({ startTime: '16:01', endTime: '16:20', expectedMinutes: 0, note: 'etätyö' });
    await saveEntry(entry);

    const loaded = await getEntriesForDate(entry.date);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].expectedMinutes).toBe(0);
    expect(loaded[0].expectedMinutes).not.toBe(465);
  });

  it('preserves entry order independence: split-day entries can be read back in either storage order', async () => {
    const first = makeEntry({ id: 'b26a56c8-68ac-486e-b2ab-4b6787be49bb', startTime: '07:47', endTime: '15:15', expectedMinutes: 465 });
    const second = makeEntry({ id: '398be608-c0e3-40f7-8e68-d047059d1863', startTime: '16:01', endTime: '16:20', expectedMinutes: 0 });
    await saveEntry(second);
    await saveEntry(first);

    const loaded = await getEntriesForDate(first.date);
    expect(loaded.map((entry) => entry.expectedMinutes).sort()).toEqual([0, 465]);
  });
});
