# -*- coding: utf-8 -*-
"""
مدیریت لایسنس آفلاین برنامه با رمزنگاری نامتقارن (Ed25519):
- دوره آزمایشی رایگان یک‌ماهه که در اولین اجرا خودکار فعال می‌شود
- لایسنس یک‌ساله که با یک «کد لایسنس» (بدون نیاز به اینترنت) فعال می‌شود

نکته امنیتی مهم: برخلاف روش‌های مبتنی بر کلید مخفی مشترک (HMAC)، این روش
از یک جفت کلید نامتقارن استفاده می‌کند:
  - کلید خصوصی (private key): فقط پیش سازنده/فروشنده نرم‌افزار می‌ماند و
    هرگز داخل کد یا exe قرار نمی‌گیرد. فقط همین کلید می‌تواند کد لایسنس
    معتبر تولید کند.
  - کلید عمومی (public key): همین‌جا در این فایل قرار دارد و داخل برنامه/exe
    توزیع می‌شود. فقط می‌تواند اعتبار یک کد را بررسی کند، نمی‌تواند کد جدید
    بسازد.
این یعنی حتی اگر کل کد سورس این برنامه (شامل همین فایل) در اختیار یک
توسعه‌دهنده یا شریک قرار بگیرد، او نمی‌تواند لایسنس معتبر جدید بسازد،
چون کلید خصوصی را ندارد و از روی کلید عمومی هم قابل استخراج نیست.
"""

import base64
from datetime import date, datetime, timedelta

from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

TRIAL_DAYS = 30
FULL_LICENSE_DAYS = 365

LICENSE_TYPE_TRIAL = "trial"
LICENSE_TYPE_FULL = "full"

DATE_FMT = "%Y-%m-%d"

# کلید عمومی — توزیع این کلید در کد/exe کاملاً بی‌خطر است، فقط برای
# اعتبارسنجی استفاده می‌شود و نمی‌تواند برای ساخت لایسنس به کار رود.
PUBLIC_KEY_PEM = b"""-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAh7ZhiZSx0pfIR8F5gEwn0Bi4cszXsw0/kNLuwV5pikc=
-----END PUBLIC KEY-----
"""

_public_key = serialization.load_pem_public_key(PUBLIC_KEY_PEM)


def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def generate_key(expiry_date: date, private_key_pem: bytes) -> str:
    """
    یک کد لایسنس معتبر برای تاریخ انقضای داده‌شده تولید می‌کند.
    فقط در صورت داشتن کلید خصوصی (private_key_pem) قابل استفاده است —
    یعنی فقط اسکریپت خصوصی generate_license_key.py می‌تواند این تابع را
    با موفقیت صدا بزند.
    """
    private_key = serialization.load_pem_private_key(private_key_pem, password=None)
    date_str = expiry_date.strftime(DATE_FMT)
    signature = private_key.sign(date_str.encode("utf-8"))
    date_compact = expiry_date.strftime("%Y%m%d")
    return f"PHYSIO-{date_compact}-{_b64_encode(signature)}"


def validate_key(key: str):
    """
    اگر کد معتبر باشد (واقعاً با کلید خصوصی امضا شده باشد)، تاریخ انقضای
    رمزگشایی‌شده (date) را برمی‌گرداند؛ در غیر این صورت None.
    """
    try:
        key = key.strip()
        parts = key.split("-")
        if len(parts) != 3 or parts[0].upper() != "PHYSIO":
            return None
        date_compact, sig_b64 = parts[1], parts[2]
        expiry = datetime.strptime(date_compact, "%Y%m%d").date()
        date_str = expiry.strftime(DATE_FMT)
        signature = _b64_decode(sig_b64)
        _public_key.verify(signature, date_str.encode("utf-8"))
        return expiry
    except (ValueError, IndexError, InvalidSignature, Exception):
        return None


def ensure_trial_license(db):
    """در اولین اجرای برنامه، یک دوره آزمایشی ۳۰ روزه ایجاد می‌کند"""
    if db.get_license() is None:
        today = date.today()
        expiry = today + timedelta(days=TRIAL_DAYS)
        db.create_license(
            license_type=LICENSE_TYPE_TRIAL,
            issued_date=today.strftime(DATE_FMT),
            expiry_date=expiry.strftime(DATE_FMT),
        )
        return True
    return False


def get_license_status(db):
    """
    اطلاعات وضعیت لایسنس را برمی‌گرداند:
    {type, issued_date, expiry_date (date object), days_left, is_expired}
    """
    row = db.get_license()
    if row is None:
        ensure_trial_license(db)
        row = db.get_license()

    expiry = datetime.strptime(row["expiry_date"], DATE_FMT).date()
    today = date.today()
    days_left = (expiry - today).days
    return {
        "type": row["license_type"],
        "issued_date": row["issued_date"],
        "expiry_date": expiry,
        "days_left": days_left,
        "is_expired": days_left < 0,
    }


def activate_license(db, key: str):
    """
    کد لایسنس را اعتبارسنجی و در صورت معتبر بودن، لایسنس یک‌ساله را فعال می‌کند.
    خروجی: (موفقیت: bool, پیام: str)
    """
    expiry = validate_key(key)
    if expiry is None:
        return False, "کد لایسنس نامعتبر است. لطفاً کد را دوباره بررسی کنید."

    db.update_license(
        license_type=LICENSE_TYPE_FULL,
        expiry_date=expiry.strftime(DATE_FMT),
        license_key=key.strip(),
    )
    return True, f"لایسنس با موفقیت تا تاریخ {expiry.strftime(DATE_FMT)} فعال شد."
