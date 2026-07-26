// ============================================================
// صفحه کتابخانه تمرینات
// ============================================================

const ExercisesPage = {
  selectedId: null,
  patientMap: {},

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.dumbbell}</span>افزودن تمرین به کتابخانه</div>
        <div class="form-row cols-5">
          <div class="field"><label>نام تمرین *</label><input type="text" id="e_name"></div>
          <div class="field"><label>دسته‌بندی</label><input type="text" id="e_category" placeholder="مثلاً زانو، کمر"></div>
          <div class="field"><label>ست</label><input type="text" id="e_sets"></div>
          <div class="field"><label>تکرار</label><input type="text" id="e_reps"></div>
          <div class="field"><label>زمان (ثانیه)</label><input type="text" id="e_duration"></div>
        </div>
        <div class="field mb-16">
          <label>توضیحات</label>
          <textarea id="e_description" rows="2"></textarea>
        </div>
        <div class="flex-gap-8" style="justify-content:flex-end;">
          <button class="btn btn-danger" id="e_deleteBtn">${icon('trash')}حذف تمرین انتخاب‌شده</button>
          <button class="btn btn-success" id="e_addBtn">${icon('plus')}افزودن تمرین</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.patients}</span>تخصیص تمرین انتخاب‌شده به بیمار</div>
        <div class="form-row cols-2" style="align-items:end;">
          <div class="field"><label>بیمار</label><select id="e_patient"></select></div>
          <button class="btn btn-primary" id="e_assignBtn">${icon('check')}تخصیص تمرین به بیمار</button>
        </div>
        <div class="text-sm text-muted">ابتدا یک تمرین از لیست پایین انتخاب کنید، سپس بیمار را مشخص و تخصیص دهید.</div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead><tr><th>نام تمرین</th><th>دسته</th><th>ست</th><th>تکرار</th><th>زمان (ثانیه)</th></tr></thead>
            <tbody id="e_tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    await this.refreshPatientOptions();
    this._bind();
    await this.refreshList();
  },

  _bind() {
    document.getElementById('e_addBtn').addEventListener('click', () => this.add());
    document.getElementById('e_deleteBtn').addEventListener('click', () => this.remove());
    document.getElementById('e_assignBtn').addEventListener('click', () => this.assign());
  },

  async refreshPatientOptions() {
    const res = await Bridge.call('patient_options');
    if (!res.ok) return;
    const sel = document.getElementById('e_patient');
    if (!sel) return;
    sel.innerHTML = '<option value=""></option>' + res.data.map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  },

  async add() {
    const name = document.getElementById('e_name').value.trim();
    const category = document.getElementById('e_category').value.trim();
    const description = document.getElementById('e_description').value.trim();
    const sets = document.getElementById('e_sets').value.trim();
    const reps = document.getElementById('e_reps').value.trim();
    const duration = document.getElementById('e_duration').value.trim();

    if (!name) return toast('لطفاً نام تمرین را وارد کنید.', 'error');
    if ([sets, reps, duration].some(v => v && isNaN(parseInt(v, 10)))) {
      return toast('ست، تکرار و زمان باید عدد باشند.', 'error');
    }

    const res = await Bridge.call('add_exercise', name, category, description,
      sets ? parseInt(sets, 10) : null, reps ? parseInt(reps, 10) : null, duration ? parseInt(duration, 10) : null);
    if (!res.ok) return toast(res.error, 'error');

    toast('تمرین جدید به کتابخانه اضافه شد.');
    ['e_name','e_category','e_description','e_sets','e_reps','e_duration'].forEach(id => {
      document.getElementById(id).value = '';
    });
    await this.refreshList();
  },

  async remove() {
    if (!this.selectedId) return toast('ابتدا یک تمرین را از لیست انتخاب کنید.', 'error');
    const yes = await confirmDialog('حذف تمرین', 'آیا از حذف این تمرین مطمئن هستید؟');
    if (!yes) return;
    const res = await Bridge.call('delete_exercise', this.selectedId);
    if (!res.ok) return toast(res.error, 'error');
    toast('تمرین حذف شد.');
    this.selectedId = null;
    await this.refreshList();
  },

  async assign() {
    if (!this.selectedId) return toast('ابتدا یک تمرین را از لیست انتخاب کنید.', 'error');
    const patientId = document.getElementById('e_patient').value;
    if (!patientId) return toast('لطفاً یک بیمار انتخاب کنید.', 'error');
    const res = await Bridge.call('assign_exercise_to_patient', parseInt(patientId, 10), this.selectedId);
    if (!res.ok) return toast(res.error, 'error');
    toast('تمرین با موفقیت به بیمار تخصیص یافت.');
  },

  async refreshList() {
    const res = await Bridge.call('list_exercises');
    if (!res.ok) return toast(res.error, 'error');
    const tbody = document.getElementById('e_tbody');
    if (!tbody) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="icon">${ICONS.dumbbell}</span><div>هنوز تمرینی ثبت نشده است.</div></div></td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(ex => `
      <tr data-id="${ex.id}" class="${ex.id === this.selectedId ? 'selected' : ''}">
        <td class="text-cell">${escapeHtml(ex.name)}</td><td>${escapeHtml(ex.category)}</td>
        <td>${ex.sets ?? ''}</td><td>${ex.reps ?? ''}</td><td>${ex.duration_sec ?? ''}</td>
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
