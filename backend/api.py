# -*- coding: utf-8 -*-
"""
لایه پل ارتباطی بین رابط کاربری وب (جاوااسکریپت) و منطق پایتون.
هر متد این کلاس از طریق window.pywebview.api.<method_name>(...) در
جاوااسکریپت قابل فراخوانی است (به‌صورت خودکار توسط pywebview انجام می‌شود).

قرارداد خروجی: همه متدها یک دیکشنری برمی‌گردانند:
    {"ok": True, "data": ...}   یا   {"ok": False, "error": "پیام خطا"}
این الگو باعث می‌شود جاوااسکریپت همیشه با یک ساختار یکسان کار کند و
لازم نباشد try/except جداگانه برای هر تابع بنویسد.
"""

import os

import auth
import license_manager as lm
import settings_manager as sm
from database import Database, get_app_base_dir
from jalali_date import gregorian_to_jalali, format_jalali


def ok(data=None):
    return {"ok": True, "data": data}


def fail(message):
    return {"ok": False, "error": str(message)}


def row_to_dict(row):
    """sqlite3.Row را به dict معمولی تبدیل می‌کند (برای سریالایز شدن به JSON)"""
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows):
    return [dict(r) for r in rows]


class Api:
    def __init__(self):
        self.db = Database()
        self.base_dir = get_app_base_dir()
        self.current_user = None
        auth.ensure_default_admin(self.db)
        lm.ensure_trial_license(self.db)

    def __getattribute__(self, name):
        """
        هر متد عمومی این کلاس را با try/except می‌پوشاند تا اگر خطای
        غیرمنتظره‌ای رخ داد (مثلاً مشکل دیتابیس)، به‌جای گم شدن در لایه
        pywebview و نمایش پیام مبهم «خطای غیرمنتظره در ارتباط با برنامه»،
        پیام دقیق خطا به جاوااسکریپت برگردد و در کنسول پایتون هم چاپ شود.
        """
        attr = object.__getattribute__(self, name)
        if callable(attr) and not name.startswith("_"):
            def wrapped(*args, **kwargs):
                try:
                    return attr(*args, **kwargs)
                except Exception as e:
                    import traceback
                    print(f"=== خطا در متد Api.{name} ===")
                    traceback.print_exc()
                    return fail(f"خطای داخلی برنامه: {e}")
            return wrapped
        return attr

    # ================================================================
    # لایسنس
    # ================================================================
    def get_license_status(self):
        status = lm.get_license_status(self.db)
        jy, jm, jd = gregorian_to_jalali(
            status["expiry_date"].year, status["expiry_date"].month, status["expiry_date"].day)
        return ok({
            "type": status["type"],
            "days_left": status["days_left"],
            "is_expired": status["is_expired"],
            "expiry_date_jalali": format_jalali(jy, jm, jd),
        })

    def activate_license(self, key):
        success, message = lm.activate_license(self.db, key)
        return ok({"success": success, "message": message}) if success else fail(message)

    # ================================================================
    # احراز هویت
    # ================================================================
    def app_identity(self):
        """اطلاعات نمایشی صفحه ورود: نام برنامه + لوگو (base64) + وضعیت اولین اجرا"""
        return ok({
            "app_name": sm.get_app_name(self.db),
            "logo_data_url": sm.get_logo_data_url(self.db, self.base_dir),
            "is_first_run": self.db.count_users() <= 1,
        })

    def login(self, username, password):
        user = auth.login(self.db, username, password)
        if not user:
            return fail("نام کاربری یا رمز عبور اشتباه است.")
        user_dict = dict(user)
        user_dict.pop("password_hash", None)  # هرگز هش رمز عبور به سمت مرورگر ارسال نشود
        self.current_user = user_dict
        return ok(self.current_user)

    def get_current_user(self):
        return ok(self.current_user)

    def logout(self):
        self.current_user = None
        return ok(True)

    def check_password(self, password):
        """برای صفحه قفل خودکار: رمز کاربر جاری را دوباره تأیید می‌کند"""
        if not self.current_user:
            return fail("کاربری وارد نشده است.")
        user = auth.login(self.db, self.current_user["username"], password)
        return ok(True) if user else fail("رمز عبور اشتباه است.")

    # ================================================================
    # بیماران
    # ================================================================
    def list_patients(self, search=None):
        return ok(rows_to_list(self.db.get_patients(search or None)))

    def get_patient(self, patient_id):
        return ok(row_to_dict(self.db.get_patient(patient_id)))

    def add_patient(self, data):
        if not data.get("first_name") or not data.get("last_name"):
            return fail("نام و نام خانوادگی الزامی است.")
        new_id = self.db.add_patient(data)
        return ok({"id": new_id})

    def update_patient(self, patient_id, data):
        if not data.get("first_name") or not data.get("last_name"):
            return fail("نام و نام خانوادگی الزامی است.")
        self.db.update_patient(patient_id, data)
        return ok(True)

    def delete_patient(self, patient_id):
        self.db.delete_patient(patient_id)
        return ok(True)

    def patient_options(self):
        """لیست ساده (id, نام) برای دراپ‌داون‌های سایر صفحات"""
        return ok([{"id": p["id"], "name": p["full_name"]} for p in self.db.get_patients()])

    # ================================================================
    # نوبت‌دهی
    # ================================================================
    def list_appointments(self):
        return ok(rows_to_list(self.db.get_appointments()))

    def add_appointment(self, patient_id, date, time, status, notes):
        capacity = sm.get_daily_capacity(self.db)
        used = self.db.count_appointments_on_date(date)
        new_id = self.db.add_appointment(patient_id, date, time, status, notes)
        return ok({"id": new_id, "capacity_warning": bool(capacity and used >= capacity)})

    def update_appointment_status(self, appointment_id, status):
        self.db.update_appointment_status(appointment_id, status)
        return ok(True)

    def delete_appointment(self, appointment_id):
        self.db.delete_appointment(appointment_id)
        return ok(True)

    def get_day_capacity_info(self, date):
        capacity = sm.get_daily_capacity(self.db)
        used = self.db.count_appointments_on_date(date)
        return ok({"capacity": capacity, "used": used, "remaining": (capacity - used) if capacity else None})

    # ================================================================
    # کتابخانه تمرینات
    # ================================================================
    def list_exercises(self, search=None):
        return ok(rows_to_list(self.db.get_exercises(search or None)))

    def add_exercise(self, name, category, description, sets, reps, duration):
        if not name:
            return fail("نام تمرین الزامی است.")
        new_id = self.db.add_exercise(name, category, description, sets or None, reps or None, duration or None)
        return ok({"id": new_id})

    def delete_exercise(self, exercise_id):
        self.db.delete_exercise(exercise_id)
        return ok(True)

    def assign_exercise_to_patient(self, patient_id, exercise_id):
        self.db.assign_exercise_to_patient(patient_id, exercise_id)
        return ok(True)

    def get_patient_exercises(self, patient_id):
        return ok(rows_to_list(self.db.get_patient_exercises(patient_id)))

    # ================================================================
    # پیگیری پیشرفت
    # ================================================================
    def add_progress_log(self, patient_id, log_date, pain_level, mobility_score, notes):
        new_id = self.db.add_progress_log(patient_id, log_date, pain_level, mobility_score, notes)
        return ok({"id": new_id})

    def get_progress_logs(self, patient_id):
        return ok(rows_to_list(self.db.get_progress_logs(patient_id)))

    # ================================================================
    # کاربران (فقط مدیر)
    # ================================================================
    def list_users(self):
        users = []
        for u in self.db.list_users():
            if not u["active"]:
                continue
            d = dict(u)
            d.pop("password_hash", None)
            users.append(d)
        return ok(users)

    def create_user(self, first_name, last_name, username, password, role):
        if not all([first_name, last_name, username, password]):
            return fail("همه فیلدهای ضروری را پر کنید.")
        if len(password) < 4:
            return fail("رمز عبور باید حداقل ۴ کاراکتر باشد.")
        try:
            auth.create_user(self.db, first_name, last_name, username, password, role)
        except ValueError as e:
            return fail(str(e))
        return ok(True)

    def deactivate_user(self, user_id):
        self.db.deactivate_user(user_id)
        return ok(True)

    # ================================================================
    # تنظیمات (فقط مدیر)
    # ================================================================
    def get_settings(self):
        return ok({
            "app_name": sm.get_app_name(self.db),
            "auto_lock_minutes": sm.get_auto_lock_minutes(self.db),
            "daily_capacity": sm.get_daily_capacity(self.db),
            "logo_data_url": sm.get_logo_data_url(self.db, self.base_dir),
        })

    def save_app_name(self, name):
        sm.set_app_name(self.db, name)
        return ok(True)

    def save_auto_lock_minutes(self, minutes):
        sm.set_auto_lock_minutes(self.db, minutes)
        return ok(True)

    def save_daily_capacity(self, capacity):
        sm.set_daily_capacity(self.db, capacity)
        return ok(True)

    def remove_logo(self):
        sm.remove_logo(self.db, self.base_dir)
        return ok(True)

    def pick_and_save_logo(self):
        """با استفاده از دیالوگ فایل خود pywebview، لوگو را انتخاب و ذخیره می‌کند"""
        import webview
        window = webview.windows[0]
        result = window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False,
            file_types=("تصویر (*.png;*.jpg;*.jpeg;*.bmp;*.gif)",)
        )
        if not result:
            return ok(None)
        try:
            sm.save_logo(self.db, result[0], self.base_dir)
        except ValueError as e:
            return fail(str(e))
        return ok(sm.get_logo_data_url(self.db, self.base_dir))

    # ================================================================
    # گزارش‌ها / خروجی اکسل / پشتیبان‌گیری (فقط مدیر)
    # ================================================================
    def export_patients_excel(self):
        import webview
        from excel_export import export_patients
        window = webview.windows[0]
        path = window.create_file_dialog(
            webview.SAVE_DIALOG, save_filename="بیماران.xlsx",
            file_types=("فایل اکسل (*.xlsx)",))
        if not path:
            return ok(None)
        export_patients(self.db.get_patients(), path)
        return ok(str(path))

    def export_appointments_excel(self):
        import webview
        from excel_export import export_appointments
        window = webview.windows[0]
        path = window.create_file_dialog(
            webview.SAVE_DIALOG, save_filename="نوبت‌ها.xlsx",
            file_types=("فایل اکسل (*.xlsx)",))
        if not path:
            return ok(None)
        export_appointments(self.db.get_appointments(), path)
        return ok(str(path))

    def export_patient_profile_excel(self, patient_id):
        import webview
        from excel_export import export_patient_full_profile
        window = webview.windows[0]
        patient = self.db.get_patient(patient_id)
        path = window.create_file_dialog(
            webview.SAVE_DIALOG, save_filename=f"پرونده_{patient['full_name']}.xlsx",
            file_types=("فایل اکسل (*.xlsx)",))
        if not path:
            return ok(None)
        export_patient_full_profile(
            patient, self.db.get_appointments(patient_id),
            self.db.get_patient_exercises(patient_id), self.db.get_progress_logs(patient_id), path)
        return ok(str(path))

    def download_patient_import_template(self):
        import webview
        from excel_export import export_patient_import_template
        window = webview.windows[0]
        path = window.create_file_dialog(
            webview.SAVE_DIALOG, save_filename="قالب_بیماران.xlsx",
            file_types=("فایل اکسل (*.xlsx)",))
        if not path:
            return ok(None)
        export_patient_import_template(path)
        return ok(str(path))

    def upload_patients_excel(self):
        import webview
        from excel_export import import_patients_from_excel
        window = webview.windows[0]
        result = window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False, file_types=("فایل اکسل (*.xlsx)",))
        if not result:
            return ok(None)
        count, errors = import_patients_from_excel(result[0], self.db)
        return ok({"count": count, "errors": errors})

    def backup_database(self):
        import shutil
        import webview
        window = webview.windows[0]
        path = window.create_file_dialog(
            webview.SAVE_DIALOG, save_filename="physio_backup.db",
            file_types=("فایل دیتابیس (*.db)",))
        if not path:
            return ok(None)
        shutil.copyfile(self.db.db_path, path)
        return ok(str(path))
