import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEntries, listEntries, saveSettings, type AppSettings } from '../storage/db';
import { importJson } from './import';

function jsonFile(content: unknown): File {
  return new File([JSON.stringify(content)], 'backup.json', { type: 'application/json' });
}

describe('import/export round trip for expectedMinutes: 0', () => {
  beforeEach(async () => {
    await clearEntries();
    await saveSettings({ standardExpectedMinutes: 465 } satisfies AppSettings);
  });

  it('keeps expectedMinutes: 0 intact after importing a backup', async () => {
    const backup = {
      schema: 'o-vuoro-worktime',
      version: 1,
      settings: { standardExpectedMinutes: 465 },
      entries: [
        {
          id: 'a1cb13ab-c4ce-4e85-a2ac-a0a0ffd1e351',
          date: '2026-08-20',
          startTime: '13:00',
          endTime: '13:52',
          expectedMinutes: 0,
          note: 'zero-expected day',
          createdAt: '2026-08-20T12:00:00.000Z',
          updatedAt: '2026-08-20T12:00:00.000Z',
        },
      ],
    };

    const imported = await importJson(jsonFile(backup));
    expect(imported).toBe(1);

    const entries = await listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].expectedMinutes).toBe(0);
    expect(entries[0].expectedMinutes).not.toBe(465);
  });
});
