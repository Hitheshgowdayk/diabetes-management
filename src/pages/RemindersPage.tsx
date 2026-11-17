import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Edit3, Info, Pill, PlusCircle, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { MedicineReminder } from '../types';

interface RemindersPageProps {
  onDataChanged: () => void;
}

export function RemindersPage({ onDataChanged }: RemindersPageProps) {
  const [reminders, setReminders] = useState<MedicineReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Once Daily');
  const [reminderDate, setReminderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reminderTime, setReminderTime] = useState('08:00');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<MedicineReminder | null>(null);

  async function loadReminders() {
    setLoading(true);
    try {
      const data = await apiRequest<{ reminders: MedicineReminder[] }>('/api/reminders');
      setReminders(data.reminders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load medicine reminders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReminders();
  }, []);

  async function enableBrowserNotifications() {
    if (typeof Notification === 'undefined') {
      setNotifStatus('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!medicineName.trim() || !dosage.trim() || !reminderDate || !reminderTime) {
      setError('Medicine name, prescribed dosage, date, and time are required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await apiRequest(`/api/reminders/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            medicine_name: medicineName.trim(),
            dosage: dosage.trim(),
            frequency,
            reminder_date: reminderDate,
            reminder_time: reminderTime,
            instructions: instructions.trim(),
            is_active: editing.is_active === 1,
          }),
        });
        setEditing(null);
      } else {
        await apiRequest('/api/reminders', {
          method: 'POST',
          body: JSON.stringify({
            medicine_name: medicineName.trim(),
            dosage: dosage.trim(),
            frequency,
            reminder_date: reminderDate,
            reminder_time: reminderTime,
            instructions: instructions.trim(),
          }),
        });
      }

      setMedicineName('');
      setDosage('');
      setFrequency('Once Daily');
      setInstructions('');
      await loadReminders();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save reminder.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(r: MedicineReminder) {
    setEditing(r);
    setMedicineName(r.medicine_name);
    setDosage(r.dosage);
    setFrequency(r.frequency);
    setReminderDate(r.reminder_date);
    setReminderTime(r.reminder_time);
    setInstructions(r.instructions || '');
  }

  function cancelEdit() {
    setEditing(null);
    setMedicineName('');
    setDosage('');
    setFrequency('Once Daily');
    setInstructions('');
  }

  async function toggleActive(r: MedicineReminder) {
    try {
      await apiRequest(`/api/reminders/${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          medicine_name: r.medicine_name,
          dosage: r.dosage,
          frequency: r.frequency,
          reminder_date: r.reminder_date,
          reminder_time: r.reminder_time,
          instructions: r.instructions,
          is_active: r.is_active !== 1,
        }),
      });
      await loadReminders();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update reminder status.');
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiRequest(`/api/reminders/${id}`, { method: 'DELETE' });
      if (editing?.id === id) cancelEdit();
      await loadReminders();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete reminder.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Medicine Reminders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track reminders based strictly on the prescriptions provided by your healthcare provider.
          </p>
        </div>

        {notifStatus !== 'unsupported' && (
          <button
            type="button"
            onClick={enableBrowserNotifications}
            disabled={notifStatus === 'granted'}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70 transition-colors self-start sm:self-auto whitespace-nowrap"
          >
            <Bell className="h-3.5 w-3.5 text-[#0D9488]" />
            <span>
              {notifStatus === 'granted'
                ? 'Browser Alerts Enabled'
                : notifStatus === 'denied'
                ? 'Notifications Blocked in Browser'
                : 'Enable Reminder Notifications'}
            </span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#0F2942] shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Prescription Adherence Notice: Enter only medications and doses prescribed by your doctor. This system never
          recommends medicines, suggests substitutes, or modifies prescribed dosages.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#0F172A]">
              {editing ? 'Edit Medicine Reminder' : 'Add Medicine Reminder'}
            </h2>
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="med-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                Prescribed Medicine Name
              </label>
              <input
                id="med-name"
                type="text"
                required
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                placeholder="Enter medicine as on prescription"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="med-dosage" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Prescribed Dose
                </label>
                <input
                  id="med-dosage"
                  type="text"
                  required
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g., 1 tablet / 500 mg"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="med-frequency" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Schedule
                </label>
                <select
                  id="med-frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                >
                  <option value="Once Daily">Once Daily</option>
                  <option value="Twice Daily">Twice Daily</option>
                  <option value="Before Meals">Before Meals</option>
                  <option value="After Meals">After Meals</option>
                  <option value="Bedtime">Bedtime</option>
                  <option value="As Prescribed">As Prescribed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="med-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Reminder Date
                </label>
                <input
                  id="med-date"
                  type="date"
                  required
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="med-time" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Reminder Time
                </label>
                <input
                  id="med-time"
                  type="time"
                  required
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="med-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
                Clinician Instructions (Optional)
              </label>
              <textarea
                id="med-notes"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., Take with evening meal"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173B5E] disabled:opacity-60 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{submitting ? 'Saving...' : editing ? 'Update Reminder' : 'Save Reminder'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0F172A] mb-4">Your Scheduled Reminders</h2>

          {loading ? (
            <p className="text-sm text-slate-500">Loading reminders...</p>
          ) : reminders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
              <Pill className="h-7 w-7 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm font-medium text-slate-700">No medicine reminders added yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Use the form to record your prescribed medication schedule.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    r.is_active === 1 ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{r.medicine_name}</h3>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-[#0D9488]">{r.dosage}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 font-mono-tabular">
                        {r.reminder_date} at {r.reminder_time} · {r.frequency}
                      </p>
                      {r.instructions && <p className="mt-1.5 text-xs text-slate-500">{r.instructions}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleActive(r)}
                        className={`rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          r.is_active === 1
                            ? 'border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {r.is_active === 1 ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                        aria-label={`Edit ${r.medicine_name}`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        aria-label={`Delete ${r.medicine_name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
