import { useMemo } from 'react';
import {
  Activity,
  CalendarClock,
  ClipboardList,
  LineChart,
  MapPin,
  PhoneCall,
  Pill,
  PlusCircle,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { GlucoseChart } from '../components/GlucoseChart';
import { formatReadingType, formatTimestamp, getStatusStyles } from '../lib/api';
import type { GlucoseReading, GlucoseSummary, NavPage, User, UserProfile } from '../types';

interface DashboardPageProps {
  user: User;
  profile: UserProfile | null;
  summary: GlucoseSummary | null;
  allReadings: GlucoseReading[];
  loading: boolean;
  onNavigate: (page: NavPage) => void;
}

export function DashboardPage({
  user,
  profile,
  summary,
  allReadings,
  loading,
  onNavigate,
}: DashboardPageProps) {
  const chartData = useMemo(() => {
    const recent = [...allReadings].slice(0, 14).reverse();
    return {
      labels: recent.map((r) => formatTimestamp(r.recorded_at)),
      datasets: [
        {
          label: 'Fasting (mg/dL)',
          data: recent.map((r) => (r.reading_type === 'fasting' ? r.reading_value : null)),
          borderColor: '#0F2942',
          backgroundColor: '#0F2942',
          spanGaps: true,
          tension: 0.25,
          pointRadius: 4,
        },
        {
          label: 'Post-Meal (mg/dL)',
          data: recent.map((r) => (r.reading_type === 'post_meal' ? r.reading_value : null)),
          borderColor: '#0D9488',
          backgroundColor: '#0D9488',
          spanGaps: true,
          tension: 0.25,
          pointRadius: 4,
        },
      ],
    };
  }, [allReadings]);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-32 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const latest = summary?.latestReading ?? null;
  const latestStyles = latest ? getStatusStyles(latest.evaluation_status) : null;

  return (
    <div className="space-y-6">
      {/* Welcome & Emergency Shortcut Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div>
          <p className="text-xs font-medium text-[#0D9488]">Personal Health Overview</p>
          <h1 className="mt-1 text-2xl font-bold text-[#0F172A] text-balance">
            Welcome back, {user.full_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span>{profile?.diabetes_type || 'Diabetes Profile'}</span>
            <span aria-hidden="true">·</span>
            <span>
              Fasting Target: <strong className="font-mono-tabular text-slate-900">{summary?.targets.fasting_min ?? 70}–{summary?.targets.fasting_max ?? 99} mg/dL</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Post-Meal Limit: <strong className="font-mono-tabular text-slate-900">&le; {summary?.targets.post_meal_max ?? 140} mg/dL</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('glucose')}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] transition-colors whitespace-nowrap"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Log Glucose Reading</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('emergency')}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Emergency Support (112)</span>
          </button>
        </div>
      </div>

      {/* 4 Core Database-Backed KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Recorded Readings</span>
            <ClipboardList className="h-4 w-4 text-[#0F2942]" />
          </div>
          <p className="mt-3 text-3xl font-bold text-[#0F172A] font-mono-tabular">
            {summary?.totalReadings ?? 0}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Stored securely in your personal SQLite log
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Latest Glucose Reading</span>
            <Activity className="h-4 w-4 text-[#0D9488]" />
          </div>
          {latest ? (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#0F172A] font-mono-tabular">
                  {latest.reading_value}
                </span>
                <span className="text-sm text-slate-500">mg/dL</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs">
                <span className={`font-semibold ${latestStyles?.textClass}`}>
                  {latest.evaluation_label}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{formatReadingType(latest.reading_type)}</span>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-xl font-semibold text-slate-400">No readings yet</p>
              <button
                type="button"
                onClick={() => onNavigate('glucose')}
                className="mt-2 text-xs font-semibold text-[#0D9488] hover:underline"
              >
                Record your first reading
              </button>
            </>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Fasting Reading Summary</span>
            <span className="text-xs font-medium text-[#0F2942]">
              {summary?.fastingSummary.count ?? 0} entries
            </span>
          </div>
          {summary && summary.fastingSummary.count > 0 ? (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#0F172A] font-mono-tabular">
                  {summary.fastingSummary.avg_value}
                </span>
                <span className="text-sm text-slate-500">mg/dL avg</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 font-mono-tabular">
                Min {summary.fastingSummary.min_value} · Max {summary.fastingSummary.max_value} mg/dL
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-xl font-semibold text-slate-400">—</p>
              <p className="mt-2 text-xs text-slate-500">No fasting readings recorded yet</p>
            </>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Post-Meal Reading Summary</span>
            <span className="text-xs font-medium text-[#0D9488]">
              {summary?.postMealSummary.count ?? 0} entries
            </span>
          </div>
          {summary && summary.postMealSummary.count > 0 ? (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#0F172A] font-mono-tabular">
                  {summary.postMealSummary.avg_value}
                </span>
                <span className="text-sm text-slate-500">mg/dL avg</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 font-mono-tabular">
                Min {summary.postMealSummary.min_value} · Max {summary.postMealSummary.max_value} mg/dL
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-xl font-semibold text-slate-400">—</p>
              <p className="mt-2 text-xs text-slate-500">No post-meal readings recorded yet</p>
            </>
          )}
        </div>
      </div>

      {/* Main Content Split: Chart + Profile & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Recent Glucose Trend</h2>
              <p className="text-xs text-slate-500">
                Latest {Math.min(allReadings.length, 14)} recorded fasting and post-meal readings
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analysis')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D9488] hover:underline self-start sm:self-auto"
            >
              <LineChart className="h-3.5 w-3.5" />
              <span>Open Full Analysis</span>
            </button>
          </div>
          <GlucoseChart type="line" labels={chartData.labels} datasets={chartData.datasets} height={270} />
        </div>

        <div className="lg:col-span-4 space-y-6">
          {/* Profile Summary Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">User Profile</h2>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="text-xs font-semibold text-[#0D9488] hover:underline"
              >
                Edit Profile
              </button>
            </div>
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="h-11 w-11 rounded-lg bg-[#0F2942] text-white flex items-center justify-center font-semibold text-sm shrink-0">
                {user.full_name
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Category</dt>
                <dd className="font-medium text-slate-900">{profile?.diabetes_type || 'Not specified'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Primary Physician</dt>
                <dd className="font-medium text-slate-900">{profile?.doctor_name || 'Not added'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Emergency Contact</dt>
                <dd className="font-medium text-slate-900">
                  {profile?.emergency_contact_name
                    ? `${profile.emergency_contact_name}${profile.emergency_contact_phone ? ` (${profile.emergency_contact_phone})` : ''}`
                    : 'Not added'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Active Reminders</dt>
                <dd className="font-mono-tabular font-semibold text-slate-900">
                  {summary?.activeRemindersCount ?? 0}
                </dd>
              </div>
            </dl>
          </div>

          {/* Quick Module Shortcuts */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-[#0F172A] mb-3">Quick Access</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('glucose')}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 p-3 text-left hover:border-[#0D9488] hover:bg-slate-50 transition-colors"
              >
                <PlusCircle className="h-4 w-4 text-[#0D9488]" />
                <span className="text-xs font-semibold text-slate-900">Monitor Glucose</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('hospitals')}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 p-3 text-left hover:border-[#0D9488] hover:bg-slate-50 transition-colors"
              >
                <MapPin className="h-4 w-4 text-[#0F2942]" />
                <span className="text-xs font-semibold text-slate-900">Hospital Finder</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('reminders')}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 p-3 text-left hover:border-[#0D9488] hover:bg-slate-50 transition-colors"
              >
                <Pill className="h-4 w-4 text-[#0D9488]" />
                <span className="text-xs font-semibold text-slate-900">Medicines</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('appointments')}
                className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 p-3 text-left hover:border-[#0D9488] hover:bg-slate-50 transition-colors"
              >
                <CalendarClock className="h-4 w-4 text-[#0F2942]" />
                <span className="text-xs font-semibold text-slate-900">Appointments</span>
              </button>
            </div>
            <a
              href="tel:112"
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white hover:bg-[#173B5E] transition-colors"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Call India Emergency Helpline 112</span>
            </a>
          </div>
        </div>
      </div>

      {/* Recent Reading History & Upcoming Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#0F172A]">Recent Reading History</h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold text-[#0D9488] hover:underline"
            >
              View All History
            </button>
          </div>

          {summary && summary.recentReadings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 pr-4">Date &amp; Time</th>
                    <th className="py-2.5 pr-4">Category</th>
                    <th className="py-2.5 pr-4 text-right">Reading</th>
                    <th className="py-2.5 pl-4">Evaluation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {summary.recentReadings.slice(0, 6).map((item) => {
                    const st = getStatusStyles(item.evaluation_status);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 pr-4 text-xs text-slate-600 font-mono-tabular whitespace-nowrap">
                          {formatTimestamp(item.recorded_at)}
                        </td>
                        <td className="py-3 pr-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                          {formatReadingType(item.reading_type)}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                          {item.reading_value} mg/dL
                        </td>
                        <td className="py-3 pl-4 text-xs font-semibold whitespace-nowrap">
                          <span className={st.textClass}>{item.evaluation_label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm font-medium text-slate-700">No glucose readings recorded yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Add your first fasting or post-meal reading to begin building your personal log.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('glucose')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0D9488] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] transition-colors"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Log First Reading</span>
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#0F172A]">Upcoming Appointments</h2>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="text-xs font-semibold text-[#0D9488] hover:underline"
            >
              Manage
            </button>
          </div>
          {summary && summary.upcomingAppointments.length > 0 ? (
            <div className="space-y-3">
              {summary.upcomingAppointments.map((appt) => (
                <div key={appt.id} className="rounded-lg border border-slate-200 p-3.5">
                  <p className="text-sm font-semibold text-slate-900">{appt.doctor_name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{appt.clinic_name}</p>
                  <p className="text-xs font-mono-tabular text-[#0D9488] mt-1.5">
                    {appt.appointment_date} · {appt.appointment_time}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center">
              <UserCheck className="h-6 w-6 text-slate-400 mx-auto" />
              <p className="mt-2 text-xs text-slate-600">No upcoming scheduled appointments.</p>
              <button
                type="button"
                onClick={() => onNavigate('appointments')}
                className="mt-3 text-xs font-semibold text-[#0D9488] hover:underline"
              >
                Schedule an Appointment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
