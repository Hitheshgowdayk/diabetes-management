import { useMemo, useState } from 'react';
import { GlucoseChart } from '../components/GlucoseChart';
import { formatTimestamp } from '../lib/api';
import type { GlucoseReading, GlucoseTargets } from '../types';

interface AnalysisPageProps {
  readings: GlucoseReading[];
  targets: GlucoseTargets;
}

type TrendWindow = 'daily' | 'weekly' | 'monthly';

function parseDate(ts: string): Date {
  return new Date(ts.replace(' ', 'T'));
}

function summarize(values: number[]) {
  if (values.length === 0) {
    return { count: 0, avg: null, min: null, max: null };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    avg: Number((sum / values.length).toFixed(1)),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function AnalysisPage({ readings, targets }: AnalysisPageProps) {
  const [windowMode, setWindowMode] = useState<TrendWindow>('weekly');

  const chronological = useMemo(() => {
    return [...readings].sort((a, b) => parseDate(a.recorded_at).getTime() - parseDate(b.recorded_at).getTime());
  }, [readings]);

  const dailyChart = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent24 = chronological.filter((r) => parseDate(r.recorded_at).getTime() >= cutoff);
    const series = recent24.length > 0 ? recent24 : chronological.slice(-10);
    return {
      labels: series.map((r) => formatTimestamp(r.recorded_at)),
      fasting: series.map((r) => (r.reading_type === 'fasting' ? r.reading_value : null)),
      postMeal: series.map((r) => (r.reading_type === 'post_meal' ? r.reading_value : null)),
    };
  }, [chronological]);

  const weeklyChart = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const fastingAvg = days.map((day) => {
      const vals = chronological
        .filter((r) => r.recorded_at.startsWith(day) && r.reading_type === 'fasting')
        .map((r) => r.reading_value);
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    });

    const postAvg = days.map((day) => {
      const vals = chronological
        .filter((r) => r.recorded_at.startsWith(day) && r.reading_type === 'post_meal')
        .map((r) => r.reading_value);
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    });

    const hasAny = fastingAvg.some((v) => v !== null) || postAvg.some((v) => v !== null);
    return {
      labels: hasAny ? days : [],
      fasting: fastingAvg,
      postMeal: postAvg,
    };
  }, [chronological]);

  const monthlyChart = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const fastingAvg = days.map((day) => {
      const vals = chronological
        .filter((r) => r.recorded_at.startsWith(day) && r.reading_type === 'fasting')
        .map((r) => r.reading_value);
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    });

    const postAvg = days.map((day) => {
      const vals = chronological
        .filter((r) => r.recorded_at.startsWith(day) && r.reading_type === 'post_meal')
        .map((r) => r.reading_value);
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    });

    const hasAny = fastingAvg.some((v) => v !== null) || postAvg.some((v) => v !== null);
    return {
      labels: hasAny ? days.map((d) => d.slice(5)) : [],
      fasting: fastingAvg,
      postMeal: postAvg,
    };
  }, [chronological]);

  const activeSeries =
    windowMode === 'daily' ? dailyChart : windowMode === 'weekly' ? weeklyChart : monthlyChart;

  const fastingSummary = useMemo(
    () => summarize(chronological.filter((r) => r.reading_type === 'fasting').map((r) => r.reading_value)),
    [chronological]
  );
  const postMealSummary = useMemo(
    () => summarize(chronological.filter((r) => r.reading_type === 'post_meal').map((r) => r.reading_value)),
    [chronological]
  );

  const comparisonLabels =
    fastingSummary.count > 0 || postMealSummary.count > 0 ? ['Minimum', 'Average', 'Maximum'] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Glucose Trend Analysis</h1>
          <p className="mt-1 text-sm text-slate-600">
            Interactive Chart.js visualizations of your recorded daily, weekly, monthly, and fasting vs. post-meal logs.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
          {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setWindowMode(mode)}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                windowMode === mode ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode === 'daily' ? 'Daily View' : mode === 'weekly' ? '7-Day Trend' : '30-Day Trend'}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Time-Window Trend Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-base font-bold text-[#0F172A]">
            {windowMode === 'daily'
              ? 'Daily Glucose Readings'
              : windowMode === 'weekly'
              ? 'Weekly Daily Averages (Last 7 Days)'
              : 'Monthly Daily Averages (Last 30 Days)'}
          </h2>
          <p className="text-xs text-slate-500">
            Configured reference limits — Fasting: {targets.fasting_min}–{targets.fasting_max} mg/dL · Post-Meal: &le;{' '}
            {targets.post_meal_max} mg/dL
          </p>
        </div>

        <GlucoseChart
          type="line"
          labels={activeSeries.labels}
          datasets={[
            {
              label: 'Fasting (mg/dL)',
              data: activeSeries.fasting,
              borderColor: '#0F2942',
              backgroundColor: '#0F2942',
              spanGaps: true,
              tension: 0.25,
              pointRadius: 4,
            },
            {
              label: 'Post-Meal (mg/dL)',
              data: activeSeries.postMeal,
              borderColor: '#0D9488',
              backgroundColor: '#0D9488',
              spanGaps: true,
              tension: 0.25,
              pointRadius: 4,
            },
          ]}
          height={310}
        />
      </div>

      {/* Fasting vs Post-Meal Comparison + Historical Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0F172A]">Fasting vs. Post-Meal Comparison</h2>
          <p className="mt-1 text-xs text-slate-500 mb-4">
            Factual minimum, average, and maximum values across all stored readings.
          </p>

          <GlucoseChart
            type="bar"
            labels={comparisonLabels}
            datasets={[
              {
                label: 'Fasting (mg/dL)',
                data: [fastingSummary.min, fastingSummary.avg, fastingSummary.max],
                backgroundColor: '#0F2942',
                borderRadius: 6,
              },
              {
                label: 'Post-Meal (mg/dL)',
                data: [postMealSummary.min, postMealSummary.avg, postMealSummary.max],
                backgroundColor: '#0D9488',
                borderRadius: 6,
              },
            ]}
            height={260}
          />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Historical Reading Analysis</h2>
            <p className="mt-1 text-xs text-slate-500">
              Descriptive summary derived solely from your recorded entries.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2 pr-3">Metric</th>
                    <th className="py-2 px-3 text-right">Fasting</th>
                    <th className="py-2 pl-3 text-right">Post-Meal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  <tr>
                    <td className="py-3 pr-3 font-medium text-slate-700">Total Logged</td>
                    <td className="py-3 px-3 text-right font-mono-tabular font-semibold">{fastingSummary.count}</td>
                    <td className="py-3 pl-3 text-right font-mono-tabular font-semibold">{postMealSummary.count}</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-3 font-medium text-slate-700">Average (mg/dL)</td>
                    <td className="py-3 px-3 text-right font-mono-tabular font-semibold">
                      {fastingSummary.avg ?? '—'}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono-tabular font-semibold">
                      {postMealSummary.avg ?? '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-3 font-medium text-slate-700">Lowest Recorded</td>
                    <td className="py-3 px-3 text-right font-mono-tabular font-semibold">
                      {fastingSummary.min ?? '—'}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono-tabular font-semibold">
                      {postMealSummary.min ?? '—'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-3 font-medium text-slate-700">Highest Recorded</td>
                    <td className="py-3 px-3 text-right font-mono-tabular font-semibold">
                      {fastingSummary.max ?? '—'}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono-tabular font-semibold">
                      {postMealSummary.max ?? '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-5 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
            Factual Summary Note: Charts reflect historical measurements only and do not project future trends or
            produce clinical conclusions. Share your exported PDF report with your clinician for interpretation.
          </p>
        </div>
      </div>
    </div>
  );
}
