// ============================================================
// صفحه پیگیری پیشرفت: ثبت وضعیت + نمودار روند
// ============================================================

const ProgressPage = {
  currentPatientId: null,

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="flex-between mb-16">
          <div class="field" style="width:280px; margin-bottom:0;">
            <label>انتخاب بیمار</label>
            <select id="pr_patient"></select>
          </div>
          <button class="btn btn-primary" id="pr_chartBtn">${icon('chart')}نمایش نمودار روند پیشرفت</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.chart}</span>ثبت وضعیت جدید بیمار</div>
        <div class="form-row cols-3">
          <div class="field"><label>تاریخ (شمسی)</label><input type="text" id="pr_date" data-jalali></div>
          <div class="field"><label>میزان درد (۰ تا ۱۰)</label><input type="text" id="pr_pain"></div>
          <div class="field"><label>دامنه حرکتی (۰ تا ۱۰۰)</label><input type="text" id="pr_mobility"></div>
        </div>
        <div class="field mb-16"><label>یادداشت</label><input type="text" id="pr_notes"></div>
        <div class="flex-gap-8" style="justify-content:flex-end;">
          <button class="btn btn-success" id="pr_addBtn">${icon('plus')}ثبت وضعیت</button>
        </div>
      </div>

      <div class="table-wrap mb-16">
        <div class="table-scroll">
          <table>
            <thead><tr><th>تاریخ</th><th>میزان درد</th><th>دامنه حرکتی</th><th>یادداشت</th></tr></thead>
            <tbody id="pr_tbody"></tbody>
          </table>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead><tr><th>نام تمرین</th><th>دسته</th><th>ست</th><th>تکرار</th><th>زمان</th><th>تاریخ تخصیص</th></tr></thead>
            <tbody id="pr_ex_tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    initAllJalaliPickers(container);
    document.getElementById('pr_date').value = todayJalaliStr();

    await this.refreshPatientOptions();
    this._bind();
  },

  _bind() {
    document.getElementById('pr_patient').addEventListener('change', (e) => {
      this.currentPatientId = e.target.value ? parseInt(e.target.value, 10) : null;
      this.refreshTables();
    });
    document.getElementById('pr_addBtn').addEventListener('click', () => this.addLog());
    document.getElementById('pr_chartBtn').addEventListener('click', () => this.showChart());
  },

  async refreshPatientOptions() {
    const res = await Bridge.call('patient_options');
    if (!res.ok) return;
    const sel = document.getElementById('pr_patient');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value=""></option>' + res.data.map(p =>
      `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    if (prev) sel.value = prev;
  },

  async refreshTables() {
    const tbody = document.getElementById('pr_tbody');
    const exTbody = document.getElementById('pr_ex_tbody');
    if (!this.currentPatientId) {
      tbody.innerHTML = '';
      exTbody.innerHTML = '';
      return;
    }
    const [logsRes, exRes] = await Promise.all([
      Bridge.call('get_progress_logs', this.currentPatientId),
      Bridge.call('get_patient_exercises', this.currentPatientId),
    ]);

    if (logsRes.ok) {
      tbody.innerHTML = logsRes.data.length ? logsRes.data.map(l => `
        <tr><td>${escapeHtml(l.log_date)}</td><td>${l.pain_level}</td>
        <td>${l.mobility_score}</td><td class="text-cell">${escapeHtml(l.notes)}</td></tr>
      `).join('') : `<tr><td colspan="4"><div class="empty-state"><span class="icon">${ICONS.chart}</span><div>هنوز رکوردی ثبت نشده است.</div></div></td></tr>`;
    }
    if (exRes.ok) {
      exTbody.innerHTML = exRes.data.length ? exRes.data.map(e => `
        <tr><td class="text-cell">${escapeHtml(e.name)}</td><td>${escapeHtml(e.category)}</td>
        <td>${e.sets ?? ''}</td><td>${e.reps ?? ''}</td><td>${e.duration_sec ?? ''}</td>
        <td>${escapeHtml(e.assigned_date)}</td></tr>
      `).join('') : `<tr><td colspan="6"><div class="empty-state"><span class="icon">${ICONS.dumbbell}</span><div>هنوز تمرینی تخصیص نیافته است.</div></div></td></tr>`;
    }
  },

  async addLog() {
    if (!this.currentPatientId) return toast('لطفاً ابتدا یک بیمار انتخاب کنید.', 'error');
    const date = document.getElementById('pr_date').value;
    const pain = parseInt(document.getElementById('pr_pain').value, 10);
    const mobility = parseInt(document.getElementById('pr_mobility').value, 10);
    const notes = document.getElementById('pr_notes').value.trim();

    if (isNaN(pain) || isNaN(mobility)) return toast('میزان درد و دامنه حرکتی باید عدد باشند.', 'error');

    const res = await Bridge.call('add_progress_log', this.currentPatientId, date, pain, mobility, notes);
    if (!res.ok) return toast(res.error, 'error');
    toast('وضعیت جدید ثبت شد.');
    document.getElementById('pr_notes').value = '';
    document.getElementById('pr_date').value = todayJalaliStr();
    await this.refreshTables();
  },

  async showChart() {
    if (!this.currentPatientId) return toast('لطفاً ابتدا یک بیمار انتخاب کنید.', 'error');
    const res = await Bridge.call('get_progress_logs', this.currentPatientId);
    if (!res.ok) return toast(res.error, 'error');
    if (res.data.length === 0) return toast('برای این بیمار هنوز هیچ رکورد پیشرفتی ثبت نشده است.', 'warning');

    const overlay = el('div', { class: 'modal-overlay active' });
    const box = el('div', { class: 'modal-box', style: 'width:780px; max-width:95vw;' });
    box.innerHTML = `
      <div class="modal-title mb-16">نمودار روند پیشرفت</div>
      <div id="progressChartBox"></div>
      <div class="modal-actions"><button class="btn btn-ghost" id="closeChartBtn">بستن</button></div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector('#closeChartBtn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    renderDualLineChart(box.querySelector('#progressChartBox'), {
      labels: res.data.map(l => l.log_date),
      seriesA: res.data.map(l => l.pain_level),
      seriesB: res.data.map(l => l.mobility_score),
      labelA: 'میزان درد (۰-۱۰)', labelB: 'دامنه حرکتی (۰-۱۰۰)',
    });
  },
};
