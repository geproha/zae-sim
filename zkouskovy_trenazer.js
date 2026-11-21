/* ZAE — zkouškový trenažér vstupního testu. Data: vstupni_test_verze.js (generuje zkouska_test.py). */
'use strict';
const D = window.ZAE_TEST;
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const Q = ['ot01', 'ot02', 'ot03', 'ot04', 'ot05', 'ot06', 'ot07', 'ot08', 'ot09', 'ot10'];

// ------------------------------------------------------------------ čísla
function mant(x) { const e = Math.floor(Math.log10(Math.abs(x)) + 1e-9); return [x / 10 ** e, e]; }
function fe(x, d = 3) { // KaTeX
  if (!isFinite(x)) return '?';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 0.01 && a < 1e4) return (+x.toPrecision(d)).toString().replace('-', '-').replace('.', '{,}');
  const [m, e] = mant(x); const ms = (+m.toPrecision(d)).toString().replace('.', '{,}');
  return (ms === '1' ? '' : ms + '\\cdot ') + '10^{' + e + '}';
}
function fh(x, d = 3) { // HTML
  if (!isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 0.01 && a < 1e4) return (+x.toPrecision(d)).toString().replace('-', '−').replace('.', ',');
  const [m, e] = mant(x); const ms = (+m.toPrecision(d)).toString().replace('.', ',').replace('-', '−');
  return (ms === '1' ? '' : ms + '·') + '10<sup>' + e + '</sup>';
}
const ft = x => fh(x).replace(/<sup>(.*?)<\/sup>/g, '^$1').replace(/−/g, '-');
const fd = (x, d = 1) => Number(x).toFixed(d).replace('-', '−').replace('.', ',');
const html = s => s.replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/_(\d)/g, '<sub>$1</sub>').replace(/-(?=\d)/g, '−');

// ------------------------------------------------------------------ přenosy
const cx = (re, im) => ({ re, im });
const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cabs = a => Math.hypot(a.re, a.im);
function Fb(b, w) { return b.typ === 'integracni' ? cdiv(cx(1, 0), cx(0, w * b.tau)) : cdiv(cx(b.k, 0), cx(1, w * b.tau)); }
function Fa(b, w) { return b.typ === 'integracni' ? 1 / (w * b.tau) : (w * b.tau < 1 ? b.k : b.k / (w * b.tau)); }
function ph(b, w) { return b.typ === 'integracni' ? -90 : -Math.atan(w * b.tau) * 180 / Math.PI; }
const db = x => 20 * Math.log10(x);

// ------------------------------------------------------------------ stav
const S = { vi: 0, mode: 'sam', ans: {}, rev: {}, lgK: 0, tauR: 1, wcur: null, show: { f1: true, f2: true, fo: true, kfo: true, as: true } };
function V() { return D.verze[S.vi]; }
function R() { return D.kontrola[S.vi].otazky; }

function omegaCross(K) { // přesná frekvence řezu |K Fo| = 1
  const v = V(); let lo = 1e-14, hi = 1e16;
  for (let i = 0; i < 200; i++) { const m = Math.sqrt(lo * hi); if (K * cabs(Fb(v.F1, m)) * cabs(Fb(v.F2, m)) > 1) lo = m; else hi = m; }
  return Math.sqrt(lo * hi);
}
function rangeW() {
  const v = V(), t = [v.F1.tau, v.F2.tau];
  return [10 ** (Math.floor(Math.log10(1 / Math.max(...t))) - 2), 10 ** (Math.ceil(Math.log10(1 / Math.min(...t))) + 2)];
}

// ------------------------------------------------------------------ blokové schéma
function schema() {
  const v = V(), Y = 70;
  const blk = (x, w, top, bot, cap) => `<rect x="${x}" y="${Y - 28}" width="${w}" height="56" rx="4" class="b"/>` + (bot ? `<text class="tf" x="${x + w / 2}" y="${Y - 7}">${top}</text><line x1="${x + 10}" x2="${x + w - 10}" y1="${Y}" y2="${Y}" class="fr"/><text class="tf" x="${x + w / 2}" y="${Y + 19}">${bot}</text>` : `<text class="tf" x="${x + w / 2}" y="${Y + 6}">${top}</text>`) + `<text class="cap" x="${x + w / 2}" y="${Y + 46}">${cap}</text>`;
  const s1 = t => `<tspan baseline-shift="sub" font-size="72%">${t}</tspan>`;
  const tf = (b, i) => b.typ === 'integracni' ? ['1', `pτ${s1(i)}`] : [`k${s1(i)}`, `1 + pτ${s1(i)}`];
  const cap = (b, i) => b.typ === 'integracni' ? `integrační, τ${i} = ${ft(b.tau)} s` : `k${i} = ${ft(b.k)}, τ${i} = ${ft(b.tau)} s`;
  const [a1, b1] = tf(v.F1, 1), [a2, b2] = tf(v.F2, 2);
  return `<svg viewBox="0 0 720 150" role="img" aria-label="Regulační smyčka verze ${v.verze}">
<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink2)"/></marker></defs>
<style>.w{fill:none;stroke:var(--ink2);stroke-width:1.6}.b{fill:var(--card);stroke:var(--ink);stroke-width:1.5}.tf{font:italic 15px "Times New Roman",serif;fill:var(--ink);text-anchor:middle}.fr{stroke:var(--ink)}.cap{font:11px system-ui,sans-serif;fill:var(--muted);text-anchor:middle}.sg{font:bold 14px system-ui;fill:var(--ink);text-anchor:middle}.sig{font:italic 15px "Times New Roman",serif;fill:var(--ink);text-anchor:middle}.gen{font:12px system-ui;fill:var(--muted);text-anchor:middle}</style>
<path class="w" d="M10,${Y} H72" marker-end="url(#ar)"/><text class="sig" x="30" y="${Y - 10}">w</text>
<circle cx="85" cy="${Y}" r="13" class="b"/><path d="M75.8,${Y - 9.2} L94.2,${Y + 9.2} M75.8,${Y + 9.2} L94.2,${Y - 9.2}" style="stroke:var(--ink)"/><text class="sg" x="64" y="${Y - 8}">+</text><text class="sg" x="72" y="${Y + 28}">−</text>
<path class="w" d="M98,${Y} H140" marker-end="url(#ar)"/><text class="sig" x="118" y="${Y - 10}">e</text>
${blk(140, 120, 'Reg', '', 'P: K · PI: K(1 + 1/pτ_R)')}
<path class="w" d="M260,${Y} H310" marker-end="url(#ar)"/><text class="sig" x="285" y="${Y - 10}">u</text>
${blk(310, 120, a1, b1, cap(v.F1, 1))}<text class="sig" x="300" y="${Y - 34}" style="font-size:13px">F₁</text>
<path class="w" d="M430,${Y} H480" marker-end="url(#ar)"/>
${blk(480, 120, a2, b2, cap(v.F2, 2))}<text class="sig" x="470" y="${Y - 34}" style="font-size:13px">F₂</text>
<path class="w" d="M600,${Y} H700" marker-end="url(#ar)"/><text class="sig" x="680" y="${Y - 10}">y</text>
<circle cx="650" cy="${Y}" r="3" style="fill:var(--ink2)"/><path class="w" d="M650,${Y} V132 H85 V${Y + 13}" marker-end="url(#ar)"/>
<text class="gen" x="370" y="146">jednotková záporná zpětná vazba · F<tspan baseline-shift="sub" font-size="72%">o</tspan> = Reg · F₁ · F₂ (rozpojená smyčka)</text></svg>`;
}

