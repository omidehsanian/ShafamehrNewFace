// ============================================================
// صفحه بیماران: لیست، جستجو، فرم افزودن/ویرایش
// ============================================================

const PatientsPage = {
  selectedId: null,
  patients: [],

  async render(container) {
    container.innerHTML = `
      <div class="page-toolbar">
        <div class="search-box">
          <span class="icon">${ICONS.search}</span>
          <input type="search" id="patientSearch" placeholder="جستجو (نام، تلفن، کد ملی)">
        </div>
      </div>

      <div class="table-wrap mb-16">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>نام کامل</th><th>تلفن</th><th>کد ملی</th>
                <th>بیمه پایه</th><th>بیمه تکمیلی</th><th>نوع بیماری</th>
              </tr>
            </thead>
            <tbody id="patientsTbody"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.patients}</span>مشخصات بیمار</div>

        <div class="form-row cols-4">
          ${this._field('نام *', 'p_first_name')}
          ${this._field('نام خانوادگی *', 'p_last_name')}
          ${this._field('کد ملی', 'p_national_code')}
          ${this._field('شماره تلفن', 'p_phone')}
        </div>
        <div class="form-row cols-4">
          ${this._select('جنسیت', 'p_gender', ['مرد', 'زن'])}
          ${this._field('شغل', 'p_occupation')}
          ${this._field('آدرس', 'p_address')}
          ${this._field('نام سازمان (بیمه تکمیلی)', 'p_supplementary_insurance_org')}
        </div>
        <div class="form-row cols-3">
          <div class="field">
            <label>تاریخ تولد (شمسی)</label>
            <input type="text" id="p_birth_date" data-jalali placeholder="روی فیلد کلیک کنید">
          </div>
          ${this._select('بیمه پایه', 'p_primary_insurance', PRIMARY_INSURANCE_OPTIONS)}
          ${this._select('بیمه تکمیلی', 'p_supplementary_insurance', SUPPLEMENTARY_INSURANCE_OPTIONS)}
        </div>
        <div class="form-row cols-2">
          ${this._field('کد رهگیری نسخه', 'p_prescription_code')}
          ${this._field('پزشک معالج / ارجاع‌دهنده', 'p_referring_doctor')}
        </div>
        <div class="form-row cols-2">
          <div class="field">
            <label>تشخیص / نوع بیماری</label>
            <textarea id="p_diagnosis" rows="2"></textarea>
          </div>
          <div class="field">
            <label>سابقه پزشکی / بیماری زمینه‌ای</label>
            <textarea id="p_medical_history" rows="2"></textarea>
          </div>
        </div>
        <div class="form-row cols-4">
          ${this._field('حساسیت‌های دارویی', 'p_allergies')}
          ${this._select('گروه خونی', 'p_blood_type', ['نامشخص','+O','-O','+A','-A','+B','-B','+AB','-AB'])}
          ${this._field('قد (cm)', 'p_height')}
          ${this._field('وزن (kg)', 'p_weight')}
        </div>
        <div class="form-row cols-2">
          ${this._field('نام تماس اضطراری', 'p_emergency_contact_name')}
          ${this._field('تلفن تماس اضطراری', 'p_emergency_contact_phone')}
        </div>
        <div class="field mb-16">
          <label>یادداشت</label>
          <textarea id="p_notes" rows="2"></textarea>
        </div>

        <div class="flex-gap-8" style="justify-content:flex-end;">
          <button class="btn btn-ghost" id="patientClearBtn">پاک کردن فرم</button>
          <button class="btn btn-danger" id="patientDeleteBtn">${icon('trash')}حذف بیمار</button>
          <button class="btn btn-primary" id="patientSaveBtn">${icon('save')}ذخیره تغییرات</button>
          <button class="btn btn-success" id="patientAddBtn">${icon('plus')}افزودن بیمار جدید</button>
        </div>
      </div>
    `;

    initAllJalaliPickers(container);
    this._bindEvents(container);
    await this.refreshList();
  },

  _field(label, id) {
    return `<div class="field"><label>${label}</label><input type="text" id="${id}"></div>`;
  },

  _select(label, id, options) {
    const opts = options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
    return `<div class="field"><label>${label}</label><select id="${id}"><option value=""></option>${opts}</select></div>`;
  },

  _bindEvents(container) {
    document.getElementById('patientSearch').addEventListener('input', debounce(() => this.refreshList(), 250));
    document.getElementById('patientAddBtn').addEventListener('click', () => this.save(false));
    document.getElementById('patientSaveBtn').addEventListener('click', () => this.save(true));
    document.getElementById('patientClearBtn').addEventListener('click', () => this.clearForm());
    document.getElementById('patientDeleteBtn').addEventListener('click', () => this.deleteSelected());
  },

  async refreshList() {
    const search = document.getElementById('patientSearch').value.trim();
    const res = await Bridge.call('list_patients', search);
    if (!res.ok) return toast(res.error, 'error');
    this.patients = res.data;
    const tbody = document.getElementById('patientsTbody');

    if (this.patients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="icon">${ICONS.patients}</span><div>هنوز بیماری ثبت نشده است.</div></div></td></tr>`;
      return;
    }

    tbody.innerHTML = this.patients.map(p => `
      <tr data-id="${p.id}" class="${p.id === this.selectedId ? 'selected' : ''}">
        <td class="text-cell">${escapeHtml(p.full_name)}</td>
        <td>${escapeHtml(p.phone)}</td>
        <td>${escapeHtml(p.national_code)}</td>
        <td>${escapeHtml(p.primary_insurance)}</td>
        <td>${escapeHtml(p.supplementary_insurance)}</td>
        <td class="text-cell">${escapeHtml(p.diagnosis)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => this.selectPatient(parseInt(tr.dataset.id, 10)));
    });
  },

  async selectPatient(id) {
    const res = await Bridge.call('get_patient', id);
    if (!res.ok || !res.data) return;
    this.selectedId = id;
    const p = res.data;
    const map = {
      p_first_name: 'first_name', p_last_name: 'last_name', p_national_code: 'national_code',
      p_phone: 'phone', p_gender: 'gender', p_occupation: 'occupation', p_address: 'address',
      p_supplementary_insurance_org: 'supplementary_insurance_org', p_birth_date: 'birth_date',
      p_primary_insurance: 'primary_insurance', p_supplementary_insurance: 'supplementary_insurance',
      p_prescription_code: 'prescription_code', p_referring_doctor: 'referring_doctor',
      p_diagnosis: 'diagnosis', p_medical_history: 'medical_history', p_allergies: 'allergies',
      p_blood_type: 'blood_type', p_height: 'height', p_weight: 'weight',
      p_emergency_contact_name: 'emergency_contact_name', p_emergency_contact_phone: 'emergency_contact_phone',
      p_notes: 'notes',
    };
    for (const [elId, key] of Object.entries(map)) {
      const node = document.getElementById(elId);
      if (node) node.value = p[key] || '';
    }
    this.refreshList();
  },

  clearForm() {
    this.selectedId = null;
    document.querySelectorAll('#pageContent input[id^="p_"], #pageContent textarea[id^="p_"], #pageContent select[id^="p_"]')
      .forEach(elx => { elx.value = ''; });
    this.refreshList();
  },

  _collectForm() {
    const ids = ['first_name','last_name','national_code','phone','gender','occupation','address',
      'supplementary_insurance_org','birth_date','primary_insurance','supplementary_insurance',
      'prescription_code','referring_doctor','diagnosis','medical_history','allergies','blood_type',
      'height','weight','emergency_contact_name','emergency_contact_phone','notes'];
    const data = {};
    ids.forEach(key => { data[key] = (document.getElementById('p_' + key)?.value || '').trim(); });
    return data;
  },

  async save(isUpdate) {
    const data = this._collectForm();
    if (!data.first_name || !data.last_name) {
      return toast('لطفاً نام و نام خانوادگی را وارد کنید.', 'error');
    }
    let res;
    if (isUpdate) {
      if (!this.selectedId) return toast('ابتدا یک بیمار را از لیست انتخاب کنید.', 'error');
      res = await Bridge.call('update_patient', this.selectedId, data);
    } else {
      res = await Bridge.call('add_patient', data);
    }
    if (!res.ok) return toast(res.error, 'error');
    toast(isUpdate ? 'اطلاعات بیمار به‌روزرسانی شد.' : 'بیمار جدید با موفقیت اضافه شد.');
    if (!isUpdate) this.clearForm();
    await this.refreshList();
    App.onPatientsChanged();
  },

  async deleteSelected() {
    if (!this.selectedId) return toast('ابتدا یک بیمار را از لیست انتخاب کنید.', 'error');
    const yes = await confirmDialog('حذف بیمار', 'آیا از حذف این بیمار مطمئن هستید؟ تمام نوبت‌ها و سوابق او نیز حذف می‌شود.');
    if (!yes) return;
    const res = await Bridge.call('delete_patient', this.selectedId);
    if (!res.ok) return toast(res.error, 'error');
    toast('بیمار حذف شد.');
    this.clearForm();
    await this.refreshList();
    App.onPatientsChanged();
  },
};

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

const PRIMARY_INSURANCE_OPTIONS = [
  "بدون بیمه پایه / آزاد","تأمین اجتماعی","بیمه سلامت ایرانیان (خدمات درمانی)",
  "نیروهای مسلح (ساتا/ساخد)","بیمه روستایی","بیمه خویش‌فرما","کمیته امداد امام خمینی","بهزیستی","سایر",
];
const SUPPLEMENTARY_INSURANCE_OPTIONS = [
  "بدون بیمه تکمیلی","بیمه ایران","بیمه آسیا","بیمه البرز","بیمه دانا","بیمه دی","بیمه سامان",
  "بیمه پارسیان","بیمه پاسارگاد","بیمه معلم","بیمه کارآفرین","بیمه ملت","بیمه سینا","بیمه رازی",
  "بیمه نوین","بیمه تعاون","بیمه سرمد","بیمه میهن","بیمه آرمان","بیمه کوثر","بیمه حکمت صبا",
  "بیمه ما","آتیه‌سازان حافظ","کمک‌رسان ایران (SOS)","سایر",
];
