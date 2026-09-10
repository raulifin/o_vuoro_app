import './styles.css';
import {
  calculateWorkedMinutes,
  calculateTotalWorkedMinutes,
  DEFAULT_EXPECTED_MINUTES,
  formatDuration,
  formatTime,
  parseTime,
} from './domain/time';
import { deleteEntry, getEntriesForDate, getSettings, listEntries, saveEntry, saveSettings, type AppSettings, type WorkEntry } from './storage/db';
import { exportCsv, exportJson } from './backup/export';
import { importJson } from './backup/import';

function getAppRoot(): HTMLDivElement {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) throw new Error('App root is missing.');
  return root;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
}

const appRoot = getAppRoot();

function getTodayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

let todayEntries: WorkEntry[] = [];
let settings: AppSettings = { standardExpectedMinutes: DEFAULT_EXPECTED_MINUTES };
let currentView: 'today' | 'history' | 'settings' = 'today';

function currentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function timeOptions(selected: string, maximum: number, emptyLabel = ''): string {
  const emptyOption = emptyLabel ? `<option value="" ${selected === '' ? 'selected' : ''}>${emptyLabel}</option>` : '';
  const options = Array.from({ length: maximum + 1 }, (_, value) => {
    const formatted = value.toString().padStart(2, '0');
    return `<option value="${formatted}" ${formatted === selected ? 'selected' : ''}>${formatted}</option>`;
  }).join('');
  return emptyOption + options;
}

function timePicker(id: string, value: string, optional = false): string {
  const [hours = '', minutes = ''] = value.split(':');
  return `<div class="time-picker" aria-label="24-hour time"><select id="${id}-hours" aria-label="Hours" ${optional ? '' : 'required'}>${timeOptions(hours, 23, optional ? '--' : '')}</select><span>:</span><select id="${id}-minutes" aria-label="Minutes" ${optional ? '' : 'required'}>${timeOptions(minutes, 59, optional ? '--' : '')}</select></div>`;
}

function readTimePicker(id: string, optional = false): string {
  const hours = document.querySelector<HTMLSelectElement>(`#${id}-hours`)?.value ?? '';
  const minutes = document.querySelector<HTMLSelectElement>(`#${id}-minutes`)?.value ?? '';
  if (optional && !hours && !minutes) return '';
  if (!hours || !minutes) throw new Error('Select both hours and minutes.');
  return `${hours}:${minutes}`;
}

