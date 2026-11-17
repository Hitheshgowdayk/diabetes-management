import os
import sqlite3
from config import Config


def get_db_connection():
    os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.executescript(
        """
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
        """
    )

    existing = cur.execute("SELECT COUNT(*) AS cnt FROM Healthcare_Information").fetchone()["cnt"]
    if existing == 0:
        entries = [
            (
                "Balanced Plate Method",
                "Visual Meal Proportioning",
                "A flexible, non-restrictive approach to balancing vegetables, protein, and carbohydrates.",
                "Fill half your plate with non-starchy vegetables, one quarter with lean protein (fish, lentils, eggs, poultry, tofu), and one quarter with whole grains or fiber-rich carbohydrates.",
                1,
            ),
            (
                "Carbohydrate Awareness",
                "Understanding Glycemic Response",
                "Minimally processed, fiber-rich carbohydrates support steadier post-meal patterns.",
                "Pair whole carbohydrates with protein and healthy fats rather than consuming refined sugars alone. Avoid abrupt meal skipping without guidance from your clinician.",
                2,
            ),
            (
                "Physical Activity Awareness",
                "Consistent Everyday Movement",
                "Moderate daily activity supports insulin sensitivity and cardiovascular well-being.",
                "Aim for regular moderate activity such as a 15-to-30-minute walk after meals. Stay hydrated and consult your doctor before starting vigorous new exercise programs.",
                3,
            ),
            (
                "Hydration & Lifestyle",
                "Smart Hydration & Sleep Consistency",
                "Water intake and steady sleep habits support healthy daily metabolic balance.",
                "Choose plain water or unsweetened tea over sugary beverages, maintain regular sleep hours, and keep scheduled clinical follow-ups.",
                4,
            ),
        ]
        cur.executemany(
            "INSERT INTO Healthcare_Information (category, title, summary, content, sort_order) VALUES (?, ?, ?, ?, ?)",
            entries,
        )

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("SQLite database initialized at:", Config.DATABASE_PATH)