// ------------------------------------------------------------------ graf s log osou
function drawLog(cv, cfg) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const L = 56, Rm = 12, T = 8, B = 24, pw = W - L - Rm, ph_ = H - T - B;
  const lx0 = Math.log10(cfg.x0), lx1 = Math.log10(cfg.x1);
  const N = 700, xs = []; for (let i = 0; i <= N; i++) xs.push(10 ** (lx0 + (lx1 - lx0) * i / N));
  const data = cfg.series.map(s => xs.map(s.f));
  let lo = cfg.ymin, hi = cfg.ymax;
  if (lo == null) { lo = Infinity; hi = -Infinity; data.forEach((d, k) => { if (cfg.series[k].range === false) return; d.forEach(y => { if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }); }); const p = (hi - lo || 1) * 0.06; lo -= p; hi += p; }
  const X = w => L + (Math.log10(w) - lx0) / (lx1 - lx0) * pw, Yp = y => T + (1 - (y - lo) / (hi - lo)) * ph_;
  g.font = '11px system-ui,sans-serif'; g.lineWidth = 1;
  // mřížka: dekády + log mřížka testu 1,78 3,16 5,62
  for (let e = Math.floor(lx0); e <= Math.ceil(lx1); e++) for (const m of [1, 1.78, 3.16, 5.62]) {
    const w = m * 10 ** e; if (w < cfg.x0 || w > cfg.x1) continue;
    g.strokeStyle = css('--grid'); g.globalAlpha = m === 1 ? 1 : 0.55; g.beginPath(); g.moveTo(X(w), T); g.lineTo(X(w), T + ph_); g.stroke(); g.globalAlpha = 1;
    if (m === 1) { g.fillStyle = css('--ink2'); g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('10', X(w) - 3, T + ph_ + 6); g.font = '9px system-ui'; g.fillText(String(e), X(w) + 8, T + ph_ + 3); g.font = '11px system-ui,sans-serif'; }
  }
  const st = cfg.ystep || (() => { const r = (hi - lo) / 5, m = 10 ** Math.floor(Math.log10(r)); return [1, 2, 2.5, 5, 10].map(k => k * m).find(s => (hi - lo) / s <= 6); })();
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let y = Math.ceil(lo / st) * st; y <= hi; y += st) { g.strokeStyle = css('--grid'); g.beginPath(); g.moveTo(L, Yp(y)); g.lineTo(L + pw, Yp(y)); g.stroke(); g.fillStyle = css('--ink2'); g.fillText(fd(y, 0), L - 6, Yp(y)); }
  for (const hl of cfg.hlines || []) { g.strokeStyle = css(hl.c); g.setLineDash(hl.dash || []); g.lineWidth = 1.2; g.beginPath(); g.moveTo(L, Yp(hl.y)); g.lineTo(L + pw, Yp(hl.y)); g.stroke(); g.setLineDash([]); if (hl.t) { g.fillStyle = css(hl.c); g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(hl.t, L + 4, Yp(hl.y) - 2); } }
  g.save(); g.translate(12, T + ph_ / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = css('--ink2'); g.fillText(cfg.ylabel, 0, 0); g.restore();
  g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = css('--muted'); g.fillText('ω [s⁻¹]', 2, T + ph_ + 6);
  g.save(); g.beginPath(); g.rect(L, T, pw, ph_); g.clip();
  data.forEach((d, k) => {
    const s = cfg.series[k]; g.strokeStyle = css(s.c); g.lineWidth = s.w || 2; g.setLineDash(s.dash || []); g.beginPath();
    let pen = false; d.forEach((y, i) => { if (!isFinite(y)) { pen = false; return; } const px = X(xs[i]), py = Yp(Math.max(lo - 1e3, Math.min(hi + 1e3, y))); pen ? g.lineTo(px, py) : g.moveTo(px, py); pen = true; }); g.stroke();
  });
  g.setLineDash([]);
  for (const vl of cfg.vlines || []) { g.strokeStyle = css(vl.c); g.setLineDash(vl.dash || [4, 3]); g.lineWidth = 1.3; g.beginPath(); g.moveTo(X(vl.w), T); g.lineTo(X(vl.w), T + ph_); g.stroke(); g.setLineDash([]); if (vl.t) { g.fillStyle = css(vl.c); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(vl.t, X(vl.w) + 4, T + 2); } }
  if (cfg.cursor) { g.strokeStyle = css('--ink2'); g.lineWidth = 1; g.beginPath(); g.moveTo(X(cfg.cursor), T); g.lineTo(X(cfg.cursor), T + ph_); g.stroke(); }
  g.restore();
  cv._m = { L, pw, lx0, lx1 };
}

