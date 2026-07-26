// ============================================================
// تبدیل تاریخ میلادی <-> شمسی + ویجت تقویم راست‌به‌چپ با اعداد فارسی
// (معادل جاوااسکریپتی backend/jalali_date.py - همان الگوریتم)
// ============================================================

const PERSIAN_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const PERSIAN_WEEKDAYS = ["ش","ی","د","س","چ","پ","ج"]; // شنبه..جمعه (کوتاه)
const J_DAYS = [31,31,31,31,31,31,30,30,30,30,30,29];

const EN_DIGITS = "0123456789", FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
function toPersianDigits(s) {
  s = String(s);
  let out = "";
  for (const ch of s) { const i = EN_DIGITS.indexOf(ch); out += i >= 0 ? FA_DIGITS[i] : ch; }
  return out;
}
function toEnglishDigits(s) {
  s = String(s);
  let out = "";
  for (const ch of s) { const i = FA_DIGITS.indexOf(ch); out += i >= 0 ? EN_DIGITS[i] : ch; }
  return out;
}

function isGregorianLeap(gy) { return (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0); }

function gregorianToJalali(gy, gm, gd) {
  const gDays = [31,28,31,30,31,30,31,31,30,31,30,31];
  const gy2 = gy - 1600, gm2 = gm - 1, gd2 = gd - 1;
  let gDayNo = 365*gy2 + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400);
  for (let i = 0; i < gm2; i++) gDayNo += gDays[i];
  if (gm2 > 1 && isGregorianLeap(gy)) gDayNo += 1;
  gDayNo += gd2;

  let jDayNo = gDayNo - 79;
  const jNp = Math.floor(jDayNo / 12053);
  jDayNo %= 12053;

  let jy = 979 + 33*jNp + 4*Math.floor(jDayNo/1461);
  jDayNo %= 1461;
  if (jDayNo >= 366) { jy += Math.floor((jDayNo-1)/365); jDayNo = (jDayNo-1) % 365; }

  let jm = 12, jd;
  for (let i = 0; i < 11; i++) {
    if (jDayNo < J_DAYS[i]) { jm = i+1; break; }
    jDayNo -= J_DAYS[i];
  }
  jd = jDayNo + 1;
  return [jy, jm, jd];
}

function jalaliToGregorian(jy, jm, jd) {
  const jy2 = jy - 979, jm2 = jm - 1, jd2 = jd - 1;
  let jDayNo = 365*jy2 + Math.floor(jy2/33)*8 + Math.floor((jy2%33+3)/4);
  for (let i = 0; i < jm2; i++) jDayNo += J_DAYS[i];
  jDayNo += jd2;

  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400*Math.floor(gDayNo/146097);
  gDayNo %= 146097;

  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo -= 1;
    gy += 100*Math.floor(gDayNo/36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo += 1; else leap = false;
  }
  gy += 4*Math.floor(gDayNo/1461);
  gDayNo %= 1461;
  if (gDayNo >= 366) { leap = false; gDayNo -= 1; gy += Math.floor(gDayNo/365); gDayNo %= 365; }

  const gDaysInMonth = [31, ((gy%4===0 && gy%100!==0) || gy%400===0) ? 29 : 28, 31,30,31,30,31,31,30,31,30,31];
  let gm = 0;
  while (gm < 12 && gDayNo >= gDaysInMonth[gm]) { gDayNo -= gDaysInMonth[gm]; gm++; }
  gm += 1;
  const gd = gDayNo + 1;
  return [gy, gm, gd];
}

function jalaliDaysInMonth(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const [gy1,gm1,gd1] = jalaliToGregorian(jy,1,1);
  const [gy2,gm2,gd2] = jalaliToGregorian(jy+1,1,1);
  const d1 = new Date(gy1, gm1-1, gd1), d2 = new Date(gy2, gm2-1, gd2);
  return Math.round((d2-d1)/86400000) - 31*6 - 30*5;
}

function todayJalali() {
  const t = new Date();
  return gregorianToJalali(t.getFullYear(), t.getMonth()+1, t.getDate());
}

function formatJalali(jy, jm, jd, persian=true) {
  const s = `${String(jy).padStart(4,'0')}/${String(jm).padStart(2,'0')}/${String(jd).padStart(2,'0')}`;
  return persian ? toPersianDigits(s) : s;
}

function todayJalaliStr() { const [jy,jm,jd] = todayJalali(); return formatJalali(jy,jm,jd); }

