// ============================================================
// لایه ارتباط با پایتون (pywebview). یک wrapper ساده که:
// ۱) صبر می‌کند pywebview آماده شود
// ۲) خطاهای شبکه/پایتون را یکدست مدیریت می‌کند
// ۳) در حالت پیش‌نمایش مرورگر (بدون pywebview) خطای واضح می‌دهد
// ============================================================

const Bridge = {
  _ready: null,

  ready() {
    if (this._ready) return this._ready;
    this._ready = new Promise((resolve) => {
      if (window.pywebview && window.pywebview.api) return resolve();
      window.addEventListener('pywebviewready', () => resolve());
      // اگر بعد از مدتی pywebview لود نشد (مثلاً پیش‌نمایش مرورگر ساده)، ادامه بده
      setTimeout(resolve, 3000);
    });
    return this._ready;
  },

  async call(method, ...args) {
    await this.ready();
    if (!window.pywebview || !window.pywebview.api || !window.pywebview.api[method]) {
      console.error(`Bridge: متد "${method}" در دسترس نیست (احتمالاً خارج از pywebview اجرا شده).`);
      return { ok: false, error: 'اتصال به برنامه اصلی برقرار نیست.' };
    }
    try {
      return await window.pywebview.api[method](...args);
    } catch (e) {
      console.error('Bridge error:', method, e);
      return { ok: false, error: 'خطای غیرمنتظره در ارتباط با برنامه.' };
    }
  },
};