function drawLin(cv, cfg) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const L = 56, Rm = 12, T = 8, B = 24, pw = W - L - Rm, ph_ = H - T - B;
  let lo = 0, hi = 1.1; cfg.series.forEach(s => s.y.forEach(y => { if (isFinite(y)) { hi = Math.max(hi, y); lo = Math.min(lo, y); } })); hi *= 1.05;
  const X = t => L + t / cfg.T * pw, Yp = y => T + (1 - (y - lo) / (hi - lo)) * ph_;
  g.font = '11px system-ui,sans-serif';
  const st = hi - lo > 3 ? 1 : 0.25;
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let y = Math.ceil(lo / st) * st; y <= hi; y += st) { g.strokeStyle = css('--grid'); g.beginPath(); g.moveTo(L, Yp(y)); g.lineTo(L + pw, Yp(y)); g.stroke(); g.fillStyle = css('--ink2'); g.fillText(fd(y, 2), L - 6, Yp(y)); }
  const tt = cfg.T / 5, [m, e] = mant(tt), step = [1, 2, 2.5, 5, 10].find(k => k >= m) * 10 ** e;
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let t = 0; t <= cfg.T + 1e-12; t += step) { g.strokeStyle = css('--grid'); g.beginPath(); g.moveTo(X(t), T); g.lineTo(X(t), T + ph_); g.stroke(); g.fillStyle = css('--ink2'); g.fillText(ft(t), X(t), T + ph_ + 6); }
  g.textAlign = 'left'; g.fillStyle = css('--muted'); g.fillText('t [s]', 2, T + ph_ + 6);
  g.save(); g.translate(12, T + ph_ / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = css('--ink2'); g.fillText('y', 0, 0); g.restore();
  for (const b of cfg.bands || []) { g.fillStyle = css('--grid'); g.globalAlpha = .6; g.fillRect(L, Yp(b[1]), pw, Yp(b[0]) - Yp(b[1])); g.globalAlpha = 1; }
  g.save(); g.beginPath(); g.rect(L, T, pw, ph_); g.clip();
  cfg.series.forEach(s => { g.strokeStyle = css(s.c); g.lineWidth = s.w || 2; g.setLineDash(s.dash || []); g.beginPath(); s.t.forEach((t, i) => i ? g.lineTo(X(t), Yp(s.y[i])) : g.moveTo(X(t), Yp(s.y[i]))); g.stroke(); });
  g.restore(); g.setLineDash([]);
}

// ------------------------------------------------------------------ přechodová charakteristika
function krok(K, tauR, wc) {
  const v = V(), b1 = v.F1, b2 = v.F2;
  const d = (b, x, inp) => b.typ === 'integracni' ? inp / b.tau : (b.k * inp - x) / b.tau;
  const pi = tauR > 0, Ts = pi ? Math.min(400, Math.max(15, 6 * tauR * wc)) : 15, hs = 0.004;
  const n = Math.round(Ts / hs), every = Math.max(1, Math.floor(n / 800));
  let x1 = 0, x2 = 0, xi = 0; const t = [], y = [];
  const f = (x1, x2, xi) => { const e = 1 - x2, u = K * (e + (pi ? xi / tauR : 0)); return [d(b1, x1, u) / wc, d(b2, x2, x1) / wc, e / wc]; };
  for (let j = 0; j <= n; j++) {
    if (j % every === 0) { t.push(j * hs / wc); y.push(x2); }
    const a = f(x1, x2, xi), b = f(x1 + hs * a[0] / 2, x2 + hs * a[1] / 2, xi + hs * a[2] / 2), c = f(x1 + hs * b[0] / 2, x2 + hs * b[1] / 2, xi + hs * b[2] / 2), e = f(x1 + hs * c[0], x2 + hs * c[1], xi + hs * c[2]);
    x1 += hs * (a[0] + 2 * b[0] + 2 * c[0] + e[0]) / 6; x2 += hs * (a[1] + 2 * b[1] + 2 * c[1] + e[1]) / 6; xi += hs * (a[2] + 2 * b[2] + 2 * c[2] + e[2]) / 6;
    if (!isFinite(x2) || Math.abs(x2) > 1e6) break;
  }
  const yinf = pi || b1.typ === 'integracni' || b2.typ === 'integracni' ? 1 : K * b1.k * b2.k / (1 + K * b1.k * b2.k);
  let ts = 0; for (let i = y.length - 1; i >= 0; i--) if (Math.abs(y[i] - yinf) > 0.05 * Math.abs(yinf)) { ts = t[Math.min(i + 1, t.length - 1)]; break; }
  const over = Math.max(0, (Math.max(...y) - yinf) / yinf * 100);
  return { t, y, yinf, ts, over, unstable: Math.abs(y[y.length - 1] - yinf) > 0.5 * Math.abs(yinf) && pi };
}

