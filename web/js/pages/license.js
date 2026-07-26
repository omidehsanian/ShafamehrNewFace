// ============================================================
// صفحه لایسنس (فقط مدیر)
// ============================================================

const LicensePage = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.shield}</span>وضعیت فعلی لایسنس</div>
        <div id="lic_status" style="font-size:15px; font-weight:700;"></div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.key}</span>فعال‌سازی / تمدید لایسنس</div>
        <div class="form-row cols-2" style="align-items:end;">
          <div class="field"><label>کد لایسنس</label><textarea id="lic_key" class="license-key-input" placeholder="PHYSIO-XXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"></textarea></div>
          <button class="btn btn-success" id="lic_activateBtn">${icon('check')}فعال‌سازی</button>
        </div>
        <p class="text-sm text-muted">نکته: کد لایسنس یک‌ساله را از سازنده/فروشنده نرم‌افزار دریافت کنید.</p>
      </div>
    `;

    document.getElementById('lic_activateBtn').addEventListener('click', () => this.activate());
    await this.refreshStatus();
  },

  async refreshStatus() {
    const res = await Bridge.call('get_license_status');
    if (!res.ok) return;
    const s = res.data;
    const typeFa = s.type === 'trial' ? 'دوره آزمایشی رایگان' : 'لایسنس فعال';
    const el = document.getElementById('lic_status');
    let text, color;
    if (s.is_expired) {
      text = `منقضی شده — ${typeFa} (تاریخ انقضا: ${s.expiry_date_jalali})`; color = 'var(--danger-500)';
    } else if (s.days_left <= 7) {
      text = `رو به اتمام — ${typeFa} — ${toPersianDigits(s.days_left)} روز تا انقضا باقی مانده`; color = 'var(--warning-500)';
    } else {
      text = `فعال — ${typeFa} — ${toPersianDigits(s.days_left)} روز باقی مانده (انقضا: ${s.expiry_date_jalali})`; color = 'var(--success-500)';
    }
    el.textContent = text;
    el.style.color = color;
  },

  async activate() {
    const key = document.getElementById('lic_key').value.trim();
    if (!key) return toast('لطفاً کد لایسنس را وارد کنید.', 'error');
    const res = await Bridge.call('activate_license', key);
    if (!res.ok) return toast(res.error, 'error');
    toast(res.data.message);
    document.getElementById('lic_key').value = '';
    await this.refreshStatus();
  },
};
