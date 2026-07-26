// ============================================================
// صفحه نوبت‌دهی
// ============================================================

const AppointmentsPage = {
  selectedId: null,
  patientMap: {},

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.calendar}</span>ثبت نوبت جدید</div>
        <div class="form-row cols-4">
          <div class="field">
            <label>بیمار *</label>
            <select id="a_patient"></select>
          </div>
          <div class="field">
            <label>تاریخ (شمسی)</label>
            <input type="text" id="a_date" data-jalali>
          </div>
          <div class="field">
            <label>ساعت</label>
            <input type="text" id="a_time" placeholder="مثال: 14:30">
          </div>
          <div class="field">
            <label>وضعیت</label>
            <select id="a_status">
              <option>برنامه‌ریزی شده</option><option>انجام شده</option>
              <option>لغو شده</option><option>عدم حضور بیمار</option>
            </select>
          </div>
        </div>
        <div class="field mb-8">
          <label>یادداشت</label>
          <input type="text" id="a_notes">
        </div>
        <div class="text-sm text-muted mb-16" id="a_capacity"></div>
        <div class="flex-gap-8" style="justify-content:flex-end;">
          <button class="btn btn-danger" id="a_deleteBtn">${icon('trash')}حذف نوبت</button>
          <button class="btn btn-primary" id="a_statusBtn">${icon('refresh')}تغییر وضعیت انتخاب‌شده</button>
          <button class="btn btn-success" id="a_addBtn">${icon('plus')}ثبت نوبت</button>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead><tr><th>نام بیمار</th><th>تاریخ</th><th>ساعت</th><th>وضعیت</th><th>یادداشت</th></tr></thead>
            <tbody id="a_tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    initAllJalaliPickers(container);
    document.getElementById('a_date').value = todayJalaliStr();

    await this.refreshPatientOptions();
    this._bind(container);
    document.getElementById('a_date').addEventListener('change', () => this.updateCapacity());
    this.updateCapacity();
    await this.refreshList();
  },

  _bind(container) {
    document.getElementById('a_addBtn').addEventListener('click', () => this.add());
    document.getElementById('a_statusBtn').addEventListener('click', () => this.changeStatus());
    document.getElementById('a_deleteBtn').addEventListener('click', () => this.remove());
  },

  async refreshPatientOptions() {
    const res = await Bridge.call('patient_options');
    if (!res.ok) return;
    this.patientMap = {};
    const sel = document.getElementById('a_patient');
    if (!sel) return;
    sel.innerHTML = '<option value=""></option>' + res.data.map(p => {
      this.patientMap[p.id] = p.name;
      return `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    }).join('');
  },

  async updateCapacity() {
    const date = document.getElementById('a_date').value;
    const capEl = document.getElementById('a_capacity');
    if (!date) { capEl.textContent = ''; return; }
    const res = await Bridge.call('get_day_capacity_info', date);
    if (!res.ok) return;
    const { capacity, used, remaining } = res.data;
    if (!capacity) { capEl.textContent = 'ظرفیت روزانه محدود نشده است.'; return; }
    capEl.textContent = remaining <= 0
      ? `ظرفیت این روز تکمیل شده است (${toPersianDigits(used)} از ${toPersianDigits(capacity)}).`
      : `ظرفیت باقی‌مانده این روز: ${toPersianDigits(remaining)} از ${toPersianDigits(capacity)}`;
    capEl.style.color = remaining <= 0 ? 'var(--danger-500)' : 'var(--text-secondary)';
  },

  async add() {
    const patientId = document.getElementById('a_patient').value;
    const date = document.getElementById('a_date').value;
    const time = document.getElementById('a_time').value.trim();
    const status = document.getElementById('a_status').value;
    const notes = document.getElementById('a_notes').value.trim();

    if (!patientId) return toast('لطفاً یک بیمار انتخاب کنید.', 'error');
    if (!date || !time) return toast('لطفاً تاریخ و ساعت را وارد کنید.', 'error');

    const res = await Bridge.call('add_appointment', parseInt(patientId, 10), date, time, status, notes);
    if (!res.ok) return toast(res.error, 'error');

    if (res.data.capacity_warning) {
      toast('توجه: ظرفیت این روز پیش از این تکمیل شده بود؛ نوبت با هشدار ثبت شد.', 'warning');
    } else {
      toast('نوبت با موفقیت ثبت شد.');
    }
    document.getElementById('a_time').value = '';
    document.getElementById('a_notes').value = '';
    await this.refreshList();
    this.updateCapacity();
  },

  async changeStatus() {
    if (!this.selectedId) return toast('ابتدا یک نوبت را از لیست انتخاب کنید.', 'error');
    const status = document.getElementById('a_status').value;
    const res = await Bridge.call('update_appointment_status', this.selectedId, status);
    if (!res.ok) return toast(res.error, 'error');
    toast('وضعیت نوبت به‌روزرسانی شد.');
    await this.refreshList();
    this.updateCapacity();
  },

  async remove() {
    if (!this.selectedId) return toast('ابتدا یک نوبت را از لیست انتخاب کنید.', 'error');
    const yes = await confirmDialog('حذف نوبت', 'آیا از حذف این نوبت مطمئن هستید؟');
    if (!yes) return;
    const res = await Bridge.call('delete_appointment', this.selectedId);
    if (!res.ok) return toast(res.error, 'error');
    toast('نوبت حذف شد.');
    this.selectedId = null;
    await this.refreshList();
    this.updateCapacity();
  },

  async refreshList() {
    const res = await Bridge.call('list_appointments');
    if (!res.ok) return toast(res.error, 'error');
    const tbody = document.getElementById('a_tbody');
    if (!tbody) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="icon">${ICONS.calendar}</span><div>هنوز نوبتی ثبت نشده است.</div></div></td></tr>`;
      return;
    }

    const badgeClass = {
      'برنامه‌ریزی شده': 'badge-scheduled', 'انجام شده': 'badge-done',
      'لغو شده': 'badge-cancelled', 'عدم حضور بیمار': 'badge-noshow',
    };

    tbody.innerHTML = res.data.map(a => `
      <tr data-id="${a.id}" class="${a.id === this.selectedId ? 'selected' : ''}">
        <td class="text-cell">${escapeHtml(a.full_name)}</td>
        <td>${escapeHtml(a.appointment_date)}</td>
        <td>${escapeHtml(a.appointment_time)}</td>
        <td><span class="badge ${badgeClass[a.status] || 'badge-scheduled'}">${escapeHtml(a.status)}</span></td>
        <td class="text-cell">${escapeHtml(a.notes)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        this.selectedId = parseInt(tr.dataset.id, 10);
        this.refreshList();
      });
    });
  },
};
