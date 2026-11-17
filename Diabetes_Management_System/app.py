import io
import math
from datetime import datetime
from functools import wraps
from flask import Flask, flash, jsonify, redirect, render_template, request, send_file, session, url_for
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
import requests
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config
from database import get_db_connection, init_db

app = Flask(__name__)
app.config.from_object(Config)
init_db()


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            flash("Please sign in to access your records.", "error")
            return redirect(url_for("login"))
        return fn(*args, **kwargs)

    return wrapper


def get_user_targets(conn, user_id):
    row = conn.execute(
        "SELECT low_threshold, fasting_min, fasting_max, post_meal_max FROM User_Profile WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if row:
        return dict(row)
    return {
        "low_threshold": Config.DEFAULT_LOW_THRESHOLD,
        "fasting_min": Config.DEFAULT_FASTING_MIN,
        "fasting_max": Config.DEFAULT_FASTING_MAX,
        "post_meal_max": Config.DEFAULT_POST_MEAL_MAX,
    }


def evaluate_glucose(value, reading_type, targets):
    low_t = float(targets["low_threshold"])
    f_min = float(targets["fasting_min"])
    f_max = float(targets["fasting_max"])
    p_max = float(targets["post_meal_max"])

    if value < 54:
        return {
            "label": "Severe Low",
            "status": "low",
            "message": f"Reading ({value} mg/dL) is critically below your low threshold ({low_t} mg/dL).",
            "warning": "If unconscious or unable to swallow safely, NEVER give food, water, or oral glucose. Call 112 immediately.",
        }

    lower_bound = min(low_t, f_min) if reading_type == "fasting" else low_t
    if value < lower_bound:
        return {
            "label": "Below Target (Low)",
            "status": "low",
            "message": f"Reading ({value} mg/dL) is below your configured lower bound.",
            "warning": "Monitor symptoms closely and follow your clinician's low-glucose plan.",
        }

    if reading_type == "fasting":
        if value <= f_max:
            return {
                "label": "Within Fasting Target",
                "status": "normal",
                "message": f"Fasting reading ({value} mg/dL) is within {f_min}-{f_max} mg/dL.",
                "warning": None,
            }
        if value < 126:
            return {
                "label": "Above Fasting Target",
                "status": "elevated",
                "message": f"Fasting reading ({value} mg/dL) is above your fasting limit ({f_max} mg/dL).",
                "warning": "Discuss persistent above-target morning readings with your physician.",
            }
        return {
            "label": "High Fasting Reading",
            "status": "high",
            "message": f"Fasting reading ({value} mg/dL) is notably elevated above {f_max} mg/dL.",
            "warning": "High alert: Seek prompt medical advice if readings remain >= 250 mg/dL or symptoms develop.",
        }

    if value <= p_max:
        return {
            "label": "Within Post-Meal Target",
            "status": "normal",
            "message": f"Post-meal reading ({value} mg/dL) is within your post-meal limit (<= {p_max} mg/dL).",
            "warning": None,
        }
    if value < 200:
        return {
            "label": "Above Post-Meal Target",
            "status": "elevated",
            "message": f"Post-meal reading ({value} mg/dL) exceeds your post-meal limit ({p_max} mg/dL).",
            "warning": "Record meal timing and review patterns with your healthcare provider.",
        }
    return {
        "label": "High Post-Meal Reading",
        "status": "high",
        "message": f"Post-meal reading ({value} mg/dL) is significantly above {p_max} mg/dL.",
        "warning": "High alert: Seek timely medical evaluation if readings remain high or symptoms occur.",
    }


@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        diabetes_type = request.form.get("diabetes_type", "Not specified").strip()

        if len(full_name) < 2 or "@" not in email or len(password) < 6:
            flash("Enter a valid full name, email address, and password (minimum 6 characters).", "error")
            return render_template("register.html")

        conn = get_db_connection()
        if conn.execute("SELECT id FROM Users WHERE email = ?", (email,)).fetchone():
            conn.close()
            flash("An account with that email already exists.", "error")
            return render_template("register.html")

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO Users (full_name, email, password_hash) VALUES (?, ?, ?)",
            (full_name, email, generate_password_hash(password)),
        )
        user_id = cur.lastrowid
        cur.execute(
            "INSERT INTO User_Profile (user_id, diabetes_type) VALUES (?, ?)",
            (user_id, diabetes_type or "Not specified"),
        )
        conn.commit()
        conn.close()

        session["user_id"] = user_id
        session["full_name"] = full_name
        return redirect(url_for("dashboard"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        conn = get_db_connection()
        user = conn.execute("SELECT * FROM Users WHERE email = ?", (email,)).fetchone()
        conn.close()

        if not user or not check_password_hash(user["password_hash"], password):
            flash("Invalid email or password.", "error")
            return render_template("login.html")

        session["user_id"] = user["id"]
        session["full_name"] = user["full_name"]
        return redirect(url_for("dashboard"))

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    uid = session["user_id"]
    conn = get_db_connection()
    user = conn.execute("SELECT id, full_name, email FROM Users WHERE id = ?", (uid,)).fetchone()
    profile = conn.execute("SELECT * FROM User_Profile WHERE user_id = ?", (uid,)).fetchone()
    total = conn.execute("SELECT COUNT(*) AS c FROM Glucose_Readings WHERE user_id = ?", (uid,)).fetchone()["c"]
    latest = conn.execute(
        "SELECT * FROM Glucose_Readings WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1", (uid,)
    ).fetchone()
    fasting = conn.execute(
        "SELECT COUNT(*) AS count, ROUND(AVG(reading_value), 1) AS avg_val FROM Glucose_Readings WHERE user_id = ? AND reading_type = 'fasting'",
        (uid,),
    ).fetchone()
    post_meal = conn.execute(
        "SELECT COUNT(*) AS count, ROUND(AVG(reading_value), 1) AS avg_val FROM Glucose_Readings WHERE user_id = ? AND reading_type = 'post_meal'",
        (uid,),
    ).fetchone()
    recent = conn.execute(
        "SELECT * FROM Glucose_Readings WHERE user_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 10", (uid,)
    ).fetchall()
    conn.close()

    return render_template(
        "dashboard.html",
        user=user,
        profile=profile,
        total=total,
        latest=latest,
        fasting=fasting,
        post_meal=post_meal,
        recent=recent,
    )


@app.route("/glucose", methods=["GET", "POST"])
@login_required
def glucose():
    uid = session["user_id"]
    conn = get_db_connection()
    targets = get_user_targets(conn, uid)
    evaluation = None

    if request.method == "POST":
        raw_val = request.form.get("reading_value", "").strip()
        reading_type = request.form.get("reading_type", "").strip()
        notes = request.form.get("notes", "").strip()

        try:
            value = float(raw_val)
        except ValueError:
            value = -1

        if value < 20 or value > 600 or reading_type not in ("fasting", "post_meal"):
            flash("Enter a numeric glucose value between 20 and 600 mg/dL and select Fasting or Post-Meal.", "error")
        else:
            evaluation = evaluate_glucose(value, reading_type, targets)
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(
                """
                INSERT INTO Glucose_Readings (user_id, reading_value, reading_type, recorded_at, evaluation_label, evaluation_status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (uid, value, reading_type, now_str, evaluation["label"], evaluation["status"], notes),
            )
            conn.commit()
            flash("Glucose reading evaluated and saved to SQLite.", "success")

    conn.close()
    return render_template("glucose.html", targets=targets, evaluation=evaluation)


@app.route("/history")
@login_required
def history():
    uid = session["user_id"]
    search = request.args.get("search", "").strip().lower()
    r_type = request.args.get("type", "all")
    from_date = request.args.get("from", "").strip()
    to_date = request.args.get("to", "").strip()

    clauses = ["user_id = ?"]
    params = [uid]
    if r_type in ("fasting", "post_meal"):
        clauses.append("reading_type = ?")
        params.append(r_type)
    if from_date:
        clauses.append("date(recorded_at) >= date(?)")
        params.append(from_date)
    if to_date:
        clauses.append("date(recorded_at) <= date(?)")
        params.append(to_date)
    if search:
        clauses.append("(LOWER(notes) LIKE ? OR LOWER(evaluation_label) LIKE ? OR CAST(reading_value AS TEXT) LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    conn = get_db_connection()
    readings = conn.execute(
        f"SELECT * FROM Glucose_Readings WHERE {' AND '.join(clauses)} ORDER BY recorded_at DESC, id DESC",
        params,
    ).fetchall()
    conn.close()
    return render_template("history.html", readings=readings, search=search, r_type=r_type, from_date=from_date, to_date=to_date)


@app.route("/history/update/<int:reading_id>", methods=["POST"])
@login_required
def update_reading(reading_id):
    uid = session["user_id"]
    raw_val = request.form.get("reading_value", "").strip()
    reading_type = request.form.get("reading_type", "").strip()
    notes = request.form.get("notes", "").strip()
    try:
        value = float(raw_val)
    except ValueError:
        value = -1

    if value < 20 or value > 600 or reading_type not in ("fasting", "post_meal"):
        flash("Invalid reading update parameters.", "error")
        return redirect(url_for("history"))

    conn = get_db_connection()
    targets = get_user_targets(conn, uid)
    ev = evaluate_glucose(value, reading_type, targets)
    conn.execute(
        """
        UPDATE Glucose_Readings
        SET reading_value = ?, reading_type = ?, evaluation_label = ?, evaluation_status = ?, notes = ?
        WHERE id = ? AND user_id = ?
        """,
        (value, reading_type, ev["label"], ev["status"], notes, reading_id, uid),
    )
    conn.commit()
    conn.close()
    flash("Reading updated.", "success")
    return redirect(url_for("history"))


@app.route("/history/delete/<int:reading_id>", methods=["POST"])
@login_required
def delete_reading(reading_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM Glucose_Readings WHERE id = ? AND user_id = ?", (reading_id, session["user_id"]))
    conn.commit()
    conn.close()
    flash("Reading deleted.", "success")
    return redirect(url_for("history"))


@app.route("/history/clear", methods=["POST"])
@login_required
def clear_history():
    conn = get_db_connection()
    conn.execute("DELETE FROM Glucose_Readings WHERE user_id = ?", (session["user_id"],))
    conn.commit()
    conn.close()
    flash("All reading history cleared.", "success")
    return redirect(url_for("history"))


@app.route("/history/pdf")
@login_required
def download_pdf():
    uid = session["user_id"]
    conn = get_db_connection()
    user = conn.execute("SELECT full_name, email FROM Users WHERE id = ?", (uid,)).fetchone()
    readings = conn.execute(
        "SELECT * FROM Glucose_Readings WHERE user_id = ? ORDER BY recorded_at DESC, id DESC", (uid,)
    ).fetchall()
    conn.close()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph("Diabetes Management System — Glucose Report", styles["Title"]),
        Paragraph(f"Patient: {user['full_name']} ({user['email']})", styles["Normal"]),
        Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles["Normal"]),
        Spacer(1, 14),
    ]

    table_data = [["Date & Time", "Category", "Value (mg/dL)", "Evaluation", "Notes"]]
    for r in readings:
        table_data.append([
            r["recorded_at"],
            "Fasting" if r["reading_type"] == "fasting" else "Post-Meal",
            str(r["reading_value"]),
            r["evaluation_label"],
            r["notes"] or "-",
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2942")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(table)
    elements.append(Spacer(1, 14))
    elements.append(
        Paragraph(
            "Disclaimer: Reference targets vary between individuals. Displayed results are informational only and are not medical diagnoses.",
            styles["Italic"],
        )
    )
    doc.build(elements)
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name="glucose-report.pdf", mimetype="application/pdf")


@app.route("/analysis")
@login_required
def analysis():
    conn = get_db_connection()
    readings = conn.execute(
        "SELECT * FROM Glucose_Readings WHERE user_id = ? ORDER BY recorded_at ASC, id ASC", (session["user_id"],)
    ).fetchall()
    conn.close()
    return render_template("analysis.html", readings=[dict(r) for r in readings])


@app.route("/emergency")
@login_required
def emergency():
    conn = get_db_connection()
    profile = conn.execute("SELECT * FROM User_Profile WHERE user_id = ?", (session["user_id"],)).fetchone()
    conn.close()
    return render_template("emergency.html", profile=profile)


@app.route("/hospitals")
@login_required
def hospitals():
    return render_template("hospitals.html")


@app.route("/api/hospitals")
@login_required
def api_hospitals():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    q = request.args.get("q", "").strip()
    radius = min(max(request.args.get("radius", default=5000, type=int), 1000), 25000)

    if q and (lat is None or lon is None):
        geo = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"format": "json", "limit": 1, "q": q},
            headers={"User-Agent": "DiabetesManagementSystem/1.0"},
            timeout=12,
        )
        items = geo.json()
        if not items:
            return jsonify({"error": f"No location found for '{q}'."}), 404
        lat = float(items[0]["lat"])
        lon = float(items[0]["lon"])

    if lat is None or lon is None:
        return jsonify({"error": "Coordinates or search query required."}), 400

    overpass_q = f"""
    [out:json][timeout:18];
    (
      node["amenity"~"^(hospital|clinic)$"](around:{radius},{lat},{lon});
      way["amenity"~"^(hospital|clinic)$"](around:{radius},{lat},{lon});
    );
    out center 35;
    """
    resp = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": overpass_q},
        headers={"User-Agent": "DiabetesManagementSystem/1.0"},
        timeout=20,
    )
    elements = resp.json().get("elements", [])
    results = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        f_lat = el.get("lat") or (el.get("center") or {}).get("lat")
        f_lon = el.get("lon") or (el.get("center") or {}).get("lon")
        if not name or f_lat is None or f_lon is None:
            continue
        addr_parts = [tags.get(k) for k in ("addr:housenumber", "addr:street", "addr:city", "addr:postcode") if tags.get(k)]
        d_lat = math.radians(f_lat - lat)
        d_lon = math.radians(f_lon - lon)
        a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat)) * math.cos(math.radians(f_lat)) * math.sin(d_lon / 2) ** 2
        dist = round(6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)
        results.append({
            "name": name,
            "type": "Hospital" if tags.get("amenity") == "hospital" else "Clinic",
            "address": tags.get("addr:full") or (", ".join(addr_parts) if addr_parts else None),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "lat": f_lat,
            "lon": f_lon,
            "distance_km": dist,
        })
    results.sort(key=lambda x: x["distance_km"])
    return jsonify({"center": {"lat": lat, "lon": lon}, "facilities": results[:25]})


@app.route("/nutrition")
@login_required
def nutrition():
    conn = get_db_connection()
    articles = conn.execute("SELECT * FROM Healthcare_Information ORDER BY sort_order ASC").fetchall()
    conn.close()
    return render_template("nutrition.html", articles=articles)


@app.route("/reminders", methods=["GET", "POST"])
@login_required
def reminders():
    uid = session["user_id"]
    conn = get_db_connection()
    if request.method == "POST":
        medicine_name = request.form.get("medicine_name", "").strip()
        dosage = request.form.get("dosage", "").strip()
        frequency = request.form.get("frequency", "Once Daily").strip()
        r_date = request.form.get("reminder_date", "").strip()
        r_time = request.form.get("reminder_time", "").strip()
        instructions = request.form.get("instructions", "").strip()
        if medicine_name and dosage and r_date and r_time:
            conn.execute(
                """
                INSERT INTO Medicine_Reminders (user_id, medicine_name, dosage, frequency, reminder_date, reminder_time, instructions)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (uid, medicine_name, dosage, frequency, r_date, r_time, instructions),
            )
            conn.commit()
            flash("Medicine reminder saved.", "success")
        else:
            flash("All required fields must be filled.", "error")

    items = conn.execute(
        "SELECT * FROM Medicine_Reminders WHERE user_id = ? ORDER BY reminder_date ASC, reminder_time ASC", (uid,)
    ).fetchall()
    conn.close()
    return render_template("reminders.html", reminders=items)


@app.route("/reminders/delete/<int:reminder_id>", methods=["POST"])
@login_required
def delete_reminder(reminder_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM Medicine_Reminders WHERE id = ? AND user_id = ?", (reminder_id, session["user_id"]))
    conn.commit()
    conn.close()
    return redirect(url_for("reminders"))


@app.route("/appointments", methods=["GET", "POST"])
@login_required
def appointments():
    uid = session["user_id"]
    conn = get_db_connection()
    if request.method == "POST":
        doctor_name = request.form.get("doctor_name", "").strip()
        specialty = request.form.get("specialty", "").strip()
        clinic_name = request.form.get("clinic_name", "").strip()
        a_date = request.form.get("appointment_date", "").strip()
        a_time = request.form.get("appointment_time", "").strip()
        reason = request.form.get("reason", "").strip()
        if doctor_name and clinic_name and a_date and a_time:
            conn.execute(
                """
                INSERT INTO Appointments (user_id, doctor_name, specialty, clinic_name, appointment_date, appointment_time, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (uid, doctor_name, specialty, clinic_name, a_date, a_time, reason),
            )
            conn.commit()
            flash("Appointment scheduled.", "success")
        else:
            flash("Doctor, clinic, date, and time are required.", "error")

    items = conn.execute(
        "SELECT * FROM Appointments WHERE user_id = ? ORDER BY appointment_date ASC, appointment_time ASC", (uid,)
    ).fetchall()
    conn.close()
    return render_template("appointments.html", appointments=items)


@app.route("/appointments/delete/<int:appt_id>", methods=["POST"])
@login_required
def delete_appointment(appt_id):
    conn = get_db_connection()
    conn.execute("DELETE FROM Appointments WHERE id = ? AND user_id = ?", (appt_id, session["user_id"]))
    conn.commit()
    conn.close()
    return redirect(url_for("appointments"))


@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    uid = session["user_id"]
    conn = get_db_connection()
    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        age = request.form.get("age", type=int)
        gender = request.form.get("gender", "").strip()
        diabetes_type = request.form.get("diabetes_type", "Not specified").strip()
        low_t = request.form.get("low_threshold", default=70.0, type=float)
        f_min = request.form.get("fasting_min", default=70.0, type=float)
        f_max = request.form.get("fasting_max", default=99.0, type=float)
        p_max = request.form.get("post_meal_max", default=140.0, type=float)
        ec_name = request.form.get("emergency_contact_name", "").strip()
        ec_phone = request.form.get("emergency_contact_phone", "").strip()
        doc_name = request.form.get("doctor_name", "").strip()
        doc_phone = request.form.get("doctor_phone", "").strip()

        if len(full_name) >= 2 and f_max > f_min and p_max > f_min:
            conn.execute("UPDATE Users SET full_name = ? WHERE id = ?", (full_name, uid))
            conn.execute(
                """
                UPDATE User_Profile
                SET age = ?, gender = ?, diabetes_type = ?, low_threshold = ?, fasting_min = ?, fasting_max = ?, post_meal_max = ?,
                    emergency_contact_name = ?, emergency_contact_phone = ?, doctor_name = ?, doctor_phone = ?, updated_at = datetime('now')
                WHERE user_id = ?
                """,
                (age, gender, diabetes_type, low_t, f_min, f_max, p_max, ec_name, ec_phone, doc_name, doc_phone, uid),
            )
            conn.commit()
            session["full_name"] = full_name
            flash("Profile and glucose targets updated.", "success")
        else:
            flash("Please provide valid profile details and target limits.", "error")

    user = conn.execute("SELECT id, full_name, email FROM Users WHERE id = ?", (uid,)).fetchone()
    prof = conn.execute("SELECT * FROM User_Profile WHERE user_id = ?", (uid,)).fetchone()
    conn.close()
    return render_template("profile.html", user=user, profile=prof)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