function render(): void {
  if (currentView === 'history') {
    renderHistory();
    return;
  }
  if (currentView === 'settings') {
    renderSettings();
    return;
  }

  const activeEntry = todayEntries.find((entry) => !entry.endTime);
  const completedEntries = todayEntries.filter((entry) => entry.startTime && entry.endTime);
  const active = Boolean(activeEntry);
  const completed = completedEntries.length > 0;
  const worked = calculateTotalWorkedMinutes(completedEntries);
  const expectedMinutes = todayEntries[0]?.expectedMinutes ?? settings.standardExpectedMinutes;
  const balance = worked - expectedMinutes;
  const periods = todayEntries.map((entry) => `<button class="period-row" data-entry-id="${entry.id}"><span><span>${entry.startTime} - ${entry.endTime || 'active'}</span>${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ''}</span><strong>${entry.endTime ? formatDuration(calculateWorkedMinutes(entry.startTime, entry.endTime)) : 'Edit'}</strong></button>`).join('');

  appRoot.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">O-vuoro</p>
          <h1>Work time</h1>
        </div>
        <button class="icon-button" aria-label="Open settings">⋯</button>
      </header>

      <section class="balance-panel" aria-label="Current balance">
        <p class="eyebrow">Current balance</p>
        <strong>Today only</strong>
        <span>All recorded workdays</span>
      </section>

      <section class="today-card">
        <div class="date-row">
          <div>
            <p class="eyebrow">Today</p>
            <h2>${formatToday()}</h2>
          </div>
          <span class="status ${active ? 'status-active' : ''}">${active ? 'In progress' : completed ? 'Complete' : 'Ready'}</span>
        </div>

        <div class="timeline">
          <div><span>Periods</span><strong>${todayEntries.length}</strong></div>
          <div><span>Worked</span><strong>${formatDuration(worked)}</strong></div>
          <div><span>Expected</span><strong>${formatDuration(expectedMinutes)}</strong></div>
        </div>

        ${periods ? `<div class="period-list">${periods}</div>` : ''}

        ${completed ? `<div class="result"><span>Today</span><strong>${formatDuration(balance, true)}</strong><small>Worked ${formatDuration(worked)} · Expected ${formatDuration(expectedMinutes)}</small></div>` : ''}

        <button class="primary-button" id="work-action">${active ? 'End work' : completed ? 'Start another entry' : 'Start work'}</button>
        ${todayEntries.length ? '<p class="field-help period-help">Select a period to edit its times.</p>' : ''}
      </section>

      <nav class="bottom-nav" aria-label="Main navigation">
        <button class="nav-item active"><span>Today</span><small>Daily entry</small></button>
        <button class="nav-item" id="history-nav"><span>History</span><small>Past days</small></button>
        <button class="nav-item" id="settings-nav"><span>Settings</span><small>Preferences</small></button>
      </nav>
    </main>
  `;

  document.querySelector<HTMLButtonElement>('#work-action')?.addEventListener('click', async () => {
    const timestamp = new Date().toISOString();
    if (active) {
      if (!activeEntry) return;
      await saveEntry({ ...activeEntry, endTime: currentTime(), updatedAt: timestamp });
    } else {
      await saveEntry({
        id: crypto.randomUUID(),
        date: getTodayKey(),
        startTime: currentTime(),
        endTime: '',
        expectedMinutes: todayEntries[0]?.expectedMinutes ?? settings.standardExpectedMinutes,
        note: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    todayEntries = await getEntriesForDate(getTodayKey());
    render();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-entry-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const entry = todayEntries.find((candidate) => candidate.id === button.dataset.entryId);
      if (entry) renderEditForm(entry, 'today');
    });
  });
  document.querySelector<HTMLButtonElement>('#history-nav')?.addEventListener('click', () => {
    currentView = 'history';
    render();
  });
  document.querySelector<HTMLButtonElement>('#settings-nav')?.addEventListener('click', () => {
    currentView = 'settings';
    render();
  });
}

function renderEditForm(entry: WorkEntry, returnView: 'today' | 'history'): void {
  appRoot.innerHTML = `<main class="shell"><header class="topbar"><div><p class="eyebrow">O-vuoro</p><h1>Edit entry</h1></div><button class="icon-button" id="cancel-edit" aria-label="Cancel editing">×</button></header><form class="today-card settings-card" id="edit-form"><label for="edit-date">Date</label><input id="edit-date" type="date" value="${entry.date}" required /><label>Start time</label>${timePicker('edit-start', entry.startTime)}<label>End time</label>${timePicker('edit-end', entry.endTime, true)}<label>Expected day duration</label>${timePicker('edit-expected', formatTime(entry.expectedMinutes))}<label for="edit-note">Note</label><textarea id="edit-note" rows="4" maxlength="500" placeholder="Optional note">${escapeHtml(entry.note ?? '')}</textarea><p class="field-help">Leave the end time empty while active. This duration applies to the whole day.</p><p class="save-message error-message" id="edit-error" aria-live="polite"></p><button class="primary-button" type="submit">Save changes</button><button class="danger-button" id="delete-entry" type="button">Delete entry</button></form></main>`;
  document.querySelector<HTMLButtonElement>('#cancel-edit')?.addEventListener('click', () => { currentView = returnView; render(); });
  document.querySelector<HTMLButtonElement>('#delete-entry')?.addEventListener('click', async () => {
    if (!window.confirm(`Delete the entry from ${entry.date}?`)) return;
    await deleteEntry(entry.id);
    todayEntries = await getEntriesForDate(getTodayKey());
    currentView = returnView;
    render();
  });
  document.querySelector<HTMLFormElement>('#edit-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector<HTMLParagraphElement>('#edit-error');
    const dateInput = document.querySelector<HTMLInputElement>('#edit-date');
    const expectedInput = document.querySelector<HTMLSelectElement>('#edit-expected-hours');
    const noteInput = document.querySelector<HTMLTextAreaElement>('#edit-note');
    if (!error || !dateInput || !expectedInput || !noteInput) return;
    try {
      if (!isValidDateKey(dateInput.value)) throw new Error('Enter a valid date.');
      const startTime = readTimePicker('edit-start');
      const endTime = readTimePicker('edit-end', true);
      const expectedTime = readTimePicker('edit-expected');
      parseTime(startTime);
      if (endTime) parseTime(endTime);
      const expectedMinutes = parseTime(expectedTime);
      const updatedAt = new Date().toISOString();
      if (dateInput.value === entry.date) {
        const sameDayEntries = await getEntriesForDate(entry.date);
        await Promise.all(sameDayEntries.filter((dayEntry) => dayEntry.id !== entry.id).map((dayEntry) => saveEntry({ ...dayEntry, expectedMinutes, updatedAt })));
      }
      await saveEntry({ ...entry, date: dateInput.value, startTime, endTime, expectedMinutes, note: noteInput.value.trim(), updatedAt });
      currentView = returnView;
      todayEntries = await getEntriesForDate(getTodayKey());
      render();
    } catch (validationError) {
      error.textContent = validationError instanceof Error ? validationError.message : 'Enter valid times.';
    }
  });
}

async function renderHistory(): Promise<void> {
  const entries = await listEntries();
  const grouped = new Map<string, WorkEntry[]>();
  entries.forEach((entry) => grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry]));
  let cumulative = 0;
  const rows = [...grouped.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([date, dayEntries]) => {
    const completedEntries = dayEntries.filter((entry) => entry.startTime && entry.endTime);
    const worked = calculateTotalWorkedMinutes(completedEntries);
    const expectedMinutes = dayEntries[0]?.expectedMinutes ?? settings.standardExpectedMinutes;
    const balance = completedEntries.length ? worked - expectedMinutes : 0;
    cumulative += balance;
    const periods = dayEntries.map((entry) => `<button class="history-period" data-entry-id="${entry.id}"><span>${entry.startTime || '--:--'} - ${entry.endTime || 'active'}</span>${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ''}</button>`).join('');
    return `<article class="history-day"><div class="history-row"><div><strong>${date}</strong><span>${dayEntries.length} period${dayEntries.length === 1 ? '' : 's'} · Worked ${formatDuration(worked)} · Expected ${formatDuration(expectedMinutes)}</span></div><strong class="history-balance ${balance < 0 ? 'negative' : ''}">${completedEntries.length ? formatDuration(balance, true) : 'Active'}</strong></div><div class="history-periods">${periods}</div></article>`;
  }).join('');

  appRoot.innerHTML = `<main class="shell"><header class="topbar"><div><p class="eyebrow">O-vuoro</p><h1>History</h1></div><button class="icon-button" id="back-today" aria-label="Back to today">×</button></header><section class="balance-panel"><p class="eyebrow">Current balance</p><strong>${formatDuration(cumulative, true)}</strong><span>${grouped.size} recorded day${grouped.size === 1 ? '' : 's'}</span></section><section class="history-list">${rows || '<p class="empty-state">No entries recorded yet.</p>'}</section><nav class="bottom-nav" aria-label="Main navigation"><button class="nav-item" id="today-nav"><span>Today</span><small>Daily entry</small></button><button class="nav-item active"><span>History</span><small>Past days</small></button><button class="nav-item" id="settings-nav"><span>Settings</span><small>Preferences</small></button></nav></main>`;
  document.querySelector<HTMLButtonElement>('#back-today')?.addEventListener('click', () => { currentView = 'today'; render(); });
  document.querySelector<HTMLButtonElement>('#today-nav')?.addEventListener('click', () => { currentView = 'today'; render(); });
  document.querySelector<HTMLButtonElement>('#settings-nav')?.addEventListener('click', () => { currentView = 'settings'; render(); });
  document.querySelectorAll<HTMLButtonElement>('[data-entry-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const entry = entries.find((candidate) => candidate.id === button.dataset.entryId);
      if (entry) renderEditForm(entry, 'history');
    });
  });
}

function renderSettings(): void {
  const hours = Math.floor(settings.standardExpectedMinutes / 60).toString().padStart(2, '0');
  const minutes = (settings.standardExpectedMinutes % 60).toString().padStart(2, '0');
  appRoot.innerHTML = `<main class="shell"><header class="topbar"><div><p class="eyebrow">O-vuoro</p><h1>Settings</h1></div><button class="icon-button" id="back-today" aria-label="Back to today">×</button></header><section class="today-card settings-card"><label>Default day duration</label><p class="field-help">Used for new entries. Individual days can override it when edited.</p>${timePicker('standard-duration', `${hours}:${minutes}`)}<button class="primary-button" id="save-settings">Save settings</button><p class="save-message" id="save-message" aria-live="polite"></p></section><section class="today-card settings-card"><label>Backup</label><p class="field-help">Export or restore entries stored on this device.</p><button class="secondary-button" id="export-json">Export JSON</button><button class="secondary-button" id="export-csv">Export CSV</button><input id="import-json" type="file" accept="application/json,.json" /><p class="save-message" id="backup-message" aria-live="polite"></p></section><nav class="bottom-nav" aria-label="Main navigation"><button class="nav-item" id="today-nav"><span>Today</span><small>Daily entry</small></button><button class="nav-item" id="history-nav"><span>History</span><small>Past days</small></button><button class="nav-item active"><span>Settings</span><small>Preferences</small></button></nav></main>`;
  document.querySelector<HTMLButtonElement>('#back-today')?.addEventListener('click', () => { currentView = 'today'; render(); });
  document.querySelector<HTMLButtonElement>('#today-nav')?.addEventListener('click', () => { currentView = 'today'; render(); });
  document.querySelector<HTMLButtonElement>('#history-nav')?.addEventListener('click', () => { currentView = 'history'; render(); });
  document.querySelector<HTMLButtonElement>('#save-settings')?.addEventListener('click', async () => {
    const message = document.querySelector<HTMLParagraphElement>('#save-message');
    try {
      settings = { standardExpectedMinutes: parseTime(readTimePicker('standard-duration')) };
      await saveSettings(settings);
      if (message) message.textContent = 'Saved';
    } catch (error) {
      if (message) message.textContent = error instanceof Error ? error.message : 'Use HH:mm format.';
    }
  });
  document.querySelector<HTMLButtonElement>('#export-json')?.addEventListener('click', () => { void exportJson(); });
  document.querySelector<HTMLButtonElement>('#export-csv')?.addEventListener('click', () => { void exportCsv(); });
  document.querySelector<HTMLInputElement>('#import-json')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const message = document.querySelector<HTMLParagraphElement>('#backup-message');
    try {
      const count = await importJson(file);
      settings = await getSettings();
      todayEntries = await getEntriesForDate(getTodayKey());
      if (message) message.textContent = `Imported ${count} new entr${count === 1 ? 'y' : 'ies'}.`;
    } catch (error) {
      if (message) message.textContent = error instanceof Error ? error.message : 'Import failed.';
    }
  });
}

async function initialize(): Promise<void> {
  settings = await getSettings();
  todayEntries = await getEntriesForDate(getTodayKey());
  render();
}

initialize().catch(() => {
  appRoot.innerHTML = '<main class="shell"><section class="today-card"><h1>Storage unavailable</h1><p>Local browser storage could not be opened.</p></section></main>';
});