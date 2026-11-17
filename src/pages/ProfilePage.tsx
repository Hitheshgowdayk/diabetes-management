import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { User, UserProfile } from '../types';

interface ProfilePageProps {
  user: User;
  profile: UserProfile | null;
  onProfileUpdated: (user: User, profile: UserProfile) => void;
}

export function ProfilePage({ user, profile, onProfileUpdated }: ProfilePageProps) {
  const [fullName, setFullName] = useState(user.full_name);
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [diabetesType, setDiabetesType] = useState(profile?.diabetes_type || 'Not specified');
  const [lowThreshold, setLowThreshold] = useState(String(profile?.low_threshold ?? 70));
  const [fastingMin, setFastingMin] = useState(String(profile?.fasting_min ?? 70));
  const [fastingMax, setFastingMax] = useState(String(profile?.fasting_max ?? 99));
  const [postMealMax, setPostMealMax] = useState(String(profile?.post_meal_max ?? 140));
  const [emergencyContactName, setEmergencyContactName] = useState(profile?.emergency_contact_name || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(profile?.emergency_contact_phone || '');
  const [doctorName, setDoctorName] = useState(profile?.doctor_name || '');
  const [doctorPhone, setDoctorPhone] = useState(profile?.doctor_phone || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setFullName(user.full_name);
    if (profile) {
      setAge(profile.age ? String(profile.age) : '');
      setGender(profile.gender || '');
      setDiabetesType(profile.diabetes_type || 'Not specified');
      setLowThreshold(String(profile.low_threshold));
      setFastingMin(String(profile.fasting_min));
      setFastingMax(String(profile.fasting_max));
      setPostMealMax(String(profile.post_meal_max));
      setEmergencyContactName(profile.emergency_contact_name || '');
      setEmergencyContactPhone(profile.emergency_contact_phone || '');
      setDoctorName(profile.doctor_name || '');
      setDoctorPhone(profile.doctor_phone || '');
    }
  }, [user, profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);
    setSaving(true);

    try {
      const data = await apiRequest<{ user: User; profile: UserProfile }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName.trim(),
          age: age.trim() === '' ? null : Number(age),
          gender: gender.trim(),
          diabetes_type: diabetesType,
          low_threshold: Number(lowThreshold),
          fasting_min: Number(fastingMin),
          fasting_max: Number(fastingMax),
          post_meal_max: Number(postMealMax),
          emergency_contact_name: emergencyContactName.trim(),
          emergency_contact_phone: emergencyContactPhone.trim(),
          doctor_name: doctorName.trim(),
          doctor_phone: doctorPhone.trim(),
        }),
      });
      onProfileUpdated(data.user, data.profile);
      setSavedNotice(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">My Profile &amp; Target Configuration</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your personal healthcare profile, emergency contact, and clinician-aligned glucose target ranges.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {savedNotice && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#0D9488]" />
          <span>Profile and configurable glucose targets saved to SQLite.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#0F172A] pb-3 border-b border-slate-100">
            Personal &amp; Care Details
          </h2>

          <div>
            <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              id="prof-name"
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Account Email</label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="prof-age" className="block text-xs font-medium text-slate-700 mb-1.5">
                Age (Years)
              </label>
              <input
                id="prof-age"
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="prof-gender" className="block text-xs font-medium text-slate-700 mb-1.5">
                Gender
              </label>
              <select
                id="prof-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              >
                <option value="">Prefer not to specify</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="prof-type" className="block text-xs font-medium text-slate-700 mb-1.5">
              Diabetes Category
            </label>
            <select
              id="prof-type"
              value={diabetesType}
              onChange={(e) => setDiabetesType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
            >
              <option value="Type 2">Type 2 Diabetes</option>
              <option value="Type 1">Type 1 Diabetes</option>
              <option value="Gestational">Gestational Diabetes</option>
              <option value="Prediabetes">Prediabetes / Monitoring</option>
              <option value="Not specified">Not specified</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label htmlFor="prof-doc" className="block text-xs font-medium text-slate-700 mb-1.5">
                Primary Physician Name
              </label>
              <input
                id="prof-doc"
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="Dr. ..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="prof-doc-phone" className="block text-xs font-medium text-slate-700 mb-1.5">
                Physician Phone
              </label>
              <input
                id="prof-doc-phone"
                type="tel"
                value={doctorPhone}
                onChange={(e) => setDoctorPhone(e.target.value)}
                placeholder="+91 ..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="prof-ec-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                Emergency Contact Name
              </label>
              <input
                id="prof-ec-name"
                type="text"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Family / Caregiver"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="prof-ec-phone" className="block text-xs font-medium text-slate-700 mb-1.5">
                Emergency Contact Phone
              </label>
              <input
                id="prof-ec-phone"
                type="tel"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="+91 ..."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-[#0F172A] pb-3 border-b border-slate-100">
              Configurable Glucose Reference Targets (mg/dL)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Fasting and post-meal readings are evaluated against separate thresholds. Adjust these bounds to match the
              personalized targets recommended by your physician.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="target-fmin" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Fasting Lower Limit (mg/dL)
                </label>
                <input
                  id="target-fmin"
                  type="number"
                  required
                  min={50}
                  max={150}
                  value={fastingMin}
                  onChange={(e) => setFastingMin(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="target-fmax" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Fasting Upper Limit (mg/dL)
                </label>
                <input
                  id="target-fmax"
                  type="number"
                  required
                  min={70}
                  max={250}
                  value={fastingMax}
                  onChange={(e) => setFastingMax(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="target-pmax" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Post-Meal Upper Limit (mg/dL)
                </label>
                <input
                  id="target-pmax"
                  type="number"
                  required
                  min={100}
                  max={350}
                  value={postMealMax}
                  onChange={(e) => setPostMealMax(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="target-low" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Low Glucose Alert Threshold (mg/dL)
                </label>
                <input
                  id="target-low"
                  type="number"
                  required
                  min={40}
                  max={100}
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
              Standard adult reference baselines (for general awareness only): Fasting 70–99 mg/dL (ADA general non-diabetic
              reference) or 80–130 mg/dL (common pre-meal diabetes target); Post-meal &le; 140 mg/dL or &lt; 180 mg/dL. Always
              confirm your individual targets with your clinician.
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173B5E] disabled:opacity-60 transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving Profile...' : 'Save Profile & Targets'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
