import { useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, CheckCircle2, Edit3, PlusCircle, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Appointment } from '../types';

interface AppointmentsPageProps {
  onDataChanged: () => void;
}

export function AppointmentsPage({ onDataChanged }: AppointmentsPageProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'completed'>('all');

  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('Endocrinology / Diabetes Care');
  const [clinicName, setClinicName] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appointmentTime, setAppointmentTime] = useState('10:30');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<Appointment | null>(null);

  async function loadAppointments() {
    setLoading(true);
    try {
      const data = await apiRequest<{ appointments: Appointment[] }>('/api/appointments');
      setAppointments(data.appointments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!doctorName.trim() || !clinicName.trim() || !appointmentDate || !appointmentTime) {
      setError('Doctor name, clinic/hospital name, date, and time are required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await apiRequest(`/api/appointments/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            doctor_name: doctorName.trim(),
            specialty: specialty.trim(),
            clinic_name: clinicName.trim(),
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            reason: reason.trim(),
            status: editing.status,
          }),
        });
        setEditing(null);
      } else {
        await apiRequest('/api/appointments', {
          method: 'POST',
          body: JSON.stringify({
            doctor_name: doctorName.trim(),
            specialty: specialty.trim(),
            clinic_name: clinicName.trim(),
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            reason: reason.trim(),
          }),
        });
      }

      setDoctorName('');
      setClinicName('');
      setReason('');
      await loadAppointments();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save appointment.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(appt: Appointment) {
    setEditing(appt);
    setDoctorName(appt.doctor_name);
    setSpecialty(appt.specialty || '');
    setClinicName(appt.clinic_name);
    setAppointmentDate(appt.appointment_date);
    setAppointmentTime(appt.appointment_time);
    setReason(appt.reason || '');
  }

  function cancelEdit() {
    setEditing(null);
    setDoctorName('');
    setClinicName('');
    setReason('');
  }

  async function updateStatus(appt: Appointment, status: Appointment['status']) {
    try {
      await apiRequest(`/api/appointments/${appt.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          doctor_name: appt.doctor_name,
          specialty: appt.specialty,
          clinic_name: appt.clinic_name,
          appointment_date: appt.appointment_date,
          appointment_time: appt.appointment_time,
          reason: appt.reason,
          status,
        }),
      });
      await loadAppointments();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update appointment status.');
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiRequest(`/api/appointments/${id}`, { method: 'DELETE' });
      if (editing?.id === id) cancelEdit();
      await loadAppointments();
      onDataChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete appointment.');
    }
  }

  const visibleAppointments = appointments.filter((a) =>
    filterStatus === 'all' ? true : a.status === filterStatus
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Doctor Appointments</h1>
          <p className="mt-1 text-sm text-slate-600">
            Schedule and keep track of upcoming endocrinology, lab, and general physician consultations.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
          {(['all', 'scheduled', 'completed'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize whitespace-nowrap ${
                filterStatus === status ? 'bg-white text-[#0F2942] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
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
              {editing ? 'Edit Appointment' : 'Add Doctor Appointment'}
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
              <label htmlFor="appt-doctor" className="block text-xs font-medium text-slate-700 mb-1.5">
                Doctor Name
              </label>
              <input
                id="appt-doctor"
                type="text"
                required
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g., Dr. R. Krishnan"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="appt-specialty" className="block text-xs font-medium text-slate-700 mb-1.5">
                Specialty / Department
              </label>
              <input
                id="appt-specialty"
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g., Diabetology, Ophthalmology"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="appt-clinic" className="block text-xs font-medium text-slate-700 mb-1.5">
                Hospital / Clinic Name
              </label>
              <input
                id="appt-clinic"
                type="text"
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g., City Care Clinic"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="appt-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Date
                </label>
                <input
                  id="appt-date"
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="appt-time" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Time
                </label>
                <input
                  id="appt-time"
                  type="time"
                  required
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono-tabular text-slate-900 focus:border-[#0D9488] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="appt-reason" className="block text-xs font-medium text-slate-700 mb-1.5">
                Visit Purpose (Optional)
              </label>
              <textarea
                id="appt-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Quarterly HbA1c review and glucose log check"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173B5E] disabled:opacity-60 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{submitting ? 'Saving...' : editing ? 'Update Appointment' : 'Schedule Appointment'}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-bold text-[#0F172A] mb-4">Scheduled &amp; Past Appointments</h2>

          {loading ? (
            <p className="text-sm text-slate-500">Loading appointments...</p>
          ) : visibleAppointments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
              <CalendarClock className="h-7 w-7 text-slate-400 mx-auto" />
              <p className="mt-2 text-sm font-medium text-slate-700">No appointments found.</p>
              <p className="mt-1 text-xs text-slate-500">
                Add an upcoming clinic consultation using the form.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleAppointments.map((appt) => (
                <div key={appt.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{appt.doctor_name}</h3>
                        {appt.specialty && (
                          <>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-600">{appt.specialty}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-700">{appt.clinic_name}</p>
                      <p className="mt-1 text-xs font-mono-tabular text-[#0D9488]">
                        {appt.appointment_date} at {appt.appointment_time} ·{' '}
                        <span className="capitalize font-semibold">{appt.status}</span>
                      </p>
                      {appt.reason && <p className="mt-1.5 text-xs text-slate-500">{appt.reason}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {appt.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => updateStatus(appt, 'completed')}
                          className="inline-flex items-center gap-1 rounded border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Complete</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(appt)}
                        className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                        aria-label={`Edit appointment with ${appt.doctor_name}`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(appt.id)}
                        className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        aria-label={`Delete appointment with ${appt.doctor_name}`}
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
