import { useEffect, useState, type FormEvent } from 'react';
import { Download, Edit3, Search, Trash2, X } from 'lucide-react';
import {
  apiRequest,
  formatReadingType,
  formatTimestamp,
  generateGlucosePdfReport,
  getStatusStyles,
} from '../lib/api';
import type { GlucoseReading, GlucoseTargets, User } from '../types';

interface HistoryPageProps {
  user: User;
  targets: GlucoseTargets;
  onDataChanged: () => void;
}

export function HistoryPage({ user, targets, onDataChanged }: HistoryPageProps) {
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'fasting' | 'post_meal'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<GlucoseReading | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editType, setEditType] = useState<'fasting' | 'post_meal'>('fasting');
  const [editRecordedAt, setEditRecordedAt] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function fetchReadings() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const data = await apiRequest<{ readings: GlucoseReading[] }>(`/api/glucose?${params.toString()}`);
      setReadings(data.readings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reading history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReadings();
  }, [typeFilter, fromDate, toDate]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    fetchReadings();
  }

  function openEditModal(reading: GlucoseReading) {
    setEditing(reading);
    setEditValue(String(reading.reading_value));
    setEditType(reading.reading_type);
    setEditRecordedAt(reading.recorded_at.replace(' ', 'T').slice(0, 16));
    setEditNotes(reading.notes || '');
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const numeric = Number(editValue);
    if (!Number.isFinite(numeric) || numeric < 20 || numeric > 600) {
      setError('Reading value must be between 20 and 600 mg/dL.');
      return;
    }

    setSavingEdit(true);
    try {
      await apiRequest(`/api/glucose/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          reading_value: numeric,
          reading_type: editType,
          recorded_at: editRecordedAt,
          notes: editNotes.trim(),
        }),
      });
      setEditing(null);
      await fetchReadings();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update reading.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteOne(id: number) {
    setError(null);
    try {
      await apiRequest(`/api/glucose/${id}`, { method: 'DELETE' });
      await fetchReadings();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete reading.');
    }
  }

  async function handleClearAll() {
    setClearing(true);
    setError(null);
    try {
      await apiRequest('/api/glucose', { method: 'DELETE' });
      setConfirmClearOpen(false);
      await fetchReadings();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear reading history.');
    } finally {
      setClearing(false);
    }
  }

  function handleDownloadPdf() {
    const scopeParts: string[] = [];
    scopeParts.push(typeFilter === 'all' ? 'All Categories' : formatReadingType(typeFilter));
    if (fromDate || toDate) {
      scopeParts.push(`${fromDate || 'Beginning'} to ${toDate || 'Present'}`);
    } else {
      scopeParts.push('All Dates');
    }
    if (search.trim()) {
      scopeParts.push(`Search: "${search.trim()}"`);
    }
    generateGlucosePdfReport(user, readings, targets, scopeParts.join(' · '));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Reading History &amp; Reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search, filter by date or meal category, edit or remove entries, and export clinical PDF reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={readings.length === 0}
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white hover:bg-[#173B5E] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download PDF Report</span>
          </button>
          <button
            type="button"
            disabled={readings.length === 0}
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <form onSubmit={handleSearchSubmit} className="md:col-span-5">
            <label htmlFor="history-search" className="block text-xs font-medium text-slate-600 mb-1.5">
              Search Readings or Notes
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="history-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Value, evaluation, or note..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] transition-colors whitespace-nowrap"
              >
                Search
              </button>
            </div>
          </form>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'fasting', 'post_meal'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    typeFilter === t ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'fasting' ? 'Fasting' : 'Post-Meal'}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="history-from" className="block text-xs font-medium text-slate-600 mb-1.5">
              From Date
            </label>
            <input
              id="history-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="history-to" className="block text-xs font-medium text-slate-600 mb-1.5">
              To Date
            </label>
            <input
              id="history-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#0D9488] focus:outline-none"
            />
          </div>
        </div>

        {(search || typeFilter !== 'all' || fromDate || toDate) && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Showing {readings.length} matching records</span>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
                setFromDate('');
                setToDate('');
              }}
              className="font-semibold text-[#0D9488] hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* Readings Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading reading history...</div>
        ) : readings.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No glucose readings match your current filters.</p>
            <p className="mt-1 text-xs text-slate-500">
              Record a reading in Glucose Monitoring or clear active date/search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Reading</th>
                  <th className="py-3 px-4">Evaluation</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {readings.map((item) => {
                  const st = getStatusStyles(item.evaluation_status);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-xs text-slate-600 font-mono-tabular whitespace-nowrap">
                        {formatTimestamp(item.recorded_at)}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                        {formatReadingType(item.reading_type)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                        {item.reading_value} mg/dL
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold whitespace-nowrap">
                        <span className={st.textClass}>{item.evaluation_label}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {item.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                            aria-label={`Edit reading ${item.reading_value}`}
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(item.id)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                            aria-label={`Delete reading ${item.reading_value}`}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-[#0F172A]">Edit Glucose Reading</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Category</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setEditType('fasting')}
                    className={`py-2 text-xs font-semibold rounded-md ${
                      editType === 'fasting' ? 'bg-[#0F2942] text-white' : 'text-slate-600'
                    }`}
                  >
                    Fasting
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('post_meal')}
                    className={`py-2 text-xs font-semibold rounded-md ${
                      editType === 'post_meal' ? 'bg-[#0D9488] text-white' : 'text-slate-600'
                    }`}
                  >
                    Post-Meal
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="edit-glucose-val" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Reading (mg/dL)
                </label>
                <input
                  id="edit-glucose-val"
                  type="number"
                  step="0.1"
                  min={20}
                  max={600}
                  required
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-recorded-at" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Date &amp; Time
                </label>
                <input
                  id="edit-recorded-at"
                  type="datetime-local"
                  required
                  value={editRecordedAt}
                  onChange={(e) => setEditRecordedAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Notes
                </label>
                <textarea
                  id="edit-notes"
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white hover:bg-[#173B5E] disabled:opacity-60"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-lg">
            <h2 className="text-base font-bold text-[#0F172A]">Clear All Reading History?</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              This will permanently remove all stored glucose readings from your SQLite database. You can download a PDF
              report first if you wish to keep a copy.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={handleClearAll}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {clearing ? 'Clearing...' : 'Confirm Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