// ------------------------------------------------------------------ postupy řešení
const blkTex = (b, i) => b.typ === 'integracni' ? String.raw`F_${i}=\dfrac{1}{p\tau_${i}}` : String.raw`F_${i}=\dfrac{k_${i}}{1+p\tau_${i}}`;
const asymTex = (b, i, w) => b.typ === 'integracni' ? String.raw`|F_${i}|=\dfrac{1}{\omega\tau_${i}}=\dfrac{1}{${fe(w)}\cdot ${fe(b.tau)}}=${fe(Fa(b, w))}` :
  (w * b.tau < 1 ? String.raw`\omega<1/\tau_${i}\Rightarrow |F_${i}|\approx k_${i}=${fe(b.k)}` : String.raw`\omega>1/\tau_${i}\Rightarrow |F_${i}|\approx\dfrac{k_${i}}{\omega\tau_${i}}=\dfrac{${fe(b.k)}}{${fe(w)}\cdot ${fe(b.tau)}}=${fe(Fa(b, w))}`);

function postup(q) {
  const v = V(), r = R()[q], o = v.otazky[q], p = o.param || {}, F1 = v.F1, F2 = v.F2;
  const lag = [F1, F2].filter(b => b.typ === 'setrvacny').sort((a, b) => a.tau - b.tau)[0];
  const li = lag === F1 ? 1 : 2;
  switch (q) {
    case 'ot01': {
      const b = v['F' + p.blok], i = p.blok, g = p.zesileni;
      const co = /dB/.test(o.text) ? String.raw`útlum o ${fe(-db(g), 2)}\,\mathrm{dB}\Rightarrow |F_${i}|=10^{-${fe(-db(g), 2)}/20}=${fe(g)}` : /tlumí/.test(o.text) ? String.raw`\text{tlumí } N\times \Rightarrow |F_${i}|=1/N=${fe(g)}` : String.raw`\text{zesiluje } N\times\Rightarrow |F_${i}|=${fe(g)}`;
      return String.raw`<p>Hledáme $\omega$, kde má blok $${blkTex(b, i)}$ danou amplitudu. Útlum je vždy nad zlomem, takže platí asymptota.</p>
$$${co}$$
$$${b.typ === 'integracni' ? String.raw`\frac{1}{\omega\tau_${i}}=|F_${i}|\Rightarrow\omega=\frac{1}{|F_${i}|\,\tau_${i}}` : String.raw`\frac{k_${i}}{\omega\tau_${i}}=|F_${i}|\Rightarrow\omega=\frac{k_${i}}{|F_${i}|\,\tau_${i}}=\frac{${fe(b.k)}}{${fe(g)}\cdot ${fe(b.tau)}}`}=${fe(r.asym)}\,\mathrm{s^{-1}}$$
<p>Přesně $${fe(r.presne)}$ — totéž, protože jsme daleko za zlomem.</p>`;
    }
    case 'ot02': {
      const b = v['F' + p.blok], i = p.blok;
      return String.raw`<p>Fáze setrvačného členu: $\varphi=-\arctan(\omega\tau_${i})$.</p>
$$\omega=\frac{\tan ${p.faze_deg}^\circ}{\tau_${i}}=\frac{${fe(Math.tan(p.faze_deg * Math.PI / 180), 3)}}{${fe(b.tau)}}=${fe(r.presne)}\,\mathrm{s^{-1}}\;\to\;${fe(r.mrizka)}$$
<p>Test zaokrouhluje na logaritmickou mřížku $1-1{,}78-3{,}16-5{,}62$ ($10^{k/4}$): $\tan 29^\circ=0{,}554\approx0{,}562$, $\tan 18^\circ=0{,}325\approx0{,}316$. Proto úhly 29° a 18° (a jejich doplňky 61° a 72°) — sedí přesně na mřížku.</p>`;
    }
    case 'ot03': {
      const w = p.omega, diff = r.vyber_presne !== o.spravne;
      return String.raw`<p>Rozpojená smyčka bez regulátoru $F_o=F_1F_2$: amplitudy se násobí (v dB sčítají). Asymptoty:</p>
$$${asymTex(F1, 1, w)}$$ $$${asymTex(F2, 2, w)}$$
$$|F_o|\approx${fe(Fa(F1, w))}\cdot${fe(Fa(F2, w))}=${fe(r.asym)}\qquad(\text{přesně } ${fe(r.presne)})$$
${diff ? String.raw`<p><b>Pozor:</b> PDF vybírá podle <b>asymptoty</b>. Přesná hodnota je u zlomu nižší (ve zlomu o 3 dB, tj. $1/\sqrt2$) a padla by na sousední možnost. U testu odečítej z asymptot.</p>` : '<p>Přesná i asymptotická hodnota vedou na stejnou možnost.</p>'}`;
    }
    case 'ot04': {
      const w = p.omega;
      return String.raw`<p>Fáze se sčítají; tady se počítá přesně (asymptota fáze je hrubá):</p>
$$\varphi_o=${F1.typ === 'integracni' ? '-90^\\circ' : String.raw`-\arctan(${fe(w)}\cdot${fe(F1.tau)})`}${F2.typ === 'integracni' ? '-90^\\circ' : String.raw`-\arctan(${fe(w)}\cdot${fe(F2.tau)})`}=${fe(ph(F1, w), 3)}^\circ ${ph(F2, w) < 0 ? '' : '+'}${fe(ph(F2, w), 3)}^\circ=${fe(r.presne, 3)}^\circ$$`;
    }
    case 'ot05': case 'ot06': {
      const pm = p.pm_deg, add = 90 - pm;
      return String.raw`<p>Bezpečnost ve fázi $\gamma=180^\circ+\varphi_o(\omega_c)$, kde $|K F_o(j\omega_c)|=1$. P regulátor fázi nemění, posune jen amplitudu. Hledáme tedy $\omega$, kde $\varphi_o=-180^\circ+${pm}^\circ=${-180 + pm}^\circ$.</p>
<p>${F1.typ === 'integracni' || F2.typ === 'integracni' ? 'Integrátor dává trvale −90°' : 'Pomalejší setrvačný člen je tam už prakticky na −90°'}, zbytek ${add}° musí dodat rychlejší člen s $\tau=${fe(lag.tau)}$:</p>
$$\arctan(\omega\tau)=${add}^\circ\Rightarrow\omega_c=\frac{\tan ${add}^\circ}{\tau}=${fe(Math.tan(add * Math.PI / 180) / lag.tau)}\to${fe(r.omega_test)}\,\mathrm{s^{-1}}$$
$$K=\frac{1}{|F_o(j\omega_c)|}\approx\frac{1}{${fe(Fa(F1, r.omega_test))}\cdot${fe(Fa(F2, r.omega_test))}}=${fe(r.K_test)}$$
<p>Přesný výpočet: $\omega_c=${fe(r.omega_presne)}$, $K=${fe(r.K_presne)}$ — vede na stejnou možnost. Zkus to v Bodeho grafu tlačítkem „K pro ${pm}°“.</p>`;
    }
    case 'ot07':
      return String.raw`<p>Uzavřená smyčka se chová zhruba jako setrvačný člen s časovou konstantou $\approx 1/\omega_c$. Ustálí se za několik takových konstant:</p>
$$t_u\approx\frac{3\text{ až }5}{\omega_c}=\frac{3\text{ až }5}{${fe(r.omega_c)}}\approx${fe(3 / r.omega_c, 2)}\text{ až }${fe(r.odhad_5_wc, 2)}\,\mathrm{s}$$
<p>Simulace (pásmo ±5 %) dává $${fe(r.simulace_5proc)}\,\mathrm{s}$. Možnosti v testu jsou od sebe asi 30×, takže stačí řád. PDF uvádí $≈ 5/\omega_c$ pro bezpečnost 61° a $≈ 2\pi/\omega_c$ pro 72° — přesné pravidlo generátoru testu neznáme (<b>odhad</b>), jakékoli $c/\omega_c$ s $c$ mezi 1 a 29 vybere správnou možnost ve všech 10 verzích.</p>`;
    case 'ot08':
      return String.raw`<p>PI regulátor $K\left(1+\frac{1}{p\tau_R}\right)$ přidá zlom v $1/\tau_R$ a pod ním zpoždění fáze až −90°. Aby nepokazil bezpečnost ve fázi navrženou pro P, dáme zlom asi <b>o dekádu pod</b> $\omega_c$:</p>
$$\frac{1}{\tau_R}=\frac{\omega_c}{10}\Rightarrow\tau_R=\frac{10}{\omega_c}=\frac{10}{${fe(R().ot07.omega_c)}}=${fe(r.tau_R)}\,\mathrm{s}$$
<p>V $\omega_c$ pak PI ubere jen $\arctan(0{,}1)\approx5{,}7^\circ$. Ověř si to posuvníkem τ<sub>R</sub> u přechodové charakteristiky.</p>`;
    case 'ot09': {
      const pomer = r.pomer;
      return String.raw`<p>Rozhoduje poloha frekvence signálu vůči $\omega_c$ ($\approx${fe(r.omega_c)}\,\mathrm{s^{-1}}$). Amplituda a fázový posun signálu jsou jen „vata“.</p>
$$\frac{\omega_s}{\omega_c}=\frac{${fe(p.omega)}}{${fe(r.omega_c)}}=${fe(pomer)},\qquad |F_w(j\omega_s)|=\left|\frac{KF_o}{1+KF_o}\right|=${fe(r.abs_Fw)}$$
<p>${pomer < 1 ? 'Hluboko pod ω<sub>c</sub> je |KF<sub>o</sub>| ≫ 1, takže F<sub>w</sub> ≈ 1: výstup je <b>stejný</b> jako požadavek, smyčka sleduje — <b>to je dobře</b>.' : 'Vysoko nad ω<sub>c</sub> je |KF<sub>o</sub>| ≪ 1, takže F<sub>w</sub> ≈ KF<sub>o</sub>: výstup je <b>zatlumený</b>. Požadavek se na výstup nepřenese — <b>to není dobře</b>.'} Zesílení (rezonance) by hrozilo jen u ω<sub>c</sub> při malé bezpečnosti ve fázi; s 61° nebo 72° prakticky není.</p>`;
    }
    case 'ot10':
      return String.raw`<p>Číslicový regulátor musí vzorkovat výrazně rychleji než nejrychlejší děj ve smyčce, jinak se chová jinak než navržený spojitý. Pravidlo: perioda vzorkování aspoň 10× kratší než nejmenší časová konstanta:</p>
$$T_{vz}\le\frac{\tau_{min}}{10}\Rightarrow f_{vz}\ge\frac{10}{\tau_{min}}=\frac{10}{${fe(r.tau_min)}}=${fe(r.f_vz_min)}\,\mathrm{Hz}$$
<p>Správná odpověď je vždy „min“ (dolní mez). Frekvence řezu je $f_c=\omega_c/2\pi\approx${fe(r.f_c_Hz)}\,\mathrm{Hz}$; odpověď odpovídá zhruba 12× až 1000× $f_c$. Přesné pravidlo z přednášky neznáme (<b>odhad</b>): sedí $f_{vz}=c/\tau_{min}$ pro $c$ od 1,1 do 100 ve všech verzích.</p>`;
  }
  return '';
}

