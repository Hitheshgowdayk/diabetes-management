import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase } from './server/db.ts';
import { evaluateGlucoseReading, type GlucoseTargets } from './server/evaluator.ts';

initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update(process.cwd() + '_dms_secret_key').digest('hex');
const COOKIE_NAME = 'dms_session';

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

interface SessionUser {
  id: number;
  email: string;
  full_name: string;
}

interface AuthRequest extends Request {
  user?: SessionUser;
}

function signToken(payload: { uid: number; exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): { uid: number; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.uid !== 'number' || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setSessionCookie(req: Request, res: Response, userId: number): string {
  const token = signToken({ uid: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  return token;
}

function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  return null;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractAuthToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const verified = verifyToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  const user = db.prepare('SELECT id, full_name, email FROM Users WHERE id = ?').get(verified.uid) as SessionUser | undefined;
  if (!user) {
    res.status(401).json({ error: 'User account not found' });
    return;
  }
  req.user = user;
  next();
}

function getUserTargets(userId: number): GlucoseTargets {
  const row = db
    .prepare('SELECT low_threshold, fasting_min, fasting_max, post_meal_max FROM User_Profile WHERE user_id = ?')
    .get(userId) as GlucoseTargets | undefined;

  if (!row) {
    return { low_threshold: 70, fasting_min: 70, fasting_max: 99, post_meal_max: 140 };
  }
  return row;
}

// --- AUTH ROUTES ---

app.post('/api/auth/register', (req: Request, res: Response) => {
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const diabetesType = typeof req.body?.diabetes_type === 'string' ? req.body.diabetes_type.trim() : 'Not specified';

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM Users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO Users (full_name, email, password_hash) VALUES (?, ?, ?)')
    .run(fullName, email, passwordHash);

  const userId = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO User_Profile (user_id, diabetes_type) VALUES (?, ?)').run(userId, diabetesType || 'Not specified');

  const token = setSessionCookie(req, res, userId);
  res.status(201).json({
    user: { id: userId, full_name: fullName, email },
    token,
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = db
    .prepare('SELECT id, full_name, email, password_hash FROM Users WHERE email = ?')
    .get(email) as { id: number; full_name: string; email: string; password_hash: string } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = setSessionCookie(req, res, user.id);
  res.json({
    user: { id: user.id, full_name: user.full_name, email: user.email },
    token,
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// --- PROFILE ROUTES ---

app.get('/api/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  let profile = db.prepare('SELECT * FROM User_Profile WHERE user_id = ?').get(userId);
  if (!profile) {
    db.prepare('INSERT INTO User_Profile (user_id) VALUES (?)').run(userId);
    profile = db.prepare('SELECT * FROM User_Profile WHERE user_id = ?').get(userId);
  }
  res.json({
    user: req.user,
    profile,
  });
});

app.put('/api/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : req.user!.full_name;
  const ageRaw = req.body?.age;
  const age = ageRaw === '' || ageRaw === null || ageRaw === undefined ? null : Number(ageRaw);
  const gender = typeof req.body?.gender === 'string' ? req.body.gender.trim() : '';
  const diabetesType = typeof req.body?.diabetes_type === 'string' ? req.body.diabetes_type.trim() : 'Not specified';
  const emergencyContactName = typeof req.body?.emergency_contact_name === 'string' ? req.body.emergency_contact_name.trim() : '';
  const emergencyContactPhone = typeof req.body?.emergency_contact_phone === 'string' ? req.body.emergency_contact_phone.trim() : '';
  const doctorName = typeof req.body?.doctor_name === 'string' ? req.body.doctor_name.trim() : '';
  const doctorPhone = typeof req.body?.doctor_phone === 'string' ? req.body.doctor_phone.trim() : '';

  const lowThreshold = Number(req.body?.low_threshold ?? 70);
  const fastingMin = Number(req.body?.fasting_min ?? 70);
  const fastingMax = Number(req.body?.fasting_max ?? 99);
  const postMealMax = Number(req.body?.post_meal_max ?? 140);

  if (fullName.length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  if (age !== null && (!Number.isFinite(age) || age < 1 || age > 120)) {
    res.status(400).json({ error: 'Age must be between 1 and 120.' });
    return;
  }
  if (
    !Number.isFinite(lowThreshold) ||
    !Number.isFinite(fastingMin) ||
    !Number.isFinite(fastingMax) ||
    !Number.isFinite(postMealMax) ||
    lowThreshold < 40 ||
    lowThreshold > 100 ||
    fastingMin < 50 ||
    fastingMax <= fastingMin ||
    fastingMax > 250 ||
    postMealMax <= fastingMin ||
    postMealMax > 350
  ) {
    res.status(400).json({ error: 'Please provide valid target glucose bounds (fasting max > fasting min, post-meal max > fasting min).' });
    return;
  }

  db.prepare('UPDATE Users SET full_name = ? WHERE id = ?').run(fullName, userId);
  db.prepare(`
    UPDATE User_Profile
    SET age = ?, gender = ?, diabetes_type = ?, low_threshold = ?, fasting_min = ?, fasting_max = ?, post_meal_max = ?,
        emergency_contact_name = ?, emergency_contact_phone = ?, doctor_name = ?, doctor_phone = ?, updated_at = datetime('now')
    WHERE user_id = ?
  `).run(
    age,
    gender,
    diabetesType,
    lowThreshold,
    fastingMin,
    fastingMax,
    postMealMax,
    emergencyContactName,
    emergencyContactPhone,
    doctorName,
    doctorPhone,
    userId
  );

  const updatedUser = db.prepare('SELECT id, full_name, email FROM Users WHERE id = ?').get(userId);
  const updatedProfile = db.prepare('SELECT * FROM User_Profile WHERE user_id = ?').get(userId);
  res.json({ user: updatedUser, profile: updatedProfile });
});

// --- GLUCOSE ROUTES ---

app.get('/api/glucose/summary', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const targets = getUserTargets(userId);

  const totalRow = db
    .prepare('SELECT COUNT(*) AS total FROM Glucose_Readings WHERE user_id = ?')
    .get(userId) as { total: number };

  const latest = db
    .prepare('SELECT * FROM Glucose_Readings WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1')
    .get(userId);

  const fastingStats = db
    .prepare(`
      SELECT COUNT(*) AS count, ROUND(AVG(reading_value), 1) AS avg_value, MIN(reading_value) AS min_value, MAX(reading_value) AS max_value
      FROM Glucose_Readings WHERE user_id = ? AND reading_type = 'fasting'
    `)
    .get(userId) as { count: number; avg_value: number | null; min_value: number | null; max_value: number | null };

  const latestFasting = db
    .prepare("SELECT * FROM Glucose_Readings WHERE user_id = ? AND reading_type = 'fasting' ORDER BY recorded_at DESC, id DESC LIMIT 1")
    .get(userId);

  const postMealStats = db
    .prepare(`
      SELECT COUNT(*) AS count, ROUND(AVG(reading_value), 1) AS avg_value, MIN(reading_value) AS min_value, MAX(reading_value) AS max_value
      FROM Glucose_Readings WHERE user_id = ? AND reading_type = 'post_meal'
    `)
    .get(userId) as { count: number; avg_value: number | null; min_value: number | null; max_value: number | null };

  const latestPostMeal = db
    .prepare("SELECT * FROM Glucose_Readings WHERE user_id = ? AND reading_type = 'post_meal' ORDER BY recorded_at DESC, id DESC LIMIT 1")
    .get(userId);

  const recentReadings = db
    .prepare('SELECT * FROM Glucose_Readings WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 10')
    .all(userId);

  const upcomingAppointments = db
    .prepare(`
      SELECT * FROM Appointments
      WHERE user_id = ? AND status = 'scheduled' AND appointment_date >= date('now', 'localtime')
      ORDER BY appointment_date ASC, appointment_time ASC LIMIT 3
    `)
    .all(userId);

  const activeRemindersCount = (
    db.prepare('SELECT COUNT(*) AS count FROM Medicine_Reminders WHERE user_id = ? AND is_active = 1').get(userId) as { count: number }
  ).count;

  res.json({
    totalReadings: totalRow.total,
    latestReading: latest ?? null,
    fastingSummary: { ...fastingStats, latest: latestFasting ?? null },
    postMealSummary: { ...postMealStats, latest: latestPostMeal ?? null },
    recentReadings,
    upcomingAppointments,
    activeRemindersCount,
    targets,
  });
});

app.get('/api/glucose', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const type = typeof req.query.type === 'string' ? req.query.type : 'all';
  const fromDate = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const toDate = typeof req.query.to === 'string' ? req.query.to.trim() : '';

  const conditions: string[] = ['user_id = ?'];
  const params: Array<string | number> = [userId];

  if (type === 'fasting' || type === 'post_meal') {
    conditions.push('reading_type = ?');
    params.push(type);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    conditions.push('date(recorded_at) >= date(?)');
    params.push(fromDate);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    conditions.push('date(recorded_at) <= date(?)');
    params.push(toDate);
  }
  if (search) {
    conditions.push('(LOWER(notes) LIKE ? OR LOWER(evaluation_label) LIKE ? OR CAST(reading_value AS TEXT) LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const sql = `SELECT * FROM Glucose_Readings WHERE ${conditions.join(' AND ')} ORDER BY recorded_at DESC, id DESC`;
  const readings = db.prepare(sql).all(...params);
  res.json({ readings });
});

app.post('/api/glucose', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const rawVal = req.body?.reading_value;
  const readingType = req.body?.reading_type;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  const customRecordedAt = typeof req.body?.recorded_at === 'string' ? req.body.recorded_at.trim() : '';

  if (rawVal === '' || rawVal === null || rawVal === undefined) {
    res.status(400).json({ error: 'Glucose value is required.' });
    return;
  }
  const value = Number(rawVal);
  if (!Number.isFinite(value) || value < 20 || value > 600) {
    res.status(400).json({ error: 'Please enter a valid glucose reading between 20 and 600 mg/dL.' });
    return;
  }
  if (readingType !== 'fasting' && readingType !== 'post_meal') {
    res.status(400).json({ error: 'Reading category must be either fasting or post_meal.' });
    return;
  }

  const targets = getUserTargets(userId);
  const evaluation = evaluateGlucoseReading(value, readingType, targets);

  const recordedAt =
    customRecordedAt && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(customRecordedAt)
      ? customRecordedAt.replace('T', ' ').slice(0, 19)
      : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace('T', ' ');

  const result = db
    .prepare(`
      INSERT INTO Glucose_Readings (user_id, reading_value, reading_type, recorded_at, evaluation_label, evaluation_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(userId, value, readingType, recordedAt, evaluation.label, evaluation.status, notes);

  const created = db.prepare('SELECT * FROM Glucose_Readings WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ reading: created, evaluation });
});

app.put('/api/glucose/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM Glucose_Readings WHERE id = ? AND user_id = ?').get(id, userId) as
    | { id: number; recorded_at: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Reading not found.' });
    return;
  }

  const value = Number(req.body?.reading_value);
  const readingType = req.body?.reading_type;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
  const recordedAtRaw = typeof req.body?.recorded_at === 'string' ? req.body.recorded_at.trim() : existing.recorded_at;
  const recordedAt = recordedAtRaw.replace('T', ' ').slice(0, 19);

  if (!Number.isFinite(value) || value < 20 || value > 600) {
    res.status(400).json({ error: 'Glucose value must be between 20 and 600 mg/dL.' });
    return;
  }
  if (readingType !== 'fasting' && readingType !== 'post_meal') {
    res.status(400).json({ error: 'Reading type must be fasting or post_meal.' });
    return;
  }

  const targets = getUserTargets(userId);
  const evaluation = evaluateGlucoseReading(value, readingType, targets);

  db.prepare(`
    UPDATE Glucose_Readings
    SET reading_value = ?, reading_type = ?, recorded_at = ?, evaluation_label = ?, evaluation_status = ?, notes = ?
    WHERE id = ? AND user_id = ?
  `).run(value, readingType, recordedAt, evaluation.label, evaluation.status, notes, id, userId);

  const updated = db.prepare('SELECT * FROM Glucose_Readings WHERE id = ?').get(id);
  res.json({ reading: updated, evaluation });
});

app.delete('/api/glucose/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM Glucose_Readings WHERE id = ? AND user_id = ?').run(id, userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Reading not found.' });
    return;
  }
  res.json({ ok: true });
});

app.delete('/api/glucose', requireAuth, (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  db.prepare('DELETE FROM Glucose_Readings WHERE user_id = ?').run(userId);
  res.json({ ok: true });
});

// --- MEDICINE REMINDERS ROUTES ---

app.get('/api/reminders', requireAuth, (req: AuthRequest, res: Response) => {
  const reminders = db
    .prepare('SELECT * FROM Medicine_Reminders WHERE user_id = ? ORDER BY is_active DESC, reminder_date ASC, reminder_time ASC')
    .all(req.user!.id);
  res.json({ reminders });
});

app.post('/api/reminders', requireAuth, (req: AuthRequest, res: Response) => {
  const medicineName = typeof req.body?.medicine_name === 'string' ? req.body.medicine_name.trim() : '';
  const dosage = typeof req.body?.dosage === 'string' ? req.body.dosage.trim() : '';
  const frequency = typeof req.body?.frequency === 'string' ? req.body.frequency.trim() : 'Daily';
  const reminderDate = typeof req.body?.reminder_date === 'string' ? req.body.reminder_date.trim() : '';
  const reminderTime = typeof req.body?.reminder_time === 'string' ? req.body.reminder_time.trim() : '';
  const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';

  if (!medicineName || !dosage || !reminderDate || !reminderTime) {
    res.status(400).json({ error: 'Medicine name, dosage, date, and time are required.' });
    return;
  }

  const result = db
    .prepare(`
      INSERT INTO Medicine_Reminders (user_id, medicine_name, dosage, frequency, reminder_date, reminder_time, instructions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(req.user!.id, medicineName, dosage, frequency, reminderDate, reminderTime, instructions);

  const created = db.prepare('SELECT * FROM Medicine_Reminders WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ reminder: created });
});

app.put('/api/reminders/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM Medicine_Reminders WHERE id = ? AND user_id = ?').get(id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Reminder not found.' });
    return;
  }

  const medicineName = typeof req.body?.medicine_name === 'string' ? req.body.medicine_name.trim() : '';
  const dosage = typeof req.body?.dosage === 'string' ? req.body.dosage.trim() : '';
  const frequency = typeof req.body?.frequency === 'string' ? req.body.frequency.trim() : 'Daily';
  const reminderDate = typeof req.body?.reminder_date === 'string' ? req.body.reminder_date.trim() : '';
  const reminderTime = typeof req.body?.reminder_time === 'string' ? req.body.reminder_time.trim() : '';
  const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim() : '';
  const isActive = req.body?.is_active === false || req.body?.is_active === 0 ? 0 : 1;

  if (!medicineName || !dosage || !reminderDate || !reminderTime) {
    res.status(400).json({ error: 'Medicine name, dosage, date, and time are required.' });
    return;
  }

  db.prepare(`
    UPDATE Medicine_Reminders
    SET medicine_name = ?, dosage = ?, frequency = ?, reminder_date = ?, reminder_time = ?, instructions = ?, is_active = ?
    WHERE id = ? AND user_id = ?
  `).run(medicineName, dosage, frequency, reminderDate, reminderTime, instructions, isActive, id, req.user!.id);

  const updated = db.prepare('SELECT * FROM Medicine_Reminders WHERE id = ?').get(id);
  res.json({ reminder: updated });
});

app.delete('/api/reminders/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM Medicine_Reminders WHERE id = ? AND user_id = ?').run(id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Reminder not found.' });
    return;
  }
  res.json({ ok: true });
});

// --- APPOINTMENTS ROUTES ---

app.get('/api/appointments', requireAuth, (req: AuthRequest, res: Response) => {
  const appointments = db
    .prepare('SELECT * FROM Appointments WHERE user_id = ? ORDER BY appointment_date ASC, appointment_time ASC')
    .all(req.user!.id);
  res.json({ appointments });
});

app.post('/api/appointments', requireAuth, (req: AuthRequest, res: Response) => {
  const doctorName = typeof req.body?.doctor_name === 'string' ? req.body.doctor_name.trim() : '';
  const specialty = typeof req.body?.specialty === 'string' ? req.body.specialty.trim() : '';
  const clinicName = typeof req.body?.clinic_name === 'string' ? req.body.clinic_name.trim() : '';
  const appointmentDate = typeof req.body?.appointment_date === 'string' ? req.body.appointment_date.trim() : '';
  const appointmentTime = typeof req.body?.appointment_time === 'string' ? req.body.appointment_time.trim() : '';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

  if (!doctorName || !clinicName || !appointmentDate || !appointmentTime) {
    res.status(400).json({ error: 'Doctor name, clinic/hospital name, date, and time are required.' });
    return;
  }

  const result = db
    .prepare(`
      INSERT INTO Appointments (user_id, doctor_name, specialty, clinic_name, appointment_date, appointment_time, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(req.user!.id, doctorName, specialty, clinicName, appointmentDate, appointmentTime, reason);

  const created = db.prepare('SELECT * FROM Appointments WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ appointment: created });
});

app.put('/api/appointments/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM Appointments WHERE id = ? AND user_id = ?').get(id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }

  const doctorName = typeof req.body?.doctor_name === 'string' ? req.body.doctor_name.trim() : '';
  const specialty = typeof req.body?.specialty === 'string' ? req.body.specialty.trim() : '';
  const clinicName = typeof req.body?.clinic_name === 'string' ? req.body.clinic_name.trim() : '';
  const appointmentDate = typeof req.body?.appointment_date === 'string' ? req.body.appointment_date.trim() : '';
  const appointmentTime = typeof req.body?.appointment_time === 'string' ? req.body.appointment_time.trim() : '';
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const status = req.body?.status === 'completed' || req.body?.status === 'cancelled' ? req.body.status : 'scheduled';

  if (!doctorName || !clinicName || !appointmentDate || !appointmentTime) {
    res.status(400).json({ error: 'Doctor name, clinic/hospital name, date, and time are required.' });
    return;
  }

  db.prepare(`
    UPDATE Appointments
    SET doctor_name = ?, specialty = ?, clinic_name = ?, appointment_date = ?, appointment_time = ?, reason = ?, status = ?
    WHERE id = ? AND user_id = ?
  `).run(doctorName, specialty, clinicName, appointmentDate, appointmentTime, reason, status, id, req.user!.id);

  const updated = db.prepare('SELECT * FROM Appointments WHERE id = ?').get(id);
  res.json({ appointment: updated });
});

app.delete('/api/appointments/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM Appointments WHERE id = ? AND user_id = ?').run(id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Appointment not found.' });
    return;
  }
  res.json({ ok: true });
});

// --- HEALTHCARE INFORMATION ROUTE ---

app.get('/api/nutrition', requireAuth, (_req: AuthRequest, res: Response) => {
  const articles = db.prepare('SELECT * FROM Healthcare_Information ORDER BY sort_order ASC, id ASC').all();
  res.json({ articles });
});

// --- NEARBY HOSPITALS (OPENSTREETMAP OVERPASS + NOMINATIM) ---

interface OsmElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatOsmAddress(tags: Record<string, string>): string | null {
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    tags['addr:state'],
    tags['addr:postcode'],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

async function fetchNearbyOsmFacilities(lat: number, lon: number, radiusMeters: number) {
  const query = `
    [out:json][timeout:18];
    (
      node["amenity"~"^(hospital|clinic)$"](around:${radiusMeters},${lat},${lon});
      way["amenity"~"^(hospital|clinic)$"](around:${radiusMeters},${lat},${lon});
      relation["amenity"~"^(hospital|clinic)$"](around:${radiusMeters},${lat},${lon});
    );
    out center 40;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'DiabetesManagementSystem/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API returned status ${response.status}`);
  }

  const data = (await response.json()) as { elements?: OsmElement[] };
  const elements = Array.isArray(data.elements) ? data.elements : [];

  const facilities = elements
    .map((el) => {
      const tags = el.tags || {};
      const name = tags.name?.trim();
      const fLat = el.lat ?? el.center?.lat;
      const fLon = el.lon ?? el.center?.lon;
      if (!name || typeof fLat !== 'number' || typeof fLon !== 'number') return null;

      const phone = tags.phone || tags['contact:phone'] || tags['phone:IN'] || null;
      const address = formatOsmAddress(tags);
      const emergency = tags.emergency === 'yes';

      return {
        id: `${el.type}_${el.id}`,
        name,
        facilityType: tags.amenity === 'hospital' ? 'Hospital' : 'Clinic',
        address,
        phone,
        website: tags.website || tags['contact:website'] || null,
        emergency,
        lat: fLat,
        lon: fLon,
        distanceKm: Number(haversineKm(lat, lon, fLat, fLon).toFixed(2)),
        source: 'OpenStreetMap',
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 25);

  return facilities;
}

app.get('/api/hospitals/nearby', requireAuth, async (req: AuthRequest, res: Response) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Math.min(Math.max(Number(req.query.radius) || 5000, 1000), 25000);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
    return;
  }

  try {
    const facilities = await fetchNearbyOsmFacilities(lat, lon, radius);
    res.json({ center: { lat, lon }, facilities });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to reach OpenStreetMap Overpass API right now.',
    });
  }
});

app.get('/api/hospitals/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const radius = Math.min(Math.max(Number(req.query.radius) || 7000, 1000), 25000);

  if (q.length < 2) {
    res.status(400).json({ error: 'Please enter a city, locality, or postal code to search.' });
    return;
  }

  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      {
        headers: {
          'User-Agent': 'DiabetesManagementSystem/1.0',
          Accept: 'application/json',
        },
      }
    );

    if (!geoRes.ok) {
      throw new Error(`Geocoding service returned status ${geoRes.status}`);
    }

    const locations = (await geoRes.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!Array.isArray(locations) || locations.length === 0) {
      res.status(404).json({ error: `No matching location found for "${q}". Try adding a city or country name.` });
      return;
    }

    const lat = Number(locations[0].lat);
    const lon = Number(locations[0].lon);
    const facilities = await fetchNearbyOsmFacilities(lat, lon, radius);

    res.json({
      center: { lat, lon, displayName: locations[0].display_name },
      facilities,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to search nearby healthcare facilities right now.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Diabetes Management System server listening on http://localhost:${PORT}`);
  });
}

startServer();
