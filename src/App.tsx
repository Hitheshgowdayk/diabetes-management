import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Apple,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  LogOut,
  MapPin,
  Menu,
  Pill,
  ShieldAlert,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { apiRequest, clearAuthToken, onAuthExpired } from './lib/api';
import { AnalysisPage } from './pages/AnalysisPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmergencyPage } from './pages/EmergencyPage';
import { GlucoseMonitorPage } from './pages/GlucoseMonitorPage';
import { HistoryPage } from './pages/HistoryPage';
import { HospitalsPage } from './pages/HospitalsPage';
import { NutritionPage } from './pages/NutritionPage';
import { ProfilePage } from './pages/ProfilePage';
import { RemindersPage } from './pages/RemindersPage';
import type { GlucoseReading, GlucoseSummary, GlucoseTargets, NavPage, User, UserProfile } from './types';

const NAV_ITEMS: Array<{ id: NavPage; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'glucose', label: 'Glucose Monitoring', icon: Activity },
  { id: 'history', label: 'Reading History', icon: ClipboardList },
  { id: 'analysis', label: 'Glucose Analysis', icon: LineChart },
  { id: 'emergency', label: 'Emergency Support', icon: ShieldAlert },
  { id: 'hospitals', label: 'Hospital Finder', icon: MapPin },
  { id: 'nutrition', label: 'Food and Nutrition', icon: Apple },
  { id: 'reminders', label: 'Medicine Reminders', icon: Pill },
  { id: 'appointments', label: 'Appointments', icon: CalendarClock },
  { id: 'profile', label: 'My Profile', icon: UserIcon },
];

const DEFAULT_TARGETS: GlucoseTargets = {
  low_threshold: 70,
  fasting_min: 70,
  fasting_max: 99,
  post_meal_max: 140,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [summary, setSummary] = useState<GlucoseSummary | null>(null);
  const [allReadings, setAllReadings] = useState<GlucoseReading[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const loadUserWorkspace = useCallback(async () => {
    setDataLoading(true);
    try {
      const [profileRes, summaryRes, readingsRes] = await Promise.all([
        apiRequest<{ user: User; profile: UserProfile }>('/api/profile'),
        apiRequest<GlucoseSummary>('/api/glucose/summary'),
        apiRequest<{ readings: GlucoseReading[] }>('/api/glucose'),
      ]);
      setUser(profileRes.user);
      setProfile(profileRes.profile);
      setSummary(summaryRes);
      setAllReadings(readingsRes.readings);
    } catch {
      // Handled gracefully if session expired
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      setUser(null);
      setProfile(null);
      setSummary(null);
      setAllReadings([]);
      setActivePage('dashboard');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ user: User }>('/api/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadUserWorkspace();
    }
  }, [user?.id, loadUserWorkspace]);

  async function handleLogout() {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearAuthToken();
    setUser(null);
    setProfile(null);
    setSummary(null);
    setAllReadings([]);
    setActivePage('dashboard');
    setMobileNavOpen(false);
  }

  function handleNavigate(page: NavPage) {
    setActivePage(page);
    setMobileNavOpen(false);
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center">
        <p className="text-sm font-medium text-slate-600">Loading Diabetes Management System...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={(loggedUser) => {
          setUser(loggedUser);
          setActivePage('dashboard');
        }}
      />
    );
  }

  const targets: GlucoseTargets = profile
    ? {
        low_threshold: profile.low_threshold,
        fasting_min: profile.fasting_min,
        fasting_max: profile.fasting_max,
        post_meal_max: profile.post_meal_max,
      }
    : DEFAULT_TARGETS;

  const currentNavLabel = NAV_ITEMS.find((item) => item.id === activePage)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col lg:flex-row">
      {/* Mobile Header Bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#0F2942] text-white px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-md bg-[#0D9488] flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold truncate">Diabetes Management System</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="rounded-md p-2 text-slate-200 hover:bg-white/10"
          aria-label="Toggle navigation menu"
        >
          {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation (All 11 Items) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0F2942] text-slate-100 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#0D9488] flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-bold tracking-tight text-white leading-snug">
                Diabetes Management
              </span>
              <span className="block text-xs text-slate-300">Care Platform</span>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Primary sidebar navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors text-left whitespace-nowrap ${
                    isActive
                      ? 'bg-[#0D9488] text-white'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-red-500/15 hover:text-red-200 transition-colors whitespace-nowrap"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Bar */}
        <div className="hidden lg:flex items-center justify-between gap-8 bg-white border-b border-slate-200 px-8 py-4">
          <div className="text-sm text-slate-500 whitespace-nowrap shrink-0">
            <span>Diabetes Management System</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className="font-semibold text-[#0F172A]">{currentNavLabel}</span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-slate-500 whitespace-nowrap">
              Signed in as <strong className="text-slate-800">{user.full_name}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleNavigate('emergency')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Emergency 112</span>
            </button>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardPage
              user={user}
              profile={profile}
              summary={summary}
              allReadings={allReadings}
              loading={dataLoading}
              onNavigate={handleNavigate}
            />
          )}
          {activePage === 'glucose' && (
            <GlucoseMonitorPage
              targets={targets}
              onReadingSaved={loadUserWorkspace}
              onNavigate={handleNavigate}
            />
          )}
          {activePage === 'history' && (
            <HistoryPage user={user} targets={targets} onDataChanged={loadUserWorkspace} />
          )}
          {activePage === 'analysis' && <AnalysisPage readings={allReadings} targets={targets} />}
          {activePage === 'emergency' && <EmergencyPage profile={profile} onNavigate={handleNavigate} />}
          {activePage === 'hospitals' && <HospitalsPage />}
          {activePage === 'nutrition' && <NutritionPage />}
          {activePage === 'reminders' && <RemindersPage onDataChanged={loadUserWorkspace} />}
          {activePage === 'appointments' && <AppointmentsPage onDataChanged={loadUserWorkspace} />}
          {activePage === 'profile' && (
            <ProfilePage
              user={user}
              profile={profile}
              onProfileUpdated={(updatedUser, updatedProfile) => {
                setUser(updatedUser);
                setProfile(updatedProfile);
                loadUserWorkspace();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