// ------------------------------------------------------------------ render
function render() {
  const v = V(), r = R(), K61 = r.ot06.K_test;
  if (!S.lgK) S.lgK = Math.log10(K61);
  $('vers').querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-current', i === S.vi));
  const motor = String.raw`<p style="margin:0;font-size:15px">Stejný typ smyčky jako u motoru: ${v.F1.typ === 'integracni' || v.F2.typ === 'integracni' ? 'tady je jeden blok <b>integrační</b> jako mechanika motoru $k\\Phi/(Jp)$ (bez tření)' : 'oba bloky jsou <b>setrvačné</b>, jako kotva $\\frac{1/R}{1+p\\tau_a}$ (elektrická/proudová časová konstanta $\\tau_a=L/R$) a mechanika s třením $\\frac{1/B}{1+pJ/B}$ (mechanická časová konstanta)'}. Návrh P zesílení pro bezpečnost ve fázi je přesně to, co ZAE14 str. 10 dělá pro $K_{ri}$ proudové smyčky (45°). <a href="index.html#krok4">Výklad motoru, krok 4</a></p>`;
  $('app').innerHTML = `
<h2>Verze ${v.verze} <span class="note">(kód ${v.kod}, PDF str. ${v.strana})</span></h2>
<div class="duo"><div class="card schema"><h3>Regulační smyčka</h3><div class="scroll">${schema()}</div></div>
<div class="card"><h3>Parametry a vazba na motor</h3><p class="params">$${blkTex(v.F1, 1)},\\quad ${blkTex(v.F2, 2)}$</p><p class="params">${html(v.parametry_text.replace(/τ/g, 'τ'))}</p>${motor}</div></div>
<div class="card charts"><h3>Bodeho charakteristiky (plně přesně, čárkovaně asymptoty)</h3>
<div class="chleg" id="lg_b"></div>
<div class="ch"><canvas id="cv_a"></canvas><div class="tip" id="tp_a"></div></div>
<div class="ch"><canvas id="cv_f"></canvas><div class="tip" id="tp_f"></div></div>
<div class="controls" style="margin-top:8px"><div class="ctl"><label for="lgK"><span>Zesílení P regulátoru K</span><output id="oK"></output></label><input type="range" id="lgK" min="${(Math.log10(K61) - 3).toFixed(2)}" max="${(Math.log10(K61) + 3).toFixed(2)}" step="0.01" value="${S.lgK}"></div>
<div class="row" style="margin:0"><label><input type="checkbox" id="snap"> přichytit na mřížku 1–1,78–3,16–5,62</label></div></div>
<div class="row"><button class="btn" data-pm="45">K pro 45° (ot05)</button><button class="btn" data-pm="${v.otazky.ot06.param.pm_deg}">K pro ${v.otazky.ot06.param.pm_deg}° (ot06)</button></div>
<div class="read" id="rdB"></div>
<p class="note">Svislé čáry mřížky: dekády a body 1,78 / 3,16 / 5,62 (tak jsou v testu voleny hodnoty). Najetím myší odečteš hodnoty.</p></div>
<div class="card charts small"><h3>Přechodová charakteristika uzavřené smyčky (skok w = 1)</h3>
<div class="chleg"><span><i style="--c:var(--p)"></i> P regulátor K</span><span><i style="--c:var(--pi)"></i> PI regulátor K, τ<sub>R</sub></span><span><i class="dash" style="--c:var(--ref)"></i> w</span><span>šedý pás ±5 % (P)</span></div>
<canvas id="cv_t"></canvas>
<div class="controls" style="margin-top:8px"><div class="ctl"><label for="lgT"><span>Integrační časová konstanta τ<sub>R</sub></span><output id="oT"></output></label><input type="range" id="lgT" step="0.01"></div>
<div class="row" style="margin:0"><button class="btn" id="tau10">τ<sub>R</sub> = 10/ω<sub>c</sub> (ot08)</button></div></div>
<div class="read" id="rdT"></div></div>
<h2>Otázky ot01–ot10</h2><div id="qs"></div>
<div class="card"><h3>Přehled verzí (výpočet = řešení PDF)</h3><div class="scroll" id="tbl"></div></div>`;
  // ovládání
  const tauR0 = r.ot08.tau_R;
  $('lgT').min = (Math.log10(tauR0) - 2).toFixed(2); $('lgT').max = (Math.log10(tauR0) + 2).toFixed(2);
  if (!S.tauR || S.tauRv !== S.vi) { S.tauR = tauR0; S.tauRv = S.vi; }
  $('lgT').value = Math.log10(S.tauR);
  $('lgK').addEventListener('input', e => { S.lgK = +e.target.value; if ($('snap').checked) S.lgK = Math.log10(snap(10 ** S.lgK)); draw(); });
  $('lgT').addEventListener('input', e => { S.tauR = 10 ** +e.target.value; drawStep(); });
  $('tau10').addEventListener('click', () => { S.tauR = 10 / omegaCross(10 ** S.lgK); $('lgT').value = Math.log10(S.tauR); drawStep(); });
  document.querySelectorAll('[data-pm]').forEach(b => b.addEventListener('click', () => { const q = +b.dataset.pm === 45 ? 'ot05' : 'ot06'; S.lgK = Math.log10(R()[q].K_test); $('lgK').value = S.lgK; draw(); }));
  for (const id of ['cv_a', 'cv_f']) { const cv = $(id); cv.addEventListener('pointermove', e => hover(e, id)); cv.addEventListener('pointerleave', () => { S.wcur = null; $('tp_a').style.display = $('tp_f').style.display = 'none'; draw(true); }); }
  renderQs(); renderTable(); math($('app')); draw();
}
function snap(x) { const [m, e] = mant(x); const g = [1, 1.78, 3.16, 5.62, 10].reduce((a, b) => Math.abs(Math.log10(m / b)) < Math.abs(Math.log10(m / a)) ? b : a); return g * 10 ** e; }

