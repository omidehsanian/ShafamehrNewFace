# -*- coding: utf-8 -*-
"""
مدیریت احراز هویت کاربران: هش کردن رمز عبور، ورود، و ساخت ادمین پیش‌فرض
"""

import hashlib
import os
import binascii

ROLE_ADMIN = "admin"
ROLE_USER = "user"

ROLE_LABELS = {
    ROLE_ADMIN: "مدیر (دسترسی کامل)",
    ROLE_USER: "کاربر عادی",
}

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"


def hash_password(password, salt=None):
    """رمز عبور را با نمک تصادفی و PBKDF2-SHA256 هش می‌کند"""
    if salt is None:
        salt = os.urandom(16)
    elif isinstance(salt, str):
        salt = binascii.unhexlify(salt)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{binascii.hexlify(salt).decode()}${binascii.hexlify(dk).decode()}"


def verify_password(password, stored_hash):
    try:
        salt_hex, _ = stored_hash.split("$")
    except (ValueError, AttributeError):
        return False
    candidate = hash_password(password, salt=salt_hex)
    return candidate == stored_hash


def ensure_default_admin(db):
    """
    اگر هیچ کاربری در دیتابیس وجود نداشته باشد (اولین اجرای برنامه)،
    یک حساب مدیر پیش‌فرض می‌سازد تا کاربر بتواند وارد شود.
    """
    if db.count_users() == 0:
        db.add_user(
            first_name="مدیر", last_name="سیستم",
            username=DEFAULT_ADMIN_USERNAME,
            password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
            role=ROLE_ADMIN,
        )
        return True
    return False


def login(db, username, password):
    """در صورت موفقیت، ردیف کاربر را برمی‌گرداند؛ در غیر این صورت None"""
    user = db.get_user_by_username(username.strip())
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return user


def create_user(db, first_name, last_name, username, password, role):
    if db.username_exists(username):
        raise ValueError("این نام کاربری قبلاً استفاده شده است.")
    return db.add_user(first_name, last_name, username, hash_password(password), role)
