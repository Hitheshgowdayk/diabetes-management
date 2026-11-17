import { AlertOctagon, MapPin, Phone, PhoneCall, ShieldAlert, UserCheck } from 'lucide-react';
import type { NavPage, UserProfile } from '../types';

interface EmergencyPageProps {
  profile: UserProfile | null;
  onNavigate: (page: NavPage) => void;
}

export function EmergencyPage({ profile, onNavigate }: EmergencyPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Emergency Support &amp; Safety Guidance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Immediate emergency contacts and critical safety instructions for severe diabetes-related events.
        </p>
      </div>

      {/* Primary India Emergency 112 Banner */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
            <PhoneCall className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-red-700">India National Emergency Helpline</p>
            <h2 className="mt-1 text-2xl font-bold text-[#0F172A] font-mono-tabular">Dial 112 Immediately</h2>
            <p className="mt-1 text-sm text-slate-700 leading-relaxed">
              For medical emergencies, unresponsiveness, seizures, severe breathing difficulty, or persistent vomiting,
              contact emergency medical services immediately.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <a
            href="tel:112"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap"
          >
            <Phone className="h-4 w-4" />
            <span>Call 112 Now</span>
          </a>
          <button
            type="button"
            onClick={() => onNavigate('hospitals')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <MapPin className="h-4 w-4 text-[#0D9488]" />
            <span>Find Nearby Hospitals</span>
          </button>
        </div>
      </div>

      {/* Critical Unconscious / Swallowing Safety Instruction */}
      <div className="bg-white border border-amber-300 rounded-xl p-6">
        <div className="flex items-start gap-3.5">
          <AlertOctagon className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              Critical Swallowing &amp; Consciousness Safety Rule
            </h2>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              If a person is <strong>unconscious, severely drowsy, experiencing a seizure, or unable to swallow safely</strong>:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-800 list-disc pl-5">
              <li>
                <strong>NEVER give food, water, sugary drinks, honey, or oral glucose tablets.</strong> Giving anything
                by mouth to an unresponsive person creates a serious choking and aspiration hazard.
              </li>
              <li>
                <strong>Seek emergency medical assistance immediately (call 112)</strong> and place the person gently on
                their side in the recovery position while monitoring breathing until paramedics arrive.
              </li>
              <li>
                Inform emergency responders that the person lives with diabetes and share any known medication details.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Warning Signs & Personal Emergency Contacts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#0F172A]">Your Emergency Contacts</h2>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="text-xs font-semibold text-[#0D9488] hover:underline"
            >
              Update
            </button>
          </div>

          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <UserCheck className="h-3.5 w-3.5 text-[#0D9488]" />
                <span>Personal Emergency Contact</span>
              </div>
              <p className="mt-1.5 font-semibold text-slate-900">
                {profile?.emergency_contact_name || 'Not configured'}
              </p>
              {profile?.emergency_contact_phone ? (
                <a
                  href={`tel:${profile.emergency_contact_phone}`}
                  className="mt-1 inline-block text-xs font-mono-tabular font-semibold text-[#0D9488] hover:underline"
                >
                  {profile.emergency_contact_phone}
                </a>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Add a family or caregiver number in My Profile.</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <ShieldAlert className="h-3.5 w-3.5 text-[#0F2942]" />
                <span>Primary Healthcare Provider</span>
              </div>
              <p className="mt-1.5 font-semibold text-slate-900">
                {profile?.doctor_name || 'Not configured'}
              </p>
              {profile?.doctor_phone ? (
                <a
                  href={`tel:${profile.doctor_phone}`}
                  className="mt-1 inline-block text-xs font-mono-tabular font-semibold text-[#0F2942] hover:underline"
                >
                  {profile.doctor_phone}
                </a>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Add your doctor contact in My Profile.</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Key India Helpline Numbers</p>
              <p className="mt-1.5 font-mono-tabular">112 — National Emergency Response (Police / Fire / Ambulance)</p>
              <p className="mt-1 font-mono-tabular">108 — Emergency Ambulance Service (Available in most states)</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-[#0F2942]">Severe Low Glucose Warning Signs</h2>
            <p className="mt-1 text-xs text-slate-500">Hypoglycemia awareness</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700 list-disc pl-5">
              <li>Sudden shakiness, trembling, or cold sweating</li>
              <li>Confusion, slurred speech, or difficulty concentrating</li>
              <li>Dizziness, blurred vision, or unusual irritability</li>
              <li>Loss of consciousness or seizure activity</li>
            </ul>
            <p className="mt-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
              Only if the person is <strong>fully awake and able to swallow safely</strong>, follow the specific fast-acting
              carbohydrate plan recommended by their clinician and recheck glucose after 15 minutes.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-[#B91C1C]">Severe High Glucose Warning Signs</h2>
            <p className="mt-1 text-xs text-slate-500">Hyperglycemia / DKA / HHS awareness</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700 list-disc pl-5">
              <li>Persistent nausea, vomiting, or abdominal pain</li>
              <li>Rapid, deep breathing or fruity-smelling breath</li>
              <li>Extreme thirst, dry mouth, and frequent urination</li>
              <li>Severe weakness, drowsiness, or disorientation</li>
            </ul>
            <p className="mt-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
              Seek urgent clinical evaluation right away if these symptoms accompany elevated readings. Never self-adjust
              insulin or prescription medications without a doctor&apos;s guidance.
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Safety Disclaimer: This module provides general emergency preparedness information only. It does not issue
        automated medication prescriptions or emergency medical treatment orders.
      </p>
    </div>
  );
}
