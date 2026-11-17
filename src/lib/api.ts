import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GlucoseReading, GlucoseTargets, User } from '../types';

const TOKEN_STORAGE_KEY = 'dms_session_token';
const authExpiredListeners = new Set<() => void>();

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage quota / privacy mode restrictions; cookie fallback still applies
  }
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function onAuthExpired(listener: () => void): () => void {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
      clearAuthToken();
      if (url !== '/api/auth/me') {
        authExpiredListeners.forEach((fn) => fn());
      }
    }
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export function formatReadingType(type: 'fasting' | 'post_meal'): string {
  return type === 'fasting' ? 'Fasting' : 'Post-Meal';
}

export function formatTimestamp(ts: string): string {
  if (!ts) return '—';
  const normalized = ts.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusStyles(status: GlucoseReading['evaluation_status']): {
  textClass: string;
  dotClass: string;
  borderClass: string;
  bgClass: string;
} {
  switch (status) {
    case 'low':
      return {
        textClass: 'text-[#B91C1C]',
        dotClass: 'bg-[#DC2626]',
        borderClass: 'border-[#FECACA]',
        bgClass: 'bg-[#FEF2F2]',
      };
    case 'normal':
      return {
        textClass: 'text-[#0F766E]',
        dotClass: 'bg-[#0D9488]',
        borderClass: 'border-[#CCFBF1]',
        bgClass: 'bg-[#F0FDFA]',
      };
    case 'elevated':
      return {
        textClass: 'text-[#B45309]',
        dotClass: 'bg-[#D97706]',
        borderClass: 'border-[#FDE68A]',
        bgClass: 'bg-[#FFFBEB]',
      };
    case 'high':
      return {
        textClass: 'text-[#B91C1C]',
        dotClass: 'bg-[#DC2626]',
        borderClass: 'border-[#FECACA]',
        bgClass: 'bg-[#FEF2F2]',
      };
  }
}

export function generateGlucosePdfReport(
  user: User,
  readings: GlucoseReading[],
  targets: GlucoseTargets,
  filterSummary: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 41, 66);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Diabetes Management System — Glucose Log Report', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Patient: ${user.full_name} (${user.email})`, 14, 20);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24.5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Configured Reference Targets & Filter Scope', 14, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Fasting Target: ${targets.fasting_min}–${targets.fasting_max} mg/dL   |   Post-Meal Limit: <= ${targets.post_meal_max} mg/dL   |   Low Alert: < ${targets.low_threshold} mg/dL`,
    14,
    43
  );
  doc.text(`Report Scope: ${filterSummary}   |   Total Records Included: ${readings.length}`, 14, 48.5);

  const fastingVals = readings.filter((r) => r.reading_type === 'fasting').map((r) => r.reading_value);
  const postVals = readings.filter((r) => r.reading_type === 'post_meal').map((r) => r.reading_value);
  const avg = (arr: number[]) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A');

  doc.text(
    `Fasting Count: ${fastingVals.length} (Avg: ${avg(fastingVals)} mg/dL)   |   Post-Meal Count: ${postVals.length} (Avg: ${avg(postVals)} mg/dL)`,
    14,
    54
  );

  autoTable(doc, {
    startY: 60,
    head: [['Date & Time', 'Category', 'Glucose (mg/dL)', 'Evaluation', 'Notes']],
    body: readings.map((r) => [
      formatTimestamp(r.recorded_at),
      formatReadingType(r.reading_type),
      `${r.reading_value}`,
      r.evaluation_label,
      r.notes || '—',
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 41, 66],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [244, 246, 249],
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 70;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Disclaimer: Reference targets vary between individuals. Recorded evaluations are informational only and do not constitute a medical diagnosis.',
    14,
    Math.min(finalY + 10, 282),
    { maxWidth: 182 }
  );

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`glucose-report-${stamp}.pdf`);
}