function legendB() {
  const items = [['f1', '--f1', 'F₁'], ['f2', '--f2', 'F₂'], ['fo', '--fo', 'F_o = F₁F₂ (bez reg.)'], ['kfo', '--kfo', 'K·F_o (s P reg.)'], ['as', '--ref', 'asymptoty']];
  $('lg_b').innerHTML = items.map(([k, c, t]) => `<label><input type="checkbox" data-s="${k}" ${S.show[k] ? 'checked' : ''}><i class="${k === 'as' ? 'dash' : ''}" style="--c:var(${c})"></i>${t}</label>`).join('');
  $('lg_b').querySelectorAll('input').forEach(i => i.addEventListener('change', () => { S.show[i.dataset.s] = i.checked; draw(); }));
}

function draw(noStep) {
  const v = V(), K = 10 ** S.lgK, [w0, w1] = rangeW(), wc = omegaCross(K);
  const pmNow = 180 + ph(v.F1, wc) + ph(v.F2, wc);
  if (!$('lg_b').innerHTML) legendB();
  $('oK').innerHTML = fh(K);
  const A = [], P = [], as = S.show.as;
  const add = (on, c, fa, fx, fp, w) => { if (!on) return; A.push({ f: fx, c, w }); if (as && fa) A.push({ f: fa, c, dash: [6, 4], w: 1.4, range: false }); P.push({ f: fp, c, w }); };
  add(S.show.f1, '--f1', w => db(Fa(v.F1, w)), w => db(cabs(Fb(v.F1, w))), w => ph(v.F1, w));
  add(S.show.f2, '--f2', w => db(Fa(v.F2, w)), w => db(cabs(Fb(v.F2, w))), w => ph(v.F2, w));
  add(S.show.fo, '--fo', w => db(Fa(v.F1, w) * Fa(v.F2, w)), w => db(cabs(Fb(v.F1, w)) * cabs(Fb(v.F2, w))), w => ph(v.F1, w) + ph(v.F2, w));
  add(S.show.kfo, '--kfo', w => db(K * Fa(v.F1, w) * Fa(v.F2, w)), w => db(K * cabs(Fb(v.F1, w)) * cabs(Fb(v.F2, w))), w => ph(v.F1, w) + ph(v.F2, w), 2.6);
  const vl = [{ w: wc, c: '--kfo', t: `ω_c = ${ft(wc)}` }];
  drawLog($('cv_a'), { x0: w0, x1: w1, series: A, ylabel: '|F| [dB]', ystep: 20, hlines: [{ y: 0, c: '--ink2' }], vlines: vl, cursor: S.wcur });
  drawLog($('cv_f'), { x0: w0, x1: w1, series: P, ylabel: 'φ [°]', ymin: -195, ymax: 5, ystep: 45, hlines: [{ y: -180, c: '--ink2' }, { y: -180 + pmNow, c: '--kfo', dash: [3, 3], t: `bezpečnost ve fázi ${fd(pmNow, 1)}°` }], vlines: [{ w: wc, c: '--kfo' }], cursor: S.wcur });
  $('rdB').innerHTML = `<div><span>K</span><b>${fh(K)}</b></div><div><span>frekvence řezu ω<sub>c</sub></span><b>${fh(wc)} s⁻¹</b></div><div><span>fáze F<sub>o</sub>(jω<sub>c</sub>)</span><b>${fd(pmNow - 180, 1)}°</b></div><div><span>bezpečnost ve fázi γ</span><b>${fd(pmNow, 1)}°</b></div>`;
  if (!noStep) drawStep();
}
function drawStep() {
  const K = 10 ** S.lgK, wc = omegaCross(K);
  $('oT').innerHTML = fh(S.tauR) + ' s';
  const p = krok(K, 0, wc), pi = krok(K, S.tauR, wc);
  const T = Math.max(p.t[p.t.length - 1], Math.min(pi.t[pi.t.length - 1], 60 / wc));
  drawLin($('cv_t'), { T, bands: [[p.yinf * 0.95, p.yinf * 1.05]], series: [{ t: [0, T], y: [1, 1], c: '--ref', dash: [6, 4], w: 1.4 }, { t: pi.t, y: pi.y, c: '--pi' }, { t: p.t, y: p.y, c: '--p' }] });
  $('rdT').innerHTML = `<div><span>P: ustálená hodnota</span><b>${fd(p.yinf, 4)}</b></div><div><span>P: ustálení (±5 %)</span><b>${fh(p.ts)} s</b></div><div><span>P: překmit</span><b>${fd(p.over, 1)} %</b></div><div><span>PI: ustálení (±5 %)</span><b>${pi.unstable ? 'nestabilní' : fh(pi.ts) + ' s'}</b></div><div><span>PI: překmit</span><b>${fd(pi.over, 1)} %</b></div><div><span>odhad 5/ω<sub>c</sub></span><b>${fh(5 / wc)} s</b></div>`;
}
function hover(e, id) {
  const cv = e.currentTarget, m = cv._m; if (!m) return;
  const rect = cv.getBoundingClientRect(), x = e.clientX - rect.left;
  const w = 10 ** (m.lx0 + Math.max(0, Math.min(1, (x - m.L) / m.pw)) * (m.lx1 - m.lx0));
  S.wcur = w; draw(true);
  const v = V(), K = 10 ** S.lgK, Fo = cabs(Fb(v.F1, w)) * cabs(Fb(v.F2, w));
  const tp = $(id === 'cv_a' ? 'tp_a' : 'tp_f'), other = $(id === 'cv_a' ? 'tp_f' : 'tp_a'); other.style.display = 'none';
  tp.innerHTML = id === 'cv_a' ? `ω = ${fh(w)} · |F₁| ${fh(cabs(Fb(v.F1, w)))} · |F₂| ${fh(cabs(Fb(v.F2, w)))} · |F<sub>o</sub>| ${fh(Fo)} · |KF<sub>o</sub>| ${fh(K * Fo)}` : `ω = ${fh(w)} · φ₁ ${fd(ph(v.F1, w))}° · φ₂ ${fd(ph(v.F2, w))}° · φ<sub>o</sub> ${fd(ph(v.F1, w) + ph(v.F2, w))}°`;
  tp.style.display = 'block'; tp.style.left = Math.max(0, Math.min(x + 10, rect.width - tp.offsetWidth - 4)) + 'px';
}

