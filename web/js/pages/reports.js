// ============================================================
// صفحه گزارش‌ها، خروجی اکسل و پشتیبان‌گیری (فقط مدیر)
// ============================================================

const ReportsPage = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.reports}</span>خروجی اکسل</div>
        <p class="text-sm text-muted mb-16">فایل اکسل شامل تمام اطلاعات بیماران (فردی، بیمه، پزشکی و تماس اضطراری) ساخته می‌شود.</p>
        <div class="flex-gap-8">
          <button class="btn btn-success" id="r_exportPatients">${icon('download')}خروجی اکسل لیست بیماران</button>
          <button class="btn btn-primary" id="r_exportAppointments">${icon('download')}خروجی اکسل لیست نوبت‌ها</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.patients}</span>خروجی اکسل پرونده کامل یک بیمار</div>
        <div class="form-row cols-2" style="align-items:end;">
          <div class="field"><label>انتخاب بیمار</label><select id="r_patient"></select></div>
          <button class="btn btn-success" id="r_exportProfile">${icon('download')}خروجی اکسل پرونده کامل</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.upload}</span>بارگذاری دسته‌ای بیماران از اکسل</div>
        <p class="text-sm text-muted mb-16">ابتدا قالب اکسل را دانلود کنید، آن را با اطلاعات بیماران پر کنید، سپس بارگذاری کنید.</p>
        <div class="flex-gap-8">
          <button class="btn btn-ghost" id="r_downloadTemplate">${icon('download')}دانلود قالب اکسل بیماران</button>
          <button class="btn btn-success" id="r_uploadPatients">${icon('upload')}بارگذاری بیماران از اکسل</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.shield}</span>پشتیبان‌گیری</div>
        <p class="text-sm text-muted mb-16">یک نسخه کامل از فایل دیتابیس (تمام بیماران، نوبت‌ها، تمرینات و پیشرفت‌ها) کپی می‌شود.</p>
        <button class="btn btn-warning" id="r_backup">${icon('shield')}تهیه نسخه پشتیبان</button>
      </div>
    `;

    await this._loadPatients();
    this._bind();
  },

  async _loadPatients() {
    const res = await Bridge.call('patient_options');
    if (!res.ok) return;
    document.getElementById('r_patient').innerHTML = '<option value=""></option>' +
      res.data.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  },

  _bind() {
    document.getElementById('r_exportPatients').addEventListener('click', async () => {
      const res = await Bridge.call('export_patients_excel');
      this._handleExportResult(res);
    });
    document.getElementById('r_exportAppointments').addEventListener('click', async () => {
      const res = await Bridge.call('export_appointments_excel');
      this._handleExportResult(res);
    });
    document.getElementById('r_exportProfile').addEventListener('click', async () => {
      const pid = document.getElementById('r_patient').value;
      if (!pid) return toast('لطفاً یک بیمار انتخاب کنید.', 'error');
      const res = await Bridge.call('export_patient_profile_excel', parseInt(pid, 10));
      this._handleExportResult(res);
    });
    document.getElementById('r_downloadTemplate').addEventListener('click', async () => {
      const res = await Bridge.call('download_patient_import_template');
      this._handleExportResult(res, 'قالب ذخیره شد. آن را با اطلاعات بیماران پر کرده و بارگذاری کنید.');
    });
    document.getElementById('r_uploadPatients').addEventListener('click', async () => {
      const res = await Bridge.call('upload_patients_excel');
      if (!res.ok) return toast(res.error, 'error');
      if (!res.data) return;
      let msg = `${res.data.count} بیمار با موفقیت اضافه شد.`;
      if (res.data.errors && res.data.errors.length) {
        msg += ` (${res.data.errors.length} ردیف با خطا رد شد)`;
      }
      toast(msg, res.data.count > 0 ? 'success' : 'warning');
      App.onPatientsChanged();
    });
    document.getElementById('r_backup').addEventListener('click', async () => {
      const res = await Bridge.call('backup_database');
      this._handleExportResult(res, 'نسخه پشتیبان با موفقیت ذخیره شد.');
    });
  },

  _handleExportResult(res, successMsg = 'فایل با موفقیت ذخیره شد.') {
    if (!res.ok) return toast(res.error, 'error');
    if (res.data) toast(successMsg);
  },
};
