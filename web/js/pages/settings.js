// ============================================================
// صفحه تنظیمات (فقط مدیر): نام برنامه، لوگو، ظرفیت روزانه، قفل خودکار
// ============================================================

const SettingsPage = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.building}</span>نام برنامه</div>
        <div class="form-row cols-2" style="align-items:end;">
          <div class="field"><label>نام برنامه (نوار عنوان و صفحه ورود)</label><input type="text" id="s_appName"></div>
          <button class="btn btn-primary" id="s_saveNameBtn">${icon('save')}ذخیره نام</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.image}</span>لوگوی مرکز</div>
        <div class="flex-gap-12" style="align-items:center;">
          <div id="s_logoPreview" style="width:64px;height:64px;border-radius:var(--radius-md);background:var(--gray-100);display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <span class="icon">${ICONS.image}</span>
          </div>
          <div class="flex-gap-8">
            <button class="btn btn-success btn-sm" id="s_chooseLogoBtn">${icon('upload')}انتخاب لوگو...</button>
            <button class="btn btn-danger btn-sm" id="s_removeLogoBtn">${icon('trash')}حذف لوگو</button>
          </div>
        </div>
        <p class="text-sm text-muted mt-8">فرمت‌های مجاز: PNG، JPG، BMP، GIF</p>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.calendar}</span>ظرفیت روزانه نوبت‌دهی</div>
        <div class="form-row cols-2" style="align-items:end;">
          <div class="field"><label>حداکثر تعداد نوبت مجاز در هر روز (۰ = بدون محدودیت)</label><input type="text" id="s_capacity"></div>
          <button class="btn btn-primary" id="s_saveCapacityBtn">${icon('save')}ذخیره</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.lock}</span>قفل خودکار صفحه پس از عدم فعالیت</div>
        <div class="form-row cols-2" style="align-items:end;">
          <div class="field"><label>مدت زمان (دقیقه) — عدد ۰ یعنی غیرفعال</label><input type="text" id="s_lockMinutes"></div>
          <button class="btn btn-primary" id="s_saveLockBtn">${icon('save')}ذخیره</button>
        </div>
      </div>
    `;

    this._bind();
    await this.refresh();
  },

  _bind() {
    document.getElementById('s_saveNameBtn').addEventListener('click', () => this.saveAppName());
    document.getElementById('s_saveCapacityBtn').addEventListener('click', () => this.saveCapacity());
    document.getElementById('s_saveLockBtn').addEventListener('click', () => this.saveLockMinutes());
    document.getElementById('s_chooseLogoBtn').addEventListener('click', () => this.chooseLogo());
    document.getElementById('s_removeLogoBtn').addEventListener('click', () => this.removeLogo());
  },

  async refresh() {
    const res = await Bridge.call('get_settings');
    if (!res.ok) return;
    document.getElementById('s_appName').value = res.data.app_name;
    document.getElementById('s_capacity').value = res.data.daily_capacity;
    document.getElementById('s_lockMinutes').value = res.data.auto_lock_minutes;
    this._renderLogoPreview(res.data.logo_data_url);
  },

  _renderLogoPreview(dataUrl) {
    const box = document.getElementById('s_logoPreview');
    box.innerHTML = dataUrl
      ? `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;">`
      : `<span class="icon">${ICONS.image}</span>`;
  },

  async saveAppName() {
    const name = document.getElementById('s_appName').value.trim();
    if (!name) return toast('نام برنامه نمی‌تواند خالی باشد.', 'error');
    const res = await Bridge.call('save_app_name', name);
    if (!res.ok) return toast(res.error, 'error');
    toast('نام برنامه ذخیره شد.');
    const identity = await Bridge.call('app_identity');
    if (identity.ok) App._applyIdentity(identity.data);
  },

  async saveCapacity() {
    const val = parseInt(document.getElementById('s_capacity').value, 10);
    if (isNaN(val)) return toast('لطفاً یک عدد معتبر وارد کنید.', 'error');
    const res = await Bridge.call('save_daily_capacity', val);
    if (!res.ok) return toast(res.error, 'error');
    toast('ظرفیت روزانه نوبت‌دهی ذخیره شد.');
  },

  async saveLockMinutes() {
    const val = parseInt(document.getElementById('s_lockMinutes').value, 10);
    if (isNaN(val)) return toast('لطفاً یک عدد معتبر وارد کنید.', 'error');
    const res = await Bridge.call('save_auto_lock_minutes', val);
    if (!res.ok) return toast(res.error, 'error');
    toast('مدت قفل خودکار ذخیره شد.');
    App.idleMinutes = val;
  },

  async chooseLogo() {
    const res = await Bridge.call('pick_and_save_logo');
    if (!res.ok) return toast(res.error, 'error');
    if (!res.data) return;
    this._renderLogoPreview(res.data);
    toast('لوگو با موفقیت ذخیره شد.');
    const identity = await Bridge.call('app_identity');
    if (identity.ok) App._applyIdentity(identity.data);
  },

  async removeLogo() {
    const yes = await confirmDialog('حذف لوگو', 'لوگوی فعلی حذف شود؟');
    if (!yes) return;
    const res = await Bridge.call('remove_logo');
    if (!res.ok) return toast(res.error, 'error');
    this._renderLogoPreview(null);
    const identity = await Bridge.call('app_identity');
    if (identity.ok) App._applyIdentity(identity.data);
  },
};
