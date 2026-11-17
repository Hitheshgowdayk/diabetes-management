import { useState, type FormEvent } from 'react';
import { Activity, ShieldAlert, HeartPulse, ArrowRight, Lock, Mail, User as UserIcon } from 'lucide-react';
import { apiRequest, setAuthToken } from '../lib/api';
import type { User } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [diabetesType, setDiabetesType] = useState('Type 2');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email, password }
          : { full_name: fullName, email, password, diabetes_type: diabetesType };

      const data = await apiRequest<{ user: User; token?: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.token) {
        setAuthToken(data.token);
      }
      onAuthenticated(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="lg:col-span-5 bg-[#0F2942] text-white p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0D9488] flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Diabetes Management System</span>
            </div>

            <h1 className="mt-8 text-2xl sm:text-3xl font-bold leading-tight text-balance">
              Personal glucose tracking and clinical care organization.
            </h1>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Monitor fasting and post-meal glucose readings against your personal targets, generate clinical PDF logs,
              track medications and appointments, and locate nearby hospitals.
            </p>
          </div>

          <div className="mt-10 space-y-4 border-t border-white/15 pt-6 text-sm">
            <div className="flex items-start gap-3">
              <HeartPulse className="h-4 w-4 text-[#2DD4BF] mt-0.5 shrink-0" />
              <p className="text-slate-200">
                Private per-user records secured in SQLite with configurable fasting and post-meal criteria.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-4 w-4 text-[#FBBF24] mt-0.5 shrink-0" />
              <p className="text-slate-200">
                Emergency safety guidance with rapid access to India emergency number 112.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 p-8 sm:p-10">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register' ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <h2 className="mt-6 text-xl font-bold text-[#0F172A]">
            {mode === 'login' ? 'Sign in to your care portal' : 'Create your personal care account'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login'
              ? 'Enter your credentials to access your private glucose logs and reminders.'
              : 'All health records remain private to your account.'}
          </p>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-fullname" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    minLength={2}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Ananya Sharma"
                    className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label htmlFor="auth-diabetes-type" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Diabetes Category (Optional)
                </label>
                <select
                  id="auth-diabetes-type"
                  value={diabetesType}
                  onChange={(e) => setDiabetesType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
                >
                  <option value="Type 2">Type 2 Diabetes</option>
                  <option value="Type 1">Type 1 Diabetes</option>
                  <option value="Gestational">Gestational Diabetes</option>
                  <option value="Prediabetes">Prediabetes / Monitoring</option>
                  <option value="Not specified">Prefer not to specify</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173B5E] disabled:opacity-60 transition-colors"
            >
              <span>{submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-500 leading-relaxed">
            Informational Tool Notice: This application supports personal tracking and health education. It does not
            provide medical diagnoses, prescribe medications, or replace professional clinical care.
          </p>
        </div>
      </div>
    </div>
  );
}
