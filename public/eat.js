// 토스트 한 입씩 먹기 (받은 토스트 전용)
// - 누른 자리에 이빨 자국 모양 구멍이 생겨요 (CSS mask: 큰 원 + 작은 원 여러 개를 겹침)
// - 글씨 / 버터 / 치즈가 같이 사라져요 (.toast-body 전체에 마스크)
// - 다 먹으면 남은 조각이 부스러기로 흩어지고 접시만 남아요
// - 서버에는 아무것도 지우지 않아요. 다 먹으면 onEaten() 으로 "읽음"만 알려 줘요.
export const EAT = {
  bites: 5,        // 몇 입이면 다 먹은 걸로 칠지 (마지막 입에 남은 조각이 부스러기로 흩어져요)
  sound: true,     // 웹오디오로 아삭 소리 (파일 없음)
  vibrate: true    // 진동 (지원하는 기기만)
};

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const CRUMB_COLORS = ['#f2c27a', '#e6aa5c', '#d68a2d', '#f8d89b', '#c9993f'];

/* ---------- 소리 (웹오디오) ---------- */
let ac = null, noiseBuf = null;
function audio() {
  if (!EAT.sound) return null;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch (e) { return null; }
}
function noise(ctx) {
  if (!noiseBuf) {
    const n = Math.floor(ctx.sampleRate * 0.25);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function crunch(last) {                       // 짧은 잡음 3~4번 = 아삭
  const ctx = audio(); if (!ctx) return;
  const t0 = ctx.currentTime;
  const hits = last ? 4 : 3;
  let t = t0;
  for (let i = 0; i < hits; i++) {
    t += i ? rand(0.03, 0.055) : 0;
    const dur = rand(0.045, 0.09);
    const src = ctx.createBufferSource(); src.buffer = noise(ctx);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rand(1400, 3600); f.Q.value = rand(0.7, 1.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(rand(0.25, 0.45), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t, rand(0, 0.1)); src.stop(t + dur + 0.02);
  }
}
function gulp() {                             // 꿀꺽
  const ctx = audio(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.16);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.22);
}
const buzz = p => { if (EAT.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };

/* ---------- 마스크 (구멍 = 투명한 원) ---------- */
// 한 겹 = "원 안은 투명, 밖은 불투명". 여러 겹을 intersect 로 겹치면 구멍들의 합집합이 돼요.
const holeLayer = (x, y, r) =>
  `radial-gradient(circle ${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, transparent ${Math.max(0, r - 1).toFixed(1)}px, #000 ${r.toFixed(1)}px)`;

function newBite(cx, cy) {                    // 모든 값은 토스트 가로폭(W)에 대한 비율 → 크기가 바뀌어도 그대로
  const R = rand(0.24, 0.30);
  const teeth = 8 + Math.floor(Math.random() * 4);
  const a0 = rand(0, TAU);
  const dots = [];
  for (let i = 0; i < teeth; i++) {
    const a = a0 + (i * TAU) / teeth + rand(-0.12, 0.12);
    const d = R * rand(0.94, 1.02);
    dots.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: R * rand(0.14, 0.25) });   // 크기가 다른 작은 원 = 이빨 자국
  }
  return { x: cx, y: cy, r: R, dots };
}

export function attachEating(wrap, toast, { onChange, onEaten } = {}) {
  const body = toast.querySelector('.toast-body');
  const bites = [];
  let done = false, ready = false, dead = false;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); };

  toast.tabIndex = 0;
  toast.setAttribute('role', 'button');
  toast.setAttribute('aria-label', '토스트 한 입 먹기');

  function paint() {
    const W = toast.clientWidth;
    if (!bites.length || !W) { body.style.maskImage = body.style.webkitMaskImage = ''; return; }
    const layers = [];
    for (const b of bites) {
      layers.push(holeLayer(b.x * W, b.y * W, b.r * W));
      for (const d of b.dots) layers.push(holeLayer((b.x + d.x) * W, (b.y + d.y) * W, d.r * W));
    }
    const v = layers.join(',');
    body.style.webkitMaskImage = v; body.style.maskImage = v;
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(paint) : null;
  if (ro) ro.observe(toast);

  function covered(x, y) {                    // 이미 먹힌 자리인지
    const W = toast.clientWidth;
    return bites.some(b =>
      Math.hypot(x - b.x * W, y - b.y * W) < b.r * W ||
      b.dots.some(d => Math.hypot(x - (b.x + d.x) * W, y - (b.y + d.y) * W) < d.r * W));
  }

  /* ----- 부스러기 ----- */
  function crumb(x, y, size) {
    const el = document.createElement('i');
    el.className = 'crumb';
    el.style.cssText = `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${size.toFixed(1)}px;height:${(size * rand(0.7, 1.1)).toFixed(1)}px;background:${CRUMB_COLORS[Math.floor(Math.random() * CRUMB_COLORS.length)]}`;
    wrap.append(el);
    return el;
  }
  function burst(x, y) {                      // 한 입 먹을 때 튀는 부스러기 (떨어지면서 사라짐)
    if (reduceMotion()) return;
    const W = toast.clientWidth, n = 9 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const el = crumb(x + rand(-8, 8), y + rand(-8, 8), W * rand(0.008, 0.018));
      const dx = rand(-0.18, 0.18) * W, up = rand(0.04, 0.12) * W, fall = rand(0.1, 0.3) * W, rot = rand(-260, 260);
      el.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1, easing: 'ease-out' },
        { transform: `translate(${dx * 0.6}px,${-up}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.35, easing: 'ease-in' },
        { transform: `translate(${dx}px,${fall}px) rotate(${rot}deg)`, opacity: 0 }
      ], { duration: rand(650, 1000), fill: 'forwards' }).onfinish = () => el.remove();
    }
  }
  function crumble() {                        // 마지막: 남은 조각이 흩어지고 접시 위에 부스러기만 남아요
    const W = toast.clientWidth, H = toast.clientHeight, still = reduceMotion();
    body.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.94)' }],
      { duration: still ? 1 : 260, easing: 'ease-in', fill: 'forwards' });
    let made = 0;
    for (let tries = 0; made < 38 && tries < 500; tries++) {
      const x = rand(0.05, 0.95) * W, y = rand(0.04, 0.96) * H;
      if (covered(x, y)) continue;
      made++;
      const el = crumb(x, y, W * rand(0.008, 0.02));
      const tx = W * (0.5 + rand(-0.42, 0.42)) - x, ty = H * (0.5 + rand(-0.12, 0.28)) - y, rot = rand(-200, 200);
      if (still) { el.style.transform = `translate(${tx}px,${ty}px) rotate(${rot}deg)`; continue; }
      el.animate([
        { transform: 'translate(0,0) rotate(0deg)' },
        { transform: `translate(${tx * 0.5}px,${ty * 0.5 - rand(0.02, 0.08) * W}px) rotate(${rot * 0.5}deg)`, offset: 0.4, easing: 'ease-in' },
        { transform: `translate(${tx}px,${ty}px) rotate(${rot}deg)` }
      ], { duration: rand(600, 1100), delay: rand(0, 160), easing: 'ease-out', fill: 'both' });
    }
    gulp(); buzz([20, 30, 20]);
    later(() => { toast.classList.add('eaten'); onChange && onChange('eaten', bites.length, EAT.bites); onEaten && onEaten(); }, still ? 0 : 520);
  }

  /* ----- 한 입 ----- */
  function bite(x, y) {
    if (done || !ready || dead || covered(x, y)) return;
    const W = toast.clientWidth;
    bites.push(newBite(x / W, y / W));
    toast.classList.add('bitten');
    paint();
    burst(x, y);
    const last = bites.length >= EAT.bites;
    crunch(last); buzz(12);
    if (!reduceMotion()) body.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(.975) rotate(${rand(-1.5, 1.5).toFixed(2)}deg)` }, { transform: 'scale(1)' }],
      { duration: 150, easing: 'ease-out' });
    if (last) { done = true; onChange && onChange('last', bites.length, EAT.bites); later(crumble, 280); }
    else onChange && onChange('eating', bites.length, EAT.bites);
  }

  toast.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = toast.getBoundingClientRect();
    const k = toast.clientWidth / (r.width || 1);
    bite((e.clientX - r.left) * k, (e.clientY - r.top) * k);
  });
  toast.addEventListener('keydown', e => {    // 키보드: Enter / Space
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const W = toast.clientWidth, H = toast.clientHeight;
    for (let i = 0; i < 20; i++) {
      const x = rand(0.1, 0.9) * W, y = rand(0.1, 0.9) * H;
      if (!covered(x, y)) { bite(x, y); break; }
    }
  });

  // 떨어지는 애니메이션(.9초)이 끝나야 먹을 수 있어요
  later(() => { ready = true; }, 950);

  return {
    // 다시 먹기: 구멍·부스러기를 치우고 토스트를 새로 떨어뜨려요
    reset() {
      if (dead) return;
      timers.forEach(clearTimeout); timers.clear();
      bites.length = 0; done = false; ready = false;
      body.getAnimations().forEach(a => a.cancel());
      wrap.querySelectorAll('.crumb').forEach(c => c.remove());
      toast.classList.remove('bitten', 'eaten', 'drop');
      paint();
      void toast.offsetWidth;
      toast.classList.add('drop');
      later(() => { ready = true; }, 950);
      onChange && onChange('idle', 0, EAT.bites);
    },
    destroy() { dead = true; timers.forEach(clearTimeout); timers.clear(); if (ro) ro.disconnect(); }
  };
}
