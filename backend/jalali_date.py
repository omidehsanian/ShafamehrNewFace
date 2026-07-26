# -*- coding: utf-8 -*-
"""
تبدیل تاریخ میلادی <-> شمسی (جلالی) بدون نیاز به هیچ کتابخانه جانبی.
نسخه سمت پایتون (بک‌اند). معادل جاوااسکریپتی همین الگوریتم در
web/js/jalali.js برای تقویم سمت مرورگر وجود دارد.
"""

import datetime

_EN_DIGITS = "0123456789"
_FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
_EN_TO_FA = str.maketrans(_EN_DIGITS, _FA_DIGITS)
_FA_TO_EN = str.maketrans(_FA_DIGITS, _EN_DIGITS)

_J_DAYS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]


def to_persian_digits(text):
    return str(text).translate(_EN_TO_FA)


def to_english_digits(text):
    return str(text).translate(_FA_TO_EN)


def _is_gregorian_leap(gy):
    return (gy % 4 == 0 and gy % 100 != 0) or (gy % 400 == 0)


def gregorian_to_jalali(gy, gm, gd):
    g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

    gy2 = gy - 1600
    gm2 = gm - 1
    gd2 = gd - 1

    g_day_no = 365 * gy2 + (gy2 + 3) // 4 - (gy2 + 99) // 100 + (gy2 + 399) // 400
    for i in range(gm2):
        g_day_no += g_days_in_month[i]
    if gm2 > 1 and _is_gregorian_leap(gy):
        g_day_no += 1
    g_day_no += gd2

    j_day_no = g_day_no - 79

    j_np = j_day_no // 12053
    j_day_no %= 12053

    jy = 979 + 33 * j_np + 4 * (j_day_no // 1461)
    j_day_no %= 1461

    if j_day_no >= 366:
        jy += (j_day_no - 1) // 365
        j_day_no = (j_day_no - 1) % 365

    jm = 12
    for i in range(11):
        if j_day_no < _J_DAYS[i]:
            jm = i + 1
            break
        j_day_no -= _J_DAYS[i]
    jd = j_day_no + 1

    return jy, jm, jd


def jalali_to_gregorian(jy, jm, jd):
    jy2 = jy - 979
    jm2 = jm - 1
    jd2 = jd - 1

    j_day_no = 365 * jy2 + (jy2 // 33) * 8 + ((jy2 % 33) + 3) // 4
    for i in range(jm2):
        j_day_no += _J_DAYS[i]
    j_day_no += jd2

    g_day_no = j_day_no + 79

    gy = 1600 + 400 * (g_day_no // 146097)
    g_day_no %= 146097

    leap = True
    if g_day_no >= 36525:
        g_day_no -= 1
        gy += 100 * (g_day_no // 36524)
        g_day_no %= 36524
        if g_day_no >= 365:
            g_day_no += 1
        else:
            leap = False

    gy += 4 * (g_day_no // 1461)
    g_day_no %= 1461

    if g_day_no >= 366:
        leap = False
        g_day_no -= 1
        gy += g_day_no // 365
        g_day_no %= 365

    g_days_in_month = [31, 29 if ((gy % 4 == 0 and gy % 100 != 0) or gy % 400 == 0) else 28,
                        31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    gm = 0
    while gm < 12 and g_day_no >= g_days_in_month[gm]:
        g_day_no -= g_days_in_month[gm]
        gm += 1
    gm += 1
    gd = g_day_no + 1

    return gy, gm, gd


def jalali_days_in_month(jy, jm):
    if jm <= 6:
        return 31
    if jm <= 11:
        return 30
    gy1, gm1, gd1 = jalali_to_gregorian(jy, 1, 1)
    gy2, gm2, gd2 = jalali_to_gregorian(jy + 1, 1, 1)
    d1 = datetime.date(gy1, gm1, gd1)
    d2 = datetime.date(gy2, gm2, gd2)
    return (d2 - d1).days - 31 * 6 - 30 * 5


def today_jalali():
    today = datetime.date.today()
    return gregorian_to_jalali(today.year, today.month, today.day)


def format_jalali(jy, jm, jd, persian=True):
    text = f"{jy:04d}/{jm:02d}/{jd:02d}"
    return to_persian_digits(text) if persian else text


def today_jalali_str():
    jy, jm, jd = today_jalali()
    return format_jalali(jy, jm, jd)


def parse_jalali(text):
    """رشته تاریخ شمسی (با اعداد فارسی یا انگلیسی) را به (سال، ماه، روز) تبدیل می‌کند"""
    try:
        normalized = to_english_digits(text).strip().replace("-", "/")
        parts = normalized.split("/")
        if len(parts) != 3:
            return None
        jy, jm, jd = int(parts[0]), int(parts[1]), int(parts[2])
        if not (1 <= jm <= 12 and 1 <= jd <= 31):
            return None
        return jy, jm, jd
    except (ValueError, AttributeError):
        return None
