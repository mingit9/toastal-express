// 메이플 시럽 질감 제목 (첨부해 주신 메이플 시럽 글씨.html 을 모듈로 옮긴 것)
// 값은 사진 그대로: 앰버 등급 / 점도 6 / 투명도 36% / 흘러내림 켬.
// renderSyrup(host, text, seed, isStale) → host 안에 SVG 를 그려요. 같은 (text, seed) 면 같은 모양이에요.
const NS = 'http://www.w3.org/2000/svg';
// 글꼴은 style.css 의 --font-syrup 을 그대로 가져와요.
const fontStack = () => getComputedStyle(document.documentElement).getPropertyValue('--font-syrup').trim() || "'Rubik Spray Paint','Jua',sans-serif";
const STOPS = ['#f9c04a', '#e08e24', '#aa5610'];   // 앰버
const VISC = 6, CLEAR = 36;                          // 점도 / 투명도(%)
let uid = 0;

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const el = (name, attrs) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

// 글자 아래쪽 가로줄을 읽어, 시럽이 실제로 흘러내릴 수 있는 글자 획 위치를 찾아요
function strokeRuns(str) {
  const size = 200, pad = 40;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.font = size + 'px ' + fontStack();
  const w = Math.ceil(ctx.measureText(str).width);
  cv.width = w + pad * 2; cv.height = Math.ceil(size * 1.5);
  ctx.font = size + 'px ' + fontStack(); ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#000';
  const base = Math.round(size * 1.1);
  ctx.fillText(str, pad, base);
  const d = ctx.getImageData(0, base - 12, cv.width, 1).data;
  const runs = []; let s = -1;
  for (let i = 0; i <= cv.width; i++) {
    const on = i < cv.width && d[i * 4 + 3] > 128;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { if (i - s >= 18) runs.push({ a: s - pad, b: i - pad }); s = -1; }
  }
  return runs;
}

function buildDrips(g, str, seed, grad) {
  g.textContent = '';
  const r = rng(seed);
  const runs = strokeRuns(str).map(v => [r(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
  let picks = runs.filter(() => r() < 0.6).slice(0, 7);
  const need = Math.min(2, runs.length);
  if (picks.length < need) picks = runs.slice(0, need);
  picks.forEach(run => {
    const w = 11 + r() * 6;
    const span = Math.max(0, run.b - run.a - w - 8);
    const x = (run.a + run.b) / 2 + (r() - 0.5) * span * 0.8;
    const len = 24 + r() * 60 + (r() < 0.25 ? 50 : 0);
    const y0 = -16;
    g.appendChild(el('line', { x1: x, y1: y0, x2: x, y2: y0 + len, 'stroke-width': (w * 0.8).toFixed(1), 'stroke-linecap': 'round', stroke: `url(#${grad})` }));
    g.appendChild(el('circle', { cx: x, cy: y0 + len, r: (w * 0.62).toFixed(1), fill: `url(#${grad})` }));
  });
}

export async function renderSyrup(host, text, seed, isStale) {
  const id = 'sy' + (++uid), gid = id + 'g', fid = id + 'f';
  const str = String(text).replace(/\s+/g, ' ').trim().toLocaleUpperCase();
  const blur = (2.5 + VISC * 0.75).toFixed(2), scale = (3 + VISC * 0.9).toFixed(2), slope = (1 - CLEAR / 100).toFixed(2);
  const svg = el('svg', { class: 'syrup-svg', viewBox: '-50 -190 800 330', role: 'img', 'aria-label': str });
  svg.innerHTML = `
    <defs>
      <linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="-150" x2="0" y2="60">
        <stop offset="0" stop-color="${STOPS[0]}"/><stop offset="0.55" stop-color="${STOPS[1]}"/><stop offset="1" stop-color="${STOPS[2]}"/>
      </linearGradient>
      <filter id="${fid}" x="-8%" y="-25%" width="116%" height="165%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="soft"/>
        <feColorMatrix in="soft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo"/>
        <feOffset in="goo" dy="14" result="gOff"/>
        <feGaussianBlur in="gOff" stdDeviation="9" result="gBlur"/>
        <feColorMatrix in="gBlur" type="matrix" values="0 0 0 0 0.86  0 0 0 0 0.40  0 0 0 0 0.05  0 0 0 0.5 0" result="glow"/>
        <feOffset in="goo" dy="5" result="cOff"/>
        <feGaussianBlur in="cOff" stdDeviation="3" result="cBlur"/>
        <feColorMatrix in="cBlur" type="matrix" values="0 0 0 0 0.20  0 0 0 0 0.07  0 0 0 0 0.0  0 0 0 0.35 0" result="contact"/>
        <feComponentTransfer in="goo" result="body"><feFuncA type="linear" slope="${slope}"/></feComponentTransfer>
        <feGaussianBlur in="goo" stdDeviation="5" result="ba"/>
        <feComposite in="goo" in2="ba" operator="out" result="edgeRaw"/>
        <feColorMatrix in="edgeRaw" type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.09  0 0 0 0 0.01  0 0 0 1.5 0" result="edge"/>
        <feGaussianBlur in="goo" stdDeviation="${blur}" result="bump"/>
        <feSpecularLighting in="bump" surfaceScale="${scale}" specularConstant="1.4" specularExponent="40" lighting-color="#fff4cc" result="specR"><feDistantLight azimuth="225" elevation="32"/></feSpecularLighting>
        <feComposite in="specR" in2="goo" operator="in" result="hi"/>
        <feSpecularLighting in="bump" surfaceScale="${scale}" specularConstant="0.7" specularExponent="30" lighting-color="#ffd27a" result="rimR"><feDistantLight azimuth="45" elevation="30"/></feSpecularLighting>
        <feComposite in="rimR" in2="goo" operator="in" result="rimHi"/>
        <feMerge><feMergeNode in="glow"/><feMergeNode in="contact"/><feMergeNode in="body"/><feMergeNode in="edge"/><feMergeNode in="rimHi"/><feMergeNode in="hi"/></feMerge>
      </filter>
    </defs>
    <g class="sy-body" filter="url(#${fid})"><g class="sy-drips"></g>
      <text x="0" y="0" font-size="200" font-family="${fontStack().replace(/"/g, "'")}" fill="url(#${gid})"></text></g>`;
  svg.querySelector('text').textContent = str;
  host.append(svg);

  try { await Promise.all([document.fonts.load('200px "Rubik Spray Paint"', str), document.fonts.load('200px "EF_jejudoldam"', str)]); } catch (e) {}
  if (isStale && isStale()) return;
  buildDrips(svg.querySelector('.sy-drips'), str, seed, gid);
  // 화면에 붙은 뒤에야 크기를 잴 수 있어요
  for (let i = 0; i < 30 && !svg.isConnected; i++) await new Promise(r => requestAnimationFrame(r));
  if (isStale && isStale()) return;
  try {
    const b = svg.querySelector('.sy-body').getBBox();
    if (b.width > 0) {
      svg.setAttribute('viewBox', [b.x - 50, b.y - 30, b.width + 100, b.height + 30 + 90].join(' '));
      svg.style.width = (b.width + 100) * Math.min(0.115, 66 / b.width) + 'cqw';
    }
  } catch (e) { /* 크기를 못 재면 기본 영역을 써요 */ }
}
