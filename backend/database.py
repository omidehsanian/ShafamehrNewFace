"""
ماژول مدیریت دیتابیس برنامه فیزیوتراپی
از SQLite استفاده می‌کند که نیازی به نصب سرور جداگانه ندارد.
"""

import sqlite3
import os
import sys
from datetime import datetime

DB_NAME = "physio_clinic.db"


def get_app_base_dir():
    """
    مسیر پایه برنامه را برمی‌گرداند تا فایل دیتابیس همیشه در یک محل ثابت و
    پایدار ذخیره شود.

    نکته مهم: وقتی برنامه با pyinstaller (--onefile) به exe تبدیل می‌شود،
    هنگام اجرا فایل‌ها در یک پوشه‌ی موقت (sys._MEIPASS) استخراج می‌شوند و
    __file__ به همان پوشه موقت اشاره می‌کند. آن پوشه بعد از بسته شدن برنامه
    پاک می‌شود؛ اگر دیتابیس آنجا ذخیره شود، تمام اطلاعات از بین می‌رود.
    برای همین در حالت exe (sys.frozen) باید کنار خود فایل exe (نه پوشه موقت)
    ذخیره شود.
    """
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


class Database:
    def __init__(self, db_path=None):
        if db_path is None:
            db_path = os.path.join(get_app_base_dir(), DB_NAME)
        self.db_path = db_path
        # نکته مهم: pywebview هر فراخوانی از جاوااسکریپت به پایتون را در یک
        # thread جدید اجرا می‌کند. sqlite3 به‌صورت پیش‌فرض یک کانکشن را فقط
        # در همان threadـی که ساخته شده مجاز می‌داند. با check_same_thread=False
        # این محدودیت را غیرفعال می‌کنیم (خود ماژول sqlite3 پایتون به‌صورت
        # داخلی برای دسترسی هم‌زمان امن است).
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.row_factory = sqlite3.Row
        self._create_tables()
        self._migrate_old_schema()

    def _create_tables(self):
        cur = self.conn.cursor()

        cur.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            national_code TEXT,
            phone TEXT,
            gender TEXT,
            birth_date TEXT,
            address TEXT,
            occupation TEXT,
            primary_insurance TEXT,
            prescription_code TEXT,
            supplementary_insurance TEXT,
            supplementary_insurance_org TEXT,
            diagnosis TEXT,
            medical_history TEXT,
            allergies TEXT,
            referring_doctor TEXT,
            emergency_contact_name TEXT,
            emergency_contact_phone TEXT,
            blood_type TEXT,
            height TEXT,
            weight TEXT,
            notes TEXT,
            created_at TEXT
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            appointment_date TEXT NOT NULL,
            appointment_time TEXT NOT NULL,
            status TEXT DEFAULT 'برنامه‌ریزی شده',
            notes TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            description TEXT,
            sets INTEGER,
            reps INTEGER,
            duration_sec INTEGER
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS patient_exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            exercise_id INTEGER NOT NULL,
            assigned_date TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
            FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS progress_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            log_date TEXT NOT NULL,
            pain_level INTEGER,
            mobility_score INTEGER,
            notes TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT
        )
        """)

        # فقط یک ردیف مجاز است (id همیشه ۱) چون هر نصب فقط یک لایسنس دارد
        cur.execute("""
        CREATE TABLE IF NOT EXISTS license (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            license_type TEXT NOT NULL DEFAULT 'trial',
            issued_date TEXT NOT NULL,
            expiry_date TEXT NOT NULL,
            license_key TEXT
        )
        """)

        # تنظیمات عمومی برنامه به‌صورت کلید-مقدار (نام برنامه، مسیر لوگو،
        # مدت قفل خودکار و هر تنظیم دیگری که بعداً لازم شود)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """)

        self.conn.commit()

    def _migrate_old_schema(self):
        """
        اگر برنامه از نسخه قبلی (که فقط ستون full_name داشت) دیتابیس قدیمی
        روی سیستم کاربر باقی مانده باشد، این تابع ستون‌های جدید را اضافه
        می‌کند تا داده‌های قبلی از بین نروند.
        """
        cur = self.conn.cursor()
        cur.execute("PRAGMA table_info(patients)")
        existing_cols = {row["name"] for row in cur.fetchall()}

        new_columns = {
            "first_name": "TEXT", "last_name": "TEXT", "gender": "TEXT",
            "address": "TEXT", "occupation": "TEXT",
            "primary_insurance": "TEXT", "prescription_code": "TEXT",
            "supplementary_insurance": "TEXT", "supplementary_insurance_org": "TEXT",
            "medical_history": "TEXT", "allergies": "TEXT", "referring_doctor": "TEXT",
            "emergency_contact_name": "TEXT", "emergency_contact_phone": "TEXT",
            "blood_type": "TEXT", "height": "TEXT", "weight": "TEXT",
        }
        for col, col_type in new_columns.items():
            if col not in existing_cols:
                cur.execute(f"ALTER TABLE patients ADD COLUMN {col} {col_type}")

        # نسخه‌های قبلی یک فیلد «شماره بیمه پایه / دفترچه» داشتند که با «کد
        # رهگیری نسخه» جایگزین شد؛ مقدار قبلی (در صورت وجود) منتقل می‌شود تا
        # اطلاعات کاربر از بین نرود.
        if "primary_insurance_no" in existing_cols:
            cur.execute("""
                UPDATE patients SET prescription_code = primary_insurance_no
                WHERE (prescription_code IS NULL OR prescription_code = '')
                  AND primary_insurance_no IS NOT NULL AND primary_insurance_no != ''
            """)

        # نسخه‌های قبلی یک فیلد بی‌معنی به‌نام «شماره بیمه تکمیلی» داشتند؛
        # این مقدار (در صورت وجود) به فیلد جدید «نام سازمان» منتقل می‌شود
        # تا اطلاعات قبلی کاربر از بین نرود.
        if "supplementary_insurance_no" in existing_cols:
            cur.execute("""
                UPDATE patients SET supplementary_insurance_org = supplementary_insurance_no
                WHERE (supplementary_insurance_org IS NULL OR supplementary_insurance_org = '')
                  AND supplementary_insurance_no IS NOT NULL AND supplementary_insurance_no != ''
            """)

        if "full_name" in existing_cols:
            cur.execute("SELECT id, full_name FROM patients WHERE first_name IS NULL OR first_name = ''")
            for row in cur.fetchall():
                full_name = (row["full_name"] or "").strip()
                parts = full_name.split(" ", 1)
                first = parts[0] if parts else ""
                last = parts[1] if len(parts) > 1 else ""
                cur.execute("UPDATE patients SET first_name=?, last_name=? WHERE id=?",
                            (first, last, row["id"]))

        self.conn.commit()

    # ---------------- Patients ----------------
    def add_patient(self, data: dict):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO patients (
                first_name, last_name, national_code, phone, gender, birth_date,
                address, occupation, primary_insurance, prescription_code,
                supplementary_insurance, supplementary_insurance_org, diagnosis,
                medical_history, allergies, referring_doctor,
                emergency_contact_name, emergency_contact_phone,
                blood_type, height, weight, notes, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data.get("first_name", ""), data.get("last_name", ""),
            data.get("national_code", ""), data.get("phone", ""),
            data.get("gender", ""), data.get("birth_date", ""),
            data.get("address", ""), data.get("occupation", ""),
            data.get("primary_insurance", ""), data.get("prescription_code", ""),
            data.get("supplementary_insurance", ""), data.get("supplementary_insurance_org", ""),
            data.get("diagnosis", ""), data.get("medical_history", ""),
            data.get("allergies", ""), data.get("referring_doctor", ""),
            data.get("emergency_contact_name", ""), data.get("emergency_contact_phone", ""),
            data.get("blood_type", ""), data.get("height", ""), data.get("weight", ""),
            data.get("notes", ""), datetime.now().strftime("%Y-%m-%d %H:%M"),
        ))
        self.conn.commit()
        return cur.lastrowid

    def update_patient(self, patient_id, data: dict):
        cur = self.conn.cursor()
        cur.execute("""
            UPDATE patients SET
                first_name=?, last_name=?, national_code=?, phone=?, gender=?, birth_date=?,
                address=?, occupation=?, primary_insurance=?, prescription_code=?,
                supplementary_insurance=?, supplementary_insurance_org=?, diagnosis=?,
                medical_history=?, allergies=?, referring_doctor=?,
                emergency_contact_name=?, emergency_contact_phone=?,
                blood_type=?, height=?, weight=?, notes=?
            WHERE id=?
        """, (
            data.get("first_name", ""), data.get("last_name", ""),
            data.get("national_code", ""), data.get("phone", ""),
            data.get("gender", ""), data.get("birth_date", ""),
            data.get("address", ""), data.get("occupation", ""),
            data.get("primary_insurance", ""), data.get("prescription_code", ""),
            data.get("supplementary_insurance", ""), data.get("supplementary_insurance_org", ""),
            data.get("diagnosis", ""), data.get("medical_history", ""),
            data.get("allergies", ""), data.get("referring_doctor", ""),
            data.get("emergency_contact_name", ""), data.get("emergency_contact_phone", ""),
            data.get("blood_type", ""), data.get("height", ""), data.get("weight", ""),
            data.get("notes", ""), patient_id,
        ))
        self.conn.commit()

    def delete_patient(self, patient_id):
        cur = self.conn.cursor()
        cur.execute("DELETE FROM patients WHERE id=?", (patient_id,))
        self.conn.commit()

    def get_patients(self, search=None):
        cur = self.conn.cursor()
        if search:
            like = f"%{search}%"
            cur.execute("""
                SELECT *, (first_name || ' ' || last_name) AS full_name
                FROM patients
                WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR national_code LIKE ?
                ORDER BY first_name, last_name
            """, (like, like, like, like))
        else:
            cur.execute("""
                SELECT *, (first_name || ' ' || last_name) AS full_name
                FROM patients ORDER BY first_name, last_name
            """)
        return cur.fetchall()

    def get_patient(self, patient_id):
        cur = self.conn.cursor()
        cur.execute("""
            SELECT *, (first_name || ' ' || last_name) AS full_name
            FROM patients WHERE id=?
        """, (patient_id,))
        return cur.fetchone()

    # ---------------- Appointments ----------------
    def add_appointment(self, patient_id, date, time, status, notes):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO appointments (patient_id, appointment_date, appointment_time, status, notes)
            VALUES (?, ?, ?, ?, ?)
        """, (patient_id, date, time, status, notes))
        self.conn.commit()
        return cur.lastrowid

    def update_appointment_status(self, appointment_id, status):
        cur = self.conn.cursor()
        cur.execute("UPDATE appointments SET status=? WHERE id=?", (status, appointment_id))
        self.conn.commit()

    def delete_appointment(self, appointment_id):
        cur = self.conn.cursor()
        cur.execute("DELETE FROM appointments WHERE id=?", (appointment_id,))
        self.conn.commit()

    def get_appointments(self, patient_id=None):
        cur = self.conn.cursor()
        base = """
            SELECT a.id AS id, (p.first_name || ' ' || p.last_name) AS full_name,
                   a.appointment_date AS appointment_date, a.appointment_time AS appointment_time,
                   a.status AS status, a.notes AS notes, a.patient_id AS patient_id
            FROM appointments a JOIN patients p ON a.patient_id = p.id
        """
        if patient_id:
            cur.execute(base + " WHERE a.patient_id = ? ORDER BY a.appointment_date, a.appointment_time",
                        (patient_id,))
        else:
            cur.execute(base + " ORDER BY a.appointment_date, a.appointment_time")
        return cur.fetchall()

    def count_appointments_on_date(self, date_str, exclude_id=None):
        """تعداد نوبت‌های غیر لغوشده در یک تاریخ مشخص را برمی‌گرداند"""
        cur = self.conn.cursor()
        if exclude_id:
            cur.execute("""
                SELECT COUNT(*) AS c FROM appointments
                WHERE appointment_date = ? AND status != 'لغو شده' AND id != ?
            """, (date_str, exclude_id))
        else:
            cur.execute("""
                SELECT COUNT(*) AS c FROM appointments
                WHERE appointment_date = ? AND status != 'لغو شده'
            """, (date_str,))
        return cur.fetchone()["c"]

    # ---------------- Exercises ----------------
    def add_exercise(self, name, category, description, sets, reps, duration_sec):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO exercises (name, category, description, sets, reps, duration_sec)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (name, category, description, sets, reps, duration_sec))
        self.conn.commit()
        return cur.lastrowid

    def delete_exercise(self, exercise_id):
        cur = self.conn.cursor()
        cur.execute("DELETE FROM exercises WHERE id=?", (exercise_id,))
        self.conn.commit()

    def get_exercises(self, search=None):
        cur = self.conn.cursor()
        if search:
            cur.execute("SELECT * FROM exercises WHERE name LIKE ? OR category LIKE ? ORDER BY category, name",
                        (f"%{search}%", f"%{search}%"))
        else:
            cur.execute("SELECT * FROM exercises ORDER BY category, name")
        return cur.fetchall()

    def assign_exercise_to_patient(self, patient_id, exercise_id):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO patient_exercises (patient_id, exercise_id, assigned_date)
            VALUES (?, ?, ?)
        """, (patient_id, exercise_id, datetime.now().strftime("%Y-%m-%d")))
        self.conn.commit()

    def get_patient_exercises(self, patient_id):
        cur = self.conn.cursor()
        cur.execute("""
            SELECT pe.id AS id, e.name AS name, e.category AS category, e.sets AS sets,
                   e.reps AS reps, e.duration_sec AS duration_sec, pe.assigned_date AS assigned_date
            FROM patient_exercises pe JOIN exercises e ON pe.exercise_id = e.id
            WHERE pe.patient_id = ?
            ORDER BY pe.assigned_date DESC
        """, (patient_id,))
        return cur.fetchall()

    def remove_patient_exercise(self, patient_exercise_id):
        cur = self.conn.cursor()
        cur.execute("DELETE FROM patient_exercises WHERE id=?", (patient_exercise_id,))
        self.conn.commit()

    # ---------------- Progress Logs ----------------
    def add_progress_log(self, patient_id, log_date, pain_level, mobility_score, notes):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO progress_logs (patient_id, log_date, pain_level, mobility_score, notes)
            VALUES (?, ?, ?, ?, ?)
        """, (patient_id, log_date, pain_level, mobility_score, notes))
        self.conn.commit()
        return cur.lastrowid

    def get_progress_logs(self, patient_id):
        cur = self.conn.cursor()
        cur.execute("""
            SELECT id, log_date, pain_level, mobility_score, notes
            FROM progress_logs WHERE patient_id = ?
            ORDER BY log_date
        """, (patient_id,))
        return cur.fetchall()

    def delete_progress_log(self, log_id):
        cur = self.conn.cursor()
        cur.execute("DELETE FROM progress_logs WHERE id=?", (log_id,))
        self.conn.commit()

    # ---------------- Users ----------------
    def add_user(self, first_name, last_name, username, password_hash, role):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO users (first_name, last_name, username, password_hash, role, active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        """, (first_name, last_name, username, password_hash, role,
              datetime.now().strftime("%Y-%m-%d %H:%M")))
        self.conn.commit()
        return cur.lastrowid

    def get_user_by_username(self, username):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM users WHERE username = ? AND active = 1", (username,))
        return cur.fetchone()

    def get_user(self, user_id):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        return cur.fetchone()

    def list_users(self):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM users ORDER BY created_at")
        return cur.fetchall()

    def count_users(self):
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(*) AS c FROM users")
        return cur.fetchone()["c"]

    def deactivate_user(self, user_id):
        cur = self.conn.cursor()
        cur.execute("UPDATE users SET active = 0 WHERE id = ?", (user_id,))
        self.conn.commit()

    def update_user_password(self, user_id, password_hash):
        cur = self.conn.cursor()
        cur.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
        self.conn.commit()

    def username_exists(self, username):
        cur = self.conn.cursor()
        cur.execute("SELECT 1 FROM users WHERE username = ?", (username,))
        return cur.fetchone() is not None

    # ---------------- License ----------------
    def get_license(self):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM license WHERE id = 1")
        return cur.fetchone()

    def create_license(self, license_type, issued_date, expiry_date, license_key=None):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO license (id, license_type, issued_date, expiry_date, license_key)
            VALUES (1, ?, ?, ?, ?)
        """, (license_type, issued_date, expiry_date, license_key))
        self.conn.commit()

    def update_license(self, license_type, expiry_date, license_key=None):
        cur = self.conn.cursor()
        cur.execute("""
            UPDATE license SET license_type = ?, expiry_date = ?, license_key = ? WHERE id = 1
        """, (license_type, expiry_date, license_key))
        self.conn.commit()

    # ---------------- Settings ----------------
    def get_setting(self, key, default=None):
        cur = self.conn.cursor()
        cur.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cur.fetchone()
        return row["value"] if row else default

    def set_setting(self, key, value):
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (key, value))
        self.conn.commit()

    def close(self):
        self.conn.close()
