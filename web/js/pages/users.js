// ============================================================
// صفحه مدیریت کاربران (فقط مدیر)
// ============================================================

const UsersPage = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-title"><span class="icon">${ICONS.users}</span>تعریف کاربر جدید</div>
        <div class="form-row cols-4">
          <div class="field"><label>نام *</label><input type="text" id="u_first_name"></div>
          <div class="field"><label>نام خانوادگی *</label><input type="text" id="u_last_name"></div>
          <div class="field"><label>نام کاربری *</label><input type="text" id="u_username"></div>
          <div class="field">
            <label>رمز عبور *</label>
            <div class="password-wrap">
              <input type="password" id="u_password">
              <button type="button" class="password-toggle" id="u_togglePwd"></button>
            </div>
          </div>
        </div>
        <div class="form-row cols-4">
          <div class="field">
            <label>نقش *</label>
            <select id="u_role"><option value="user">کاربر عادی</option><option value="admin">مدیر (دسترسی کامل)</option></select>
          </div>
        </div>
        <div class="flex-gap-8" style="justify-content:flex-end;">
          <button class="btn btn-success" id="u_addBtn">${icon('plus')}افزودن کاربر</button>
        </div>
      </div>

      <div class="table-wrap mb-16">
        <div class="table-scroll">
          <table>
            <thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>تاریخ ایجاد</th></tr></thead>
            <tbody id="u_tbody"></tbody>
          </table>
        </div>
      </div>
      <div class="flex" style="justify-content:flex-end;">
        <button class="btn btn-danger" id="u_deactivateBtn">${icon('trash')}غیرفعال کردن کاربر انتخاب‌شده</button>
      </div>
    `;

    document.getElementById('u_togglePwd').innerHTML = ICONS.eye;
    document.getElementById('u_togglePwd').addEventListener('click', function () {
      const pwd = document.getElementById('u_password');
      const show = pwd.type === 'password';
      pwd.type = show ? 'text' : 'password';
      this.innerHTML = show ? ICONS.eyeOff : ICONS.eye;
    });

    this.selectedId = null;
    document.getElementById('u_addBtn').addEventListener('click', () => this.add());
    document.getElementById('u_deactivateBtn').addEventListener('click', () => this.deactivate());
    await this.refreshList();
  },

  async add() {
    const first_name = document.getElementById('u_first_name').value.trim();
    const last_name = document.getElementById('u_last_name').value.trim();
    const username = document.getElementById('u_username').value.trim();
    const password = document.getElementById('u_password').value;
    const role = document.getElementById('u_role').value;

    const res = await Bridge.call('create_user', first_name, last_name, username, password, role);
    if (!res.ok) return toast(res.error, 'error');
    toast('کاربر جدید با موفقیت اضافه شد.');
    ['u_first_name','u_last_name','u_username','u_password'].forEach(id => document.getElementById(id).value = '');
    await this.refreshList();
  },

  async deactivate() {
    if (!this.selectedId) return toast('ابتدا یک کاربر را از لیست انتخاب کنید.', 'error');
    if (this.selectedUsername === App.currentUser.username) {
      return toast('نمی‌توانید حساب کاربری خودتان را غیرفعال کنید.', 'error');
    }
    const yes = await confirmDialog('غیرفعال کردن کاربر', `کاربر «${this.selectedUsername}» غیرفعال شود؟ دیگر نمی‌تواند وارد شود.`);
    if (!yes) return;
    const res = await Bridge.call('deactivate_user', this.selectedId);
    if (!res.ok) return toast(res.error, 'error');
    toast('کاربر غیرفعال شد.');
    this.selectedId = null;
    await this.refreshList();
  },

  async refreshList() {
    const res = await Bridge.call('list_users');
    if (!res.ok) return toast(res.error, 'error');
    const tbody = document.getElementById('u_tbody');
    const roleFa = { admin: 'مدیر (دسترسی کامل)', user: 'کاربر عادی' };

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><span class="icon">${ICONS.users}</span><div>کاربری یافت نشد.</div></div></td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(u => `
      <tr data-id="${u.id}" data-username="${escapeHtml(u.username)}" class="${u.id === this.selectedId ? 'selected' : ''}">
        <td class="text-cell">${escapeHtml(u.first_name)} ${escapeHtml(u.last_name)}</td>
        <td>${escapeHtml(u.username)}</td><td>${roleFa[u.role] || u.role}</td><td>${escapeHtml(u.created_at)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        this.selectedId = parseInt(tr.dataset.id, 10);
        this.selectedUsername = tr.dataset.username;
        this.refreshList();
      });
    });
  },
};