function parseJalali(text) {
  if (!text) return null;
  const norm = toEnglishDigits(text).trim().replace(/-/g, '/');
  const parts = norm.split('/');
  if (parts.length !== 3) return null;
  const jy = parseInt(parts[0],10), jm = parseInt(parts[1],10), jd = parseInt(parts[2],10);
  if (isNaN(jy) || isNaN(jm) || isNaN(jd) || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return [jy, jm, jd];
}

// ============================================================
// ویجت تقویم: روی هر input[data-jalali] فعال می‌شود
// ============================================================
function initJalaliDatePicker(input) {
  let popup = null;
  let viewY, viewM;

  input.setAttribute('readonly', 'readonly');
  input.classList.add('jalali-input');
  input.style.cursor = 'pointer';

  function openPopup() {
    closePopup();
    const parsed = parseJalali(input.value) || todayJalali();
    [viewY, viewM] = [parsed[0], parsed[1]];

    popup = document.createElement('div');
    popup.className = 'jalali-popup';
    document.body.appendChild(popup);
    render();

    const rect = input.getBoundingClientRect();
    popup.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    popup.style.left = (rect.left + window.scrollX) + 'px';

    setTimeout(() => document.addEventListener('mousedown', onOutsideClick), 0);
  }

  function closePopup() {
    if (popup) { popup.remove(); popup = null; }
    document.removeEventListener('mousedown', onOutsideClick);
  }

  function onOutsideClick(e) {
    if (popup && !popup.contains(e.target) && e.target !== input) closePopup();
  }

  function render() {
    const daysInMonth = jalaliDaysInMonth(viewY, viewM);
    const [gy, gm, gd] = jalaliToGregorian(viewY, viewM, 1);
    const jsWeekday = new Date(gy, gm - 1, gd).getDay(); // یکشنبه=0 ... شنبه=6 در جاوااسکریپت
    const startCol = (jsWeekday + 1) % 7; // تبدیل به شنبه=0 ... جمعه=6
    const [ty, tm, td] = todayJalali();

    let daysHtml = '';
    for (let i = 0; i < startCol; i++) daysHtml += `<div class="jalali-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = (viewY === ty && viewM === tm && d === td);
      daysHtml += `<div class="jalali-day${isToday ? ' today' : ''}" data-day="${d}">${toPersianDigits(d)}</div>`;
    }

    popup.innerHTML = `
      <div class="jalali-controls">
        <select class="jalali-year-select"></select>
        <select class="jalali-month-select"></select>
      </div>
      <div class="jalali-nav">
        <button type="button" class="jalali-nav-btn" data-nav="next">${ICONS.chevronRight}</button>
        <div class="jalali-title">${PERSIAN_MONTHS[viewM-1]} ${toPersianDigits(viewY)}</div>
        <button type="button" class="jalali-nav-btn" data-nav="prev">${ICONS.chevronLeft}</button>
      </div>
      <div class="jalali-weekdays">${PERSIAN_WEEKDAYS.map(w => `<div>${w}</div>`).join('')}</div>
      <div class="jalali-days">${daysHtml}</div>
      <div class="jalali-footer">
        <button type="button" class="jalali-today-btn">امروز</button>
      </div>
    `;

    const yearSelect = popup.querySelector('.jalali-year-select');
    const curYear = todayJalali()[0];
    for (let y = curYear - 100; y <= curYear + 5; y++) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = toPersianDigits(y);
      if (y === viewY) opt.selected = true;
      yearSelect.appendChild(opt);
    }
    yearSelect.addEventListener('change', () => { viewY = parseInt(yearSelect.value, 10); render(); reposition(); });

    const monthSelect = popup.querySelector('.jalali-month-select');
    PERSIAN_MONTHS.forEach((name, idx) => {
      const opt = document.createElement('option');
      opt.value = idx + 1; opt.textContent = name;
      if (idx + 1 === viewM) opt.selected = true;
      monthSelect.appendChild(opt);
    });
    monthSelect.addEventListener('change', () => { viewM = parseInt(monthSelect.value, 10); render(); reposition(); });

    popup.querySelectorAll('.jalali-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.nav === 'next' ? 1 : -1;
        viewM += dir;
        if (viewM > 12) { viewM = 1; viewY++; }
        else if (viewM < 1) { viewM = 12; viewY--; }
        render();
        reposition();
      });
    });

    popup.querySelectorAll('.jalali-day:not(.empty)').forEach(el => {
      el.addEventListener('click', () => {
        const d = parseInt(el.dataset.day, 10);
        input.value = formatJalali(viewY, viewM, d);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        closePopup();
      });
    });

    popup.querySelector('.jalali-today-btn').addEventListener('click', () => {
      const [ty2, tm2, td2] = todayJalali();
      input.value = formatJalali(ty2, tm2, td2);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      closePopup();
    });
  }

  function reposition() {
    const rect = input.getBoundingClientRect();
    popup.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    popup.style.left = (rect.left + window.scrollX) + 'px';
  }

  input.addEventListener('click', openPopup);
}

function initAllJalaliPickers(root = document) {
  root.querySelectorAll('input[data-jalali]').forEach(el => {
    if (!el.dataset.jalaliInit) { initJalaliDatePicker(el); el.dataset.jalaliInit = '1'; }
  });
}