function renderQs() {
  const v = V(); S.ans[S.vi] = S.ans[S.vi] || {}; S.rev[S.vi] = S.rev[S.vi] || {};
  $('qs').innerHTML = Q.map((q, n) => {
    const o = v.otazky[q];
    return `<div class="q" id="q_${q}"><p class="qt"><b>${q}</b> ${html(o.text)}</p><div class="opts">${o.moznosti.map(m => `<button data-q="${q}" data-l="${m.pismeno}">${m.pismeno}) ${html(m.text)}</button>`).join('')}</div>
<div class="verdict" id="vd_${q}"></div><details id="dt_${q}"><summary>Postup řešení</summary><div class="body">${postup(q)}</div></details></div>`;
  }).join('');
  $('qs').querySelectorAll('.opts button').forEach(b => b.addEventListener('click', () => { const q = b.dataset.q; if (S.rev[S.vi][q] && S.mode === 'sam') return; S.ans[S.vi][q] = b.dataset.l; S.rev[S.vi][q] = true; markQs(); }));
  $('qs').querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => { if (d.open && S.mode === 'sam') { const q = d.id.slice(3); if (!S.rev[S.vi][q]) { S.rev[S.vi][q] = true; markQs(); } } }));
  markQs();
}
function markQs() {
  const v = V(), A = S.ans[S.vi], Rv = S.rev[S.vi];
  let ok = 0, n = 0;
  for (const q of Q) {
    const corr = v.otazky[q].spravne, show = S.mode === 'uc' || Rv[q], a = A[q];
    document.querySelectorAll(`#q_${q} .opts button`).forEach(b => {
      b.className = ''; const l = b.dataset.l;
      if (show && l === corr) b.className = 'ok'; else if (show && a === l) b.className = 'ko'; else if (a === l) b.className = 'sel';
    });
    const vd = $('vd_' + q);
    if (a) { n++; if (a === corr) ok++; }
    vd.innerHTML = !show ? (S.mode === 'sam' ? '<span class="note">Vyber odpověď — vyhodnotí se hned. Postup se odkryje kliknutím na „Postup řešení“ (otázka se tím počítá jako vzdaná).</span>' : '') :
      a ? (a === corr ? '<span class="y">✓ Správně.</span>' : `<span class="n">✗ Špatně</span> — správně je ${corr}).`) : `Správně je ${corr}) <span class="note">(neodpovězeno)</span>`;
    $('dt_' + q).style.display = show || S.mode === 'sam' ? '' : 'none';
  }
  const all = Q.every(q => A[q]);
  $('score').innerHTML = `Body: <b>${ok}</b> / 10 · zodpovězeno ${n}${all ? ` · ${ok >= 7 ? '✓ uznáno, aspoň na trojku (7+)' : ok >= 6 ? '◐ uznáno (6), na trojku chybí bod' : '✗ neuznáno (méně než 6)'}` : ''} <button class="btn" id="resetq" style="margin-left:8px;padding:3px 10px">Znovu</button>`;
  $('resetq').addEventListener('click', () => { S.ans[S.vi] = {}; S.rev[S.vi] = {}; document.querySelectorAll('#qs details').forEach(d => d.open = false); markQs(); });
}
function renderTable() {
  const rows = D.verze.map((v, i) => {
    const r = D.kontrola[i].otazky, okc = Q.filter(q => r[q].shoda).length;
    const t = b => b.typ === 'integracni' ? `1/(p·${fh(b.tau)})` : `${fh(b.k)}/(1+p·${fh(b.tau)})`;
    return `<tr${i === S.vi ? ' style="background:var(--grid)"' : ''}><td>${v.verze}</td><td>${t(v.F1)}</td><td>${t(v.F2)}</td><td>${fh(r.ot05.K_test)}</td><td>${fh(r.ot06.K_test)} (${v.otazky.ot06.param.pm_deg}°)</td><td>${fh(r.ot06.omega_test)}</td><td>${fh(r.ot08.tau_R)}</td><td>${okc}/10</td></tr>`;
  }).join('');
  $('tbl').innerHTML = `<table><tr><th>Verze</th><th>F₁</th><th>F₂</th><th>K (45°)</th><th>K (ot06)</th><th>ω<sub>c</sub> [s⁻¹]</th><th>τ<sub>R</sub> [s]</th><th>shoda s PDF</th></tr>${rows}</table>`;
}
function math(el) { if (typeof renderMathInElement === 'function') renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); }

// ------------------------------------------------------------------ start
$('vers').innerHTML = D.verze.map((v, i) => `<button data-i="${i}">${v.verze}</button>`).join('');
$('vers').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.vi = +b.dataset.i; S.lgK = 0; try { history.replaceState(null, '', '#verze' + (S.vi + 1)); } catch (_) { } render(); });
$('mode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.mode = b.dataset.m; $('mode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); markQs(); });
const hv = /#verze(\d+)/.exec(location.hash); if (hv) S.vi = Math.min(9, Math.max(0, +hv[1] - 1));
if (/uceni/.test(location.hash)) { S.mode = 'uc'; $('mode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === 'uc')); }
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => draw(), 120); });
render();
if (/otevrit/.test(location.hash)) document.querySelectorAll('#qs details').forEach(d => d.open = true);
