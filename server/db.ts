import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_DIR = path.resolve(process.cwd(), 'Diabetes_Management_System', 'database');
export const DB_PATH = path.join(DB_DIR, 'diabetes.db');

fs.mkdirSync(DB_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

export function initDatabase(): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS User_Profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      age INTEGER,
      gender TEXT DEFAULT '',
      diabetes_type TEXT DEFAULT 'Not specified',
      low_threshold REAL NOT NULL DEFAULT 70,
      fasting_min REAL NOT NULL DEFAULT 70,
      fasting_max REAL NOT NULL DEFAULT 99,
      post_meal_max REAL NOT NULL DEFAULT 140,
      emergency_contact_name TEXT DEFAULT '',
      emergency_contact_phone TEXT DEFAULT '',
      doctor_name TEXT DEFAULT '',
      doctor_phone TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Glucose_Readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reading_value REAL NOT NULL,
      reading_type TEXT NOT NULL CHECK (reading_type IN ('fasting', 'post_meal')),
      recorded_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      evaluation_label TEXT NOT NULL,
      evaluation_status TEXT NOT NULL CHECK (evaluation_status IN ('low', 'normal', 'elevated', 'high')),
      notes TEXT DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Medicine_Reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      reminder_date TEXT NOT NULL,
      reminder_time TEXT NOT NULL,
      instructions TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      doctor_name TEXT NOT NULL,
      specialty TEXT DEFAULT '',
      clinic_name TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      reason TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Healthcare_Information (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) AS count FROM Healthcare_Information').get() as { count: number };
  if (countRow.count === 0) {
    const insertInfo = db.prepare(`
      INSERT INTO Healthcare_Information (category, title, summary, content, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    const entries: Array<[string, string, string, string, number]> = [
      [
        'Balanced Plate Method',
        'Visual Meal Proportioning',
        'A straightforward non-restrictive approach to balancing fiber, lean protein, and carbohydrates at each meal.',
        'Fill half of a standard 9-inch plate with non-starchy vegetables such as spinach, broccoli, cauliflower, peppers, or green beans. Reserve one quarter for lean protein like fish, poultry, eggs, tofu, lentils, or beans, and the remaining quarter for whole-grain or high-fiber carbohydrate foods such as brown rice, quinoa, oats, or whole-wheat flatbread. Drink water or unsweetened tea alongside meals.',
        1,
      ],
      [
        'Carbohydrate Awareness',
        'Understanding Glycemic Response',
        'Choosing minimally processed, fiber-rich carbohydrates helps moderate post-meal glucose rises.',
        'All digestible carbohydrates affect blood glucose, yet fiber slows absorption. Pairing whole carbohydrates with protein and healthy fats—such as pairing apple slices with unsweetened nut butter or dal with brown rice and salad—supports steadier post-meal patterns than refined sugars or white-flour snacks eaten alone. Avoid skipping meals abruptly without guidance from your clinician.',
        2,
      ],
      [
        'Meal Timing & Consistency',
        'Regular Eating Schedules',
        'Consistent meal spacing supports predictable daily glucose monitoring.',
        'Spacing meals evenly across the day helps reduce wide swings between fasting and post-meal checks, especially if you take prescribed glucose-lowering medications. Keep a note of meal timing alongside post-meal readings (typically checked 1 to 2 hours after starting a meal, as advised by your care team).',
        3,
      ],
      [
        'Hydration & Everyday Choices',
        'Smart Beverage Selection',
        'Adequate hydration assists normal kidney function and prevents concentrated blood sugar readings.',
        'Prioritize plain water, sparkling water with lemon, or unsweetened herbal teas throughout the day. Sugar-sweetened sodas, packaged fruit juices, and heavily sweetened coffee or tea drinks can raise glucose rapidly without providing lasting fullness.',
        4,
      ],
      [
        'Physical Activity Awareness',
        'Safe Everyday Movement',
        'Moderate daily activity supports insulin sensitivity and cardiovascular health.',
        'Gentle, consistent movement such as a 15-to-30-minute brisk walk after meals, cycling, swimming, or light resistance exercises helps muscles use glucose effectively. Carry a fast-acting carbohydrate source when exercising if you use insulin or sulfonylureas, stay hydrated, wear supportive footwear, and consult your doctor before beginning vigorous new routines.',
        5,
      ],
      [
        'General Lifestyle Habits',
        'Sleep, Stress & Routine Checks',
        'Restful sleep and stress management play measurable roles in daily glucose patterns.',
        'Inadequate sleep and ongoing psychological stress release counter-regulatory hormones like cortisol that can elevate morning fasting levels. Establishing regular sleep hours, practicing slow breathing or light stretching, and keeping scheduled lab follow-ups (such as HbA1c checks) with your healthcare provider support long-term well-being.',
        6,
      ],
    ];

    for (const row of entries) {
      insertInfo.run(...row);
    }
  }
}
