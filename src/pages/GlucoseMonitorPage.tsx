import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Info, PlusCircle, SlidersHorizontal } from 'lucide-react';
import { apiRequest, formatReadingType, formatTimestamp, getStatusStyles } from '../lib/api';
import type { GlucoseEvaluation, GlucoseReading, GlucoseTargets, NavPage } from '../types';

interface GlucoseMonitorPageProps {
  targets: GlucoseTargets;
  onReadingSaved: () => void;
  onNavigate: (page: NavPage) => void;
}

export function GlucoseMonitorPage({ targets, onReadingSaved, onNavigate }: GlucoseMonitorPageProps) {
  const [readingValue, setReadingValue] = useState('');
  const [readingType, setReadingType] = useState<'fasting' | 'post_meal'>('fasting');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reading: GlucoseReading; evaluation: GlucoseEvaluation } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = readingValue.trim();
    if (!trimmed) {
      setError('Please enter a glucose value in mg/dL.');
      return;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric) || numeric < 20 || numeric > 600) {
      setError('Please enter a valid numerical glucose value between 20 and 600 mg/dL.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiRequest<{ reading: GlucoseReading; evaluation: GlucoseEvaluation }>('/api/glucose', {
        method: 'POST',
        body: JSON.stringify({
          reading_value: numeric,
          reading_type: readingType,
          notes: notes.trim(),
        }),
      });
      setResult(data);
      setReadingValue('');
      setNotes('');
      onReadingSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save glucose reading.');
    } finally {
      setSubmitting(false);
    }
  }

  const resultStyles = result ? getStatusStyles(result.reading.evaluation_status) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Glucose Monitoring</h1>
          <p className="mt-1 text-sm text-slate-600">
            Record fasting or post-meal blood glucose readings in mg/dL for immediate reference evaluation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto whitespace-nowrap"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Configure Personal Targets</span>
        </button>
      </div>

      {/* Separate Fasting vs Post-Meal Configurable Criteria Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F2942]">Fasting Evaluation Criteria</h2>
            <span className="text-xs font-mono-tabular font-semibold text-[#0F2942]">
              {targets.fasting_min}–{targets.fasting_max} mg/dL
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Applied to readings taken after at least 8 hours without caloric intake. Values below{' '}
            <span className="font-mono-tabular font-semibold">{targets.low_threshold} mg/dL</span> trigger a low-glucose alert.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0D9488]">Post-Meal Evaluation Criteria</h2>
            <span className="text-xs font-mono-tabular font-semibold text-[#0D9488]">
              {targets.low_threshold}–{targets.post_meal_max} mg/dL
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Applied separately to readings taken 1–2 hours after starting a meal. Evaluated independently from fasting targets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0F172A]">Log New Glucose Reading</h2>
          <p className="mt-1 text-xs text-slate-500">Date and time are captured automatically upon submission.</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Reading Category</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setReadingType('fasting')}
                  className={`py-2.5 px-4 text-sm font-semibold rounded-md transition-colors ${
                    readingType === 'fasting'
                      ? 'bg-[#0F2942] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fasting
                </button>
                <button
                  type="button"
                  onClick={() => setReadingType('post_meal')}
                  className={`py-2.5 px-4 text-sm font-semibold rounded-md transition-colors ${
                    readingType === 'post_meal'
                      ? 'bg-[#0D9488] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Post-Meal
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="glucose-value" className="block text-sm font-medium text-slate-700 mb-1.5">
                Blood Glucose Level (mg/dL)
              </label>
              <div className="relative">
                <input
                  id="glucose-value"
                  type="number"
                  step="0.1"
                  min={20}
                  max={600}
                  required
                  value={readingValue}
                  onChange={(e) => setReadingValue(e.target.value)}
                  placeholder="Enter value between 20 and 600"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-16 text-base font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                  mg/dL
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="glucose-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
                Context Notes (Optional)
              </label>
              <textarea
                id="glucose-notes"
                rows={3}
                maxLength={250}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Before breakfast, 2 hours after lunch, post-walk..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173B5E] disabled:opacity-60 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{submitting ? 'Evaluating & Saving...' : 'Evaluate & Save Reading'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-6 space-y-4">
          {result && resultStyles ? (
            <div className={`rounded-xl border p-6 ${resultStyles.borderClass} ${resultStyles.bgClass}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-600">
                    Recorded {formatTimestamp(result.reading.recorded_at)} · {formatReadingType(result.reading.reading_type)}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-bold font-mono-tabular text-[#0F172A]">
                      {result.reading.reading_value}
                    </span>
                    <span className="text-sm font-medium text-slate-600">mg/dL</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  {result.reading.evaluation_status === 'normal' ? (
                    <CheckCircle2 className={`h-5 w-5 ${resultStyles.textClass}`} />
                  ) : (
                    <AlertTriangle className={`h-5 w-5 ${resultStyles.textClass}`} />
                  )}
                  <span className={resultStyles.textClass}>{result.evaluation.label}</span>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-800 leading-relaxed">{result.evaluation.message}</p>
              <p className="mt-2 text-xs font-mono-tabular text-slate-600">{result.evaluation.targetDescription}</p>

              {result.evaluation.warning && (
                <div className="mt-4 rounded-lg border border-amber-300 bg-white/90 p-3.5 text-xs text-slate-800 leading-relaxed">
                  <strong className="text-amber-800">Attention: </strong>
                  {result.evaluation.warning}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="text-xs font-semibold text-[#0F2942] hover:underline"
                >
                  View in Reading History
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('emergency')}
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
                  Emergency Safety Guidance
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-bold text-[#0F172A]">Immediate Evaluation Readout</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Once you submit a reading, the system evaluates it against your configured{' '}
                <strong>{readingType === 'fasting' ? 'Fasting' : 'Post-Meal'}</strong> criteria, stores it in SQLite,
                and displays any relevant warning guidance right here.
              </p>
            </div>
          )}

          {/* Mandatory Clinical Disclaimer */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3">
            <Info className="h-5 w-5 text-[#0F2942] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
              <p className="font-semibold text-slate-900">Important Reference Target &amp; Non-Diagnostic Notice</p>
              <p>
                Blood glucose target ranges vary significantly between individuals depending on age, diabetes type,
                pregnancy status, medications, and other health conditions.
              </p>
              <p>
                The evaluations shown here compare your numbers only against the configurable reference ranges in your
                profile. They are <strong>not medical diagnoses</strong> and should not be used to alter prescribed
                medications without consulting a licensed clinician.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
