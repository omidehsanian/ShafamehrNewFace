"""
نسخه وب‌محور برنامه فیزیوتراپی — نسخه دسکتاپ با رابط کاربری مدرن (HTML/CSS/JS)
که با pywebview در یک پنجره بومی ویندوز نمایش داده می‌شود.

اجرا:
    python main_web.py
"""

import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, BACKEND_DIR)

import webview
from api import Api


def get_resource_dir():
    """
    مسیر فایل‌های وب (HTML/CSS/JS) را برمی‌گرداند.
    در حالت exe (--onefile)، این فایل‌ها داخل پوشه موقت استخراج pyinstaller
    قرار دارند (sys._MEIPASS)، نه کنار خود exe.
    """
    if getattr(sys, "frozen", False):
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


def main():
    resource_dir = get_resource_dir()
    index_path = os.path.join(resource_dir, "web", "index.html")

    api = Api()

    webview.create_window(
        "سامانه مدیریت کلینیک فیزیوتراپی",
        url=index_path,
        js_api=api,
        width=1280,
        height=820,
        min_size=(1000, 650),
    )

    webview.start(debug=False)


if __name__ == "__main__":
    main()
