// ============================================================
// هماهنگ‌کننده اصلی برنامه: مدیریت صفحه ورود، لایسنس، ناوبری و قفل خودکار
// ============================================================

const App = {
  currentUser: null,
  currentPage: 'patients',
  idleTimer: null,
  idleMinutes: 15,
  lastActivity: Date.now(),

  pages: {
    patients: PatientsPage,
    appointments: AppointmentsPage,
    exercises: ExercisesPage,
    progress: ProgressPage,
    reports: ReportsPage,
    users: UsersPage,
    license: LicensePage,
    settings: SettingsPage,
  },

  pageTitles: {
    patients: 'بیماران', appointments: 'نوبت‌دهی', exercises: 'کتابخانه تمرینات',
    progress: 'پیگیری پیشرفت', reports: 'گزارش‌ها و خروجی اکسل', users: 'کاربران',
    license: 'لایسنس', settings: 'تنظیمات',
  },

  async boot() {
    this._bindStaticEvents();

    const identity = await Bridge.call('app_identity');
    if (identity.ok) this._applyIdentity(identity.data);

    const licenseRes = await Bridge.call('get_license_status');
    if (licenseRes.ok && licenseRes.data.is_expired) {
      this._showLicenseGate(licenseRes.data);
      return;
    }
    if (licenseRes.ok && licenseRes.data.days_left <= 7) {
      const el = document.getElementById('licenseSoonWarning');
      const typeFa = licenseRes.data.type === 'trial' ? 'دوره آزمایشی' : 'لایسنس';
      el.textContent = `${typeFa} شما ${licenseRes.data.days_left} روز دیگر منقضی می‌شود.`;
      el.classList.remove('hidden');
    }
    if (identity.ok && identity.data.is_first_run) {
      document.getElementById('firstRunHint').classList.remove('hidden');
    }

    this._showScreen('screenAuth');
  },

  _applyIdentity(identity) {
    document.getElementById('appNameTitle').textContent = identity.app_name;
    document.getElementById('sidebarAppName').textContent = identity.app_name;
    document.title = identity.app_name;

    const logoImg = document.getElementById('sidebarLogoImg');
    const logoFallback = document.getElementById('sidebarLogoFallback');
    const authLogoIcon = document.getElementById('authLogoIcon');
    if (identity.logo_data_url) {
      logoImg.src = identity.logo_data_url;
      logoImg.classList.remove('hidden');
      logoFallback.classList.add('hidden');
      document.getElementById('authLogo').innerHTML = `<img src="${identity.logo_data_url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
    } else {
      logoImg.classList.add('hidden');
      logoFallback.classList.remove('hidden');
      logoFallback.textContent = initialsOf(identity.app_name);
      authLogoIcon.innerHTML = ICONS.patients;
    }
  },

  _showScreen(id) {
    ['screenAuth', 'screenLicenseGate', 'screenApp'].forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
  },

  _showLicenseGate(status) {
    document.getElementById('gateIcon').innerHTML = ICONS.lock;
    document.getElementById('lockIcon').innerHTML = ICONS.lock;
    const typeFa = status.type === 'trial' ? 'دوره آزمایشی' : 'لایسنس';
    document.getElementById('gateExpiryText').textContent =
      `${typeFa} شما در تاریخ ${status.expiry_date_jalali} منقضی شد.`;
    this._showScreen('screenLicenseGate');
  },

  _bindStaticEvents() {
    // ---------- ورود ----------
    document.getElementById('toggleLoginPwd').innerHTML = ICONS.eye;
    document.getElementById('toggleLoginPwd').addEventListener('click', function () {
      const pwd = document.getElementById('loginPassword');
      const show = pwd.type === 'password';
      pwd.type = show ? 'text' : 'password';
      this.innerHTML = show ? ICONS.eyeOff : ICONS.eye;
    });

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const errEl = document.getElementById('loginError');
      errEl.classList.remove('active');

      const res = await Bridge.call('login', username, password);
      if (!res.ok) { errEl.textContent = res.error; errEl.classList.add('active'); return; }
      await this._enterApp(res.data);
    });

    // ---------- صفحه انقضای لایسنس ----------
    document.getElementById('gateActivateBtn').addEventListener('click', async () => {
      const username = document.getElementById('gateUsername').value.trim();
      const password = document.getElementById('gatePassword').value;
      const key = document.getElementById('gateKey').value.trim();
      const errEl = document.getElementById('gateError');
      errEl.classList.remove('active');

      const loginRes = await Bridge.call('login', username, password);
      if (!loginRes.ok || loginRes.data.role !== 'admin') {
        errEl.textContent = 'نام کاربری/رمز اشتباه است یا دسترسی مدیر ندارید.';
        errEl.classList.add('active');
        return;
      }
      const actRes = await Bridge.call('activate_license', key);
      if (!actRes.ok) { errEl.textContent = actRes.error; errEl.classList.add('active'); return; }
      toast(actRes.data.message);
      this._showScreen('screenAuth');
    });

    // ---------- ناوبری سایدبار ----------
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => this.goToPage(item.dataset.page));
    });

    // ---------- خروج ----------
    document.getElementById('logoutBtn').innerHTML = ICONS.logout;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      const yes = await confirmDialog('خروج از برنامه', 'آیا می‌خواهید از حساب کاربری خارج شوید؟');
      if (!yes) return;
      await Bridge.call('logout');
      location.reload();
    });

    // ---------- قفل خودکار ----------
    document.getElementById('lockIcon').innerHTML = ICONS.lock;
    document.getElementById('lockUnlockBtn').addEventListener('click', () => this._tryUnlock());
    document.getElementById('lockPassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._tryUnlock();
    });
    ['mousedown', 'keydown', 'mousemove'].forEach(evt => {
      document.addEventListener(evt, () => { this.lastActivity = Date.now(); }, { passive: true });
    });
  },

  async _enterApp(user) {
    this.currentUser = user;
    const isAdmin = user.role === 'admin';

    document.getElementById('topbarUserName').textContent = `${user.first_name} ${user.last_name}`;
    document.getElementById('topbarAvatar').textContent = initialsOf(user.first_name);

    document.querySelectorAll('.admin-only').forEach(elx => elx.classList.toggle('hidden', !isAdmin));

    const settingsRes = await Bridge.call('get_settings');
    if (settingsRes.ok) this.idleMinutes = settingsRes.data.auto_lock_minutes || 0;

    this._showScreen('screenApp');
    this.goToPage(isAdmin ? this.currentPage : (this.currentPage === 'reports' || ['users','license','settings'].includes(this.currentPage) ? 'patients' : this.currentPage));
    this._startIdleWatcher();
  },

  async goToPage(pageKey) {
    this.currentPage = pageKey;
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageKey);
    });
    document.getElementById('pageTitle').textContent = this.pageTitles[pageKey] || '';
    const container = document.getElementById('pageContent');
    container.innerHTML = '';
    const page = this.pages[pageKey];
    if (page && page.render) await page.render(container);
  },

  onPatientsChanged() {
    // صفحاتی که دراپ‌داون بیمار دارند، در صورت باز بودن دوباره تازه شوند
    if (this.pages.appointments && this.pages.appointments.refreshPatientOptions) this.pages.appointments.refreshPatientOptions();
    if (this.pages.exercises && this.pages.exercises.refreshPatientOptions) this.pages.exercises.refreshPatientOptions();
    if (this.pages.progress && this.pages.progress.refreshPatientOptions) this.pages.progress.refreshPatientOptions();
  },

  _startIdleWatcher() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => {
      if (!this.idleMinutes || this.idleMinutes <= 0) return;
      const idleMs = Date.now() - this.lastActivity;
      if (idleMs >= this.idleMinutes * 60 * 1000) this._lock();
    }, 15000);
  },

  _lock() {
    document.getElementById('lockUserText').textContent =
      `کاربر: ${this.currentUser.first_name} ${this.currentUser.last_name}`;
    document.getElementById('lockOverlay').classList.add('active');
  },

  async _tryUnlock() {
    const password = document.getElementById('lockPassword').value;
    const errEl = document.getElementById('lockError');
    const res = await Bridge.call('check_password', password);
    if (!res.ok) { errEl.textContent = res.error; errEl.classList.add('active'); return; }
    errEl.classList.remove('active');
    document.getElementById('lockPassword').value = '';
    document.getElementById('lockOverlay').classList.remove('active');
    this.lastActivity = Date.now();
  },
};

window.addEventListener('DOMContentLoaded', () => App.boot());
