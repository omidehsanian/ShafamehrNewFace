// ============================================================
// نمودار خطی سبک با SVG خالص (بدون کتابخانه جانبی)
// برای نمایش روند پیشرفت بیمار (میزان درد + دامنه حرکتی در طول زمان)
// ============================================================

function renderDualLineChart(container, { labels, seriesA, seriesB, labelA, labelB, maxA = 10, maxB = 100 }) {
  const width = 720, height = 360;
  const padding = { top: 30, right: 50, bottom: 60, left: 50 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const n = labels.length;

  const xStep = n > 1 ? plotW / (n - 1) : 0;
  const xOf = (i) => padding.left + (n > 1 ? i * xStep : plotW / 2);
  const yOfA = (v) => padding.top + plotH - (v / maxA) * plotH;
  const yOfB = (v) => padding.top + plotH - (v / maxB) * plotH;

  const pathA = seriesA.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOfA(v)}`).join(' ');
  const pathB = seriesB.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOfB(v)}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const y = padding.top + plotH * t;
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e9eff0" stroke-width="1"/>`;
  }).join('');

  const xLabels = labels.map((lbl, i) => {
    if (n > 10 && i % Math.ceil(n / 10) !== 0) return '';
    return `<text x="${xOf(i)}" y="${height - padding.bottom + 22}" font-size="10.5" fill="#647377"
      text-anchor="middle" transform="rotate(-35 ${xOf(i)} ${height - padding.bottom + 22})">${lbl}</text>`;
  }).join('');

  const dotsA = seriesA.map((v, i) => `<circle cx="${xOf(i)}" cy="${yOfA(v)}" r="3.5" fill="#e2574c"/>`).join('');
  const dotsB = seriesB.map((v, i) => `<circle cx="${xOf(i)}" cy="${yOfB(v)}" r="3.5" fill="#4fb3a4"/>`).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; font-family:var(--font-family);">
      ${gridLines}
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#c2ced1"/>
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#c2ced1"/>
      <path d="${pathA}" fill="none" stroke="#e2574c" stroke-width="2.4"/>
      <path d="${pathB}" fill="none" stroke="#4fb3a4" stroke-width="2.4"/>
      ${dotsA}${dotsB}
      ${xLabels}
      <g transform="translate(${padding.left}, 14)">
        <circle cx="0" cy="0" r="4.5" fill="#e2574c"/>
        <text x="10" y="4" font-size="11.5" fill="#2c3a3f" font-weight="700">${labelA}</text>
        <circle cx="150" cy="0" r="4.5" fill="#4fb3a4"/>
        <text x="160" y="4" font-size="11.5" fill="#2c3a3f" font-weight="700">${labelB}</text>
      </g>
    </svg>
  `;
}
