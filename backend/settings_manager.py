# -*- coding: utf-8 -*-
"""
مدیریت تنظیمات قابل‌ویرایش برنامه: نام برنامه، لوگوی مرکز، مدت قفل خودکار،
ظرفیت روزانه نوبت‌دهی
"""

import os
import shutil
import base64

DEFAULT_APP_NAME = "سامانه مدیریت کلینیک فیزیوتراپی"
DEFAULT_AUTO_LOCK_MINUTES = 15  # صفر یعنی قفل خودکار غیرفعال است
DEFAULT_DAILY_CAPACITY = 20  # حداکثر تعداد نوبت مجاز در هر روز (صفر = بدون محدودیت)

KEY_APP_NAME = "app_name"
KEY_LOGO_FILENAME = "logo_filename"
KEY_AUTO_LOCK_MINUTES = "auto_lock_minutes"
KEY_DAILY_CAPACITY = "daily_capacity"


def get_app_name(db):
    return db.get_setting(KEY_APP_NAME, DEFAULT_APP_NAME) or DEFAULT_APP_NAME


def set_app_name(db, name):
    name = (name or "").strip() or DEFAULT_APP_NAME
    db.set_setting(KEY_APP_NAME, name)


def get_auto_lock_minutes(db):
    try:
        return int(db.get_setting(KEY_AUTO_LOCK_MINUTES, DEFAULT_AUTO_LOCK_MINUTES))
    except (TypeError, ValueError):
        return DEFAULT_AUTO_LOCK_MINUTES


def set_auto_lock_minutes(db, minutes):
    try:
        minutes = max(0, int(minutes))
    except (TypeError, ValueError):
        minutes = DEFAULT_AUTO_LOCK_MINUTES
    db.set_setting(KEY_AUTO_LOCK_MINUTES, str(minutes))


def get_daily_capacity(db):
    try:
        return int(db.get_setting(KEY_DAILY_CAPACITY, DEFAULT_DAILY_CAPACITY))
    except (TypeError, ValueError):
        return DEFAULT_DAILY_CAPACITY


def set_daily_capacity(db, capacity):
    try:
        capacity = max(0, int(capacity))
    except (TypeError, ValueError):
        capacity = DEFAULT_DAILY_CAPACITY
    db.set_setting(KEY_DAILY_CAPACITY, str(capacity))


def get_logo_path(db, base_dir):
    filename = db.get_setting(KEY_LOGO_FILENAME)
    if not filename:
        return None
    full_path = os.path.join(base_dir, filename)
    return full_path if os.path.exists(full_path) else None


def get_logo_data_url(db, base_dir):
    """لوگو را به‌صورت base64 data-url برمی‌گرداند تا مستقیم در <img src> مرورگر قابل استفاده باشد"""
    path = get_logo_path(db, base_dir)
    if not path:
        return None
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    mime = {"jpg": "jpeg"}.get(ext, ext)
    try:
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")
        return f"data:image/{mime};base64,{encoded}"
    except OSError:
        return None


def save_logo(db, source_path, base_dir):
    ext = os.path.splitext(source_path)[1].lower()
    if ext not in (".png", ".gif", ".jpg", ".jpeg", ".bmp", ".svg"):
        raise ValueError("فرمت فایل پشتیبانی نمی‌شود. لطفاً از PNG، JPG، BMP، SVG یا GIF استفاده کنید.")

    dest_filename = f"clinic_logo{ext}"
    dest_path = os.path.join(base_dir, dest_filename)
    shutil.copyfile(source_path, dest_path)
    db.set_setting(KEY_LOGO_FILENAME, dest_filename)
    return dest_path


def remove_logo(db, base_dir):
    filename = db.get_setting(KEY_LOGO_FILENAME)
    if filename:
        full_path = os.path.join(base_dir, filename)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError:
                pass
    db.set_setting(KEY_LOGO_FILENAME, "")
