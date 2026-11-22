/* ZAE · TEL2 — filtry, propusti a omezovače. Vlastní výukový model (ideální R, L, C; dioda exponenciálním modelem). */
'use strict';
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const PI2 = 2 * Math.PI;

// ------------------------------------------------------------------ čísla
function si(v, unit, d = 3) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0 ' + unit;
  const pre = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const a = Math.abs(v), [m, p] = pre.find(([m]) => a >= m * 0.9995) || pre[pre.length - 1];
  return (+(v / m).toPrecision(d)).toString().replace('-', '−').replace('.', ',') + ' ' + p + unit;
}
const fd = (x, d = 1) => !isFinite(x) ? '—' : Number(x).toFixed(d).replace('-', '−').replace('.', ',');
const tex = (v, unit) => si(v, unit).replace(',', '{,}').replace('µ', '\\mu ').replace(/ (\S*)$/, '\\,\\mathrm{$1}');

// ------------------------------------------------------------------ komplexní čísla
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im), mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cabs = a => Math.hypot(a.re, a.im), carg = a => Math.atan2(a.im, a.re) * 180 / Math.PI;

// ------------------------------------------------------------------ typy filtrů
// series: prvky v podélné větvi (nahoře), shunt: v příčné větvi (výstup je napětí na ní)
const ZR = (p, w) => C(p.R), ZL = (p, w) => C(0, w * p.L), ZC = (p, w) => C(0, -1 / (w * p.C));
const Z = { R: ZR, L: ZL, C: ZC };
const KIND = { dp1: 'Dolní propust 1. řádu', hp1: 'Horní propust 1. řádu', pp: 'Pásmová propust', pz: 'Pásmová zádrž', dp2: 'Dolní propust 2. řádu' };
const TYPES = {
  dpRC: { n: 'Dolní propust RC', kind: 'dp1', series: ['R'], shunt: ['C'], tex: 'K(j\\omega) = \\dfrac{1}{1 + j\\omega RC},\\qquad f_m = \\dfrac{1}{2\\pi RC}',
    why: 'Kondenzátor je na výstupu paralelně. Při nízké frekvenci má velkou impedanci (skoro rozpojený), takže výstup = vstup. Při vysoké frekvenci má malou impedanci a výstup zkratuje. Nízké frekvence projdou, vysoké se utlumí.' },
  dpRL: { n: 'Dolní propust RL', kind: 'dp1', series: ['L'], shunt: ['R'], tex: 'K(j\\omega) = \\dfrac{R}{R + j\\omega L} = \\dfrac{1}{1 + j\\omega L/R},\\qquad f_m = \\dfrac{R}{2\\pi L}',
    why: 'Cívka je v podélné větvi. Pro nízké frekvence je to skoro zkrat (signál projde), pro vysoké má velkou impedanci $j\\omega L$ a signál nepustí. Stejná rovnice jako proud kotvy motoru: $I/U = 1/(R + pL)$.' },
  hpCR: { n: 'Horní propust CR', kind: 'hp1', series: ['C'], shunt: ['R'], tex: 'K(j\\omega) = \\dfrac{j\\omega RC}{1 + j\\omega RC},\\qquad f_m = \\dfrac{1}{2\\pi RC}',
    why: 'Kondenzátor je v podélné větvi. Stejnosměrnou složku a nízké frekvence nepropustí (rozpojený), vysoké frekvence projdou (zkrat). Typické „oddělení stejnosměrné složky“.' },
  hpLR: { n: 'Horní propust RL', kind: 'hp1', series: ['R'], shunt: ['L'], tex: 'K(j\\omega) = \\dfrac{j\\omega L}{R + j\\omega L},\\qquad f_m = \\dfrac{R}{2\\pi L}',
    why: 'Cívka je na výstupu paralelně. Pro nízké frekvence výstup zkratuje, pro vysoké má velkou impedanci a napětí na ní zůstane.' },
  ppRLC: { n: 'Pásmová propust RLC', kind: 'pp', series: ['L', 'C'], shunt: ['R'], tex: 'K(j\\omega) = \\dfrac{R}{R + j\\left(\\omega L - \\frac{1}{\\omega C}\\right)},\\quad f_0 = \\dfrac{1}{2\\pi\\sqrt{LC}},\\quad Q = \\dfrac{1}{R}\\sqrt{\\dfrac{L}{C}}',
    why: 'Sériový rezonanční obvod L + C v podélné větvi. Při rezonanci $f_0$ se reaktance cívky a kondenzátoru vyruší ($\\omega L = 1/\\omega C$) a signál projde celý na R. Daleko pod $f_0$ blokuje kondenzátor, daleko nad $f_0$ cívka.' },
  pzRLC: { n: 'Pásmová zádrž RLC', kind: 'pz', series: ['R'], shunt: ['L', 'C'], tex: 'K(j\\omega) = \\dfrac{j\\left(\\omega L - \\frac{1}{\\omega C}\\right)}{R + j\\left(\\omega L - \\frac{1}{\\omega C}\\right)},\\qquad f_0 = \\dfrac{1}{2\\pi\\sqrt{LC}}',
    why: 'Sériové L + C je na výstupu paralelně. V rezonanci má nulovou impedanci a výstup zkratuje, takže právě kolem $f_0$ signál neprojde. Používá se k odstranění jedné rušivé frekvence (např. 50 Hz).' },
  dpRLC: { n: 'Dolní propust RLC (2. řád)', kind: 'dp2', series: ['R', 'L'], shunt: ['C'], tex: 'K(j\\omega) = \\dfrac{1}{1 - \\omega^2 LC + j\\omega RC},\\quad f_0 = \\dfrac{1}{2\\pi\\sqrt{LC}},\\quad \\zeta = \\dfrac{R}{2}\\sqrt{\\dfrac{C}{L}}',
    why: 'Napětí na kondenzátoru sériového RLC. Nad $f_0$ klesá dvakrát rychleji (−40 dB/dekádu). Při malém tlumení $\\zeta$ má u $f_0$ rezonanční převýšení — stejně jako kmitavý motor v kroku 1 výkladu.' }
};
function K(type, p, w) {
  const t = TYPES[type];
  const zs = t.series.reduce((a, e) => add(a, Z[e](p, w)), C(0)), zp = t.shunt.reduce((a, e) => add(a, Z[e](p, w)), C(0));
  return div(zp, add(zs, zp));
}
function charF(type, p) { const t = TYPES[type]; return t.series.concat(t.shunt).includes('C') && t.series.concat(t.shunt).includes('L') ? 1 / (PI2 * Math.sqrt(p.L * p.C)) : t.series.concat(t.shunt).includes('C') ? 1 / (PI2 * p.R * p.C) : p.R / (PI2 * p.L); }

// časová simulace: stavy jsou proud cívky a napětí kondenzátoru (sériový obvod), výstup = napětí na příčné větvi
function simuluj(type, p, u, T, N = 1500) {
  const t = TYPES[type], all = t.series.concat(t.shunt), hasL = all.includes('L'), hasC = all.includes('C');
  const shuntV = (i, uc, di) => t.shunt.reduce((a, e) => a + (e === 'R' ? p.R * i : e === 'C' ? uc : p.L * di), 0);
  // v sériovém obvodu teče všemi prvky stejný proud i: u = R i + L di/dt + u_C
  let wHi = 0; if (hasL) wHi = Math.max(wHi, p.R / p.L); if (hasC) wHi = Math.max(wHi, 1 / (p.R * p.C)); if (hasL && hasC) wHi = Math.max(wHi, 1 / Math.sqrt(p.L * p.C));
  const dtOut = T / N, sub = Math.max(1, Math.ceil(dtOut * wHi / 0.05)), h = dtOut / sub;
  let i = 0, uc = 0; const ts = [], y = [], x = [];
  const f = (tt, i, uc) => { const uu = u(tt); const di = hasL ? (uu - p.R * i - uc) / p.L : 0; const duc = hasC ? i / p.C : 0; return [di, duc, uu]; };
  for (let k = 0; k <= N; k++) {
    const tt = k * dtOut, uu = u(tt);
    let iNow = i, di = 0;
    if (!hasL) iNow = (uu - uc) / p.R; else di = (uu - p.R * i - uc) / p.L;
    ts.push(tt); x.push(uu); y.push(shuntV(iNow, uc, di));
    for (let s = 0; s < sub && k < N; s++) {
      const t0 = tt + s * h;
      if (hasL) {
        const a = f(t0, i, uc), b = f(t0 + h / 2, i + h / 2 * a[0], uc + h / 2 * a[1]), c = f(t0 + h / 2, i + h / 2 * b[0], uc + h / 2 * b[1]), d = f(t0 + h, i + h * c[0], uc + h * c[1]);
        i += h / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]); uc += h / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
      } else { // RC: i = (u − u_C)/R
        const g = (tt2, v) => (u(tt2) - v) / (p.R * p.C);
        const a = g(t0, uc), b = g(t0 + h / 2, uc + h / 2 * a), c = g(t0 + h / 2, uc + h / 2 * b), d = g(t0 + h, uc + h * c);
        uc += h / 6 * (a + 2 * b + 2 * c + d);
      }
    }
  }
  return { t: ts, u1: x, u2: y };
}

// ------------------------------------------------------------------ schéma (ČSN EN 60617)
function prvek(e, x, y, vert, val, nove) {
  const st = `style="fill:var(--card);stroke:${nove ? 'var(--new)' : 'var(--ink)'};stroke-width:1.8"`, ln = `style="fill:none;stroke:${nove ? 'var(--new)' : 'var(--ink)'};stroke-width:1.8"`;
  const lab = (lx, ly, anchor, vy) => `<text x="${lx}" y="${ly}" style="font:italic 15px 'Times New Roman',serif;fill:var(--ink);text-anchor:${anchor}">${e}</text>${val ? `<text x="${lx}" y="${vy != null ? vy : ly + 15}" style="font:11px system-ui;fill:var(--muted);text-anchor:${anchor}">${val}</text>` : ''}`;
  if (!vert) { // vodorovně, střed x, výška y, délka 50
    const a = x - 25, b = x + 25;
    if (e === 'R') return `<rect x="${a + 5}" y="${y - 8}" width="40" height="16" ${st}/>` + lab(x, y - 14, 'middle', y + 24);
    if (e === 'C') return `<path d="M${a},${y} H${x - 4} M${x + 4},${y} H${b}" style="stroke:var(--ink);stroke-width:1.8"/><path d="M${x - 4},${y - 13} V${y + 13} M${x + 4},${y - 13} V${y + 13}" ${ln}/>` + lab(x, y - 19, 'middle', y + 28);
    return `<path d="M${a},${y} h5 a5,5 0 0 1 10,0 a5,5 0 0 1 10,0 a5,5 0 0 1 10,0 a5,5 0 0 1 10,0 h5" ${ln}/>` + lab(x, y - 12, 'middle', y + 22);
  }
  const a = y - 25, b = y + 25; // svisle, střed y
  if (e === 'R') return `<rect x="${x - 8}" y="${a + 5}" width="16" height="40" ${st}/>` + lab(x + 16, y, 'start');
  if (e === 'C') return `<path d="M${x},${a} V${y - 4} M${x},${y + 4} V${b}" style="stroke:var(--ink);stroke-width:1.8"/><path d="M${x - 13},${y - 4} H${x + 13} M${x - 13},${y + 4} H${x + 13}" ${ln}/>` + lab(x + 19, y, 'start');
  return `<path d="M${x},${a} v5 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10 a5,5 0 0 1 0,10 v5" ${ln}/>` + lab(x + 12, y, 'start');
}
function schemaSVG(type, p, s = {}) {
  const t = TYPES[type], T = 50, B = 190, xn = 360, vals = { R: si(p.R, 'Ω'), L: si(p.L, 'H'), C: si(p.C, 'F') };
  let g = `<path d="M30,${T} H490 M30,${B} H490" style="fill:none;stroke:var(--ink2);stroke-width:1.6"/>`;
  g += `<circle cx="30" cy="${T}" r="4" style="fill:var(--card);stroke:var(--ink)"/><circle cx="30" cy="${B}" r="4" style="fill:var(--card);stroke:var(--ink)"/><circle cx="490" cy="${T}" r="4" style="fill:var(--card);stroke:var(--ink)"/><circle cx="490" cy="${B}" r="4" style="fill:var(--card);stroke:var(--ink)"/>`;
  g += `<path d="M48,${T + 14} V${B - 14}" style="stroke:var(--u1);stroke-width:1.6" marker-end="url(#fa)"/><text x="56" y="${(T + B) / 2 + 5}" style="font:italic 15px 'Times New Roman',serif;fill:var(--u1)">u₁</text>`;
  g += `<path d="M472,${T + 14} V${B - 14}" style="stroke:var(--u2);stroke-width:1.6" marker-end="url(#fa2)"/><text x="450" y="${(T + B) / 2 + 5}" style="font:italic 15px 'Times New Roman',serif;fill:var(--u2);text-anchor:end">u₂</text>`;
  const n = t.series.length, x0 = 120, x1 = 300;
  t.series.forEach((e, k) => { const x = n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * k / (n - 1); g += `<rect x="${x - 26}" y="${T - 3}" width="52" height="6" style="fill:var(--card)"/>` + prvek(e, x, T, false, s.vals === false ? '' : vals[e]); });
  const m = t.shunt.length, y0 = T + 25 + 8, yk = (B - T - 16 - 50 * m) / (m + 1);
  g += `<circle cx="${xn}" cy="${T}" r="3.2" style="fill:var(--ink2)"/><circle cx="${xn}" cy="${B}" r="3.2" style="fill:var(--ink2)"/><path d="M${xn},${T} V${B}" style="stroke:var(--ink2);stroke-width:1.6"/>`;
  t.shunt.forEach((e, k) => { const y = T + 8 + yk * (k + 1) + 50 * k + 25; g += `<rect x="${xn - 3}" y="${y - 26}" width="6" height="52" style="fill:var(--card)"/>` + prvek(e, xn, y, true, s.vals === false ? '' : vals[e]); });
  return `<svg viewBox="0 0 520 220" role="img" aria-label="Schéma: ${t.n}"><defs><marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--u1)"/></marker><marker id="fa2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--u2)"/></marker></defs>${g}</svg>`;
}

// ------------------------------------------------------------------ značky filtrů (IEC 60617 / ČSN EN 60617)
// čtverec se třemi vlnovkami nad sebou (nahoře vysoké, dole nízké frekvence); přeškrtnutá vlnovka = pásmo, které filtr nepropustí
// podle příručky „Grafické značky … podle databáze IEC 60617DB“ (ÚNMZ), str. 90–91:
// obecný filtr = jedna vlnovka (S01246), horní propust = dvě vlnovky, dolní přeškrtnutá (S01247);
// nahoře vyšší, dole nižší frekvence; přeškrtnuté = nepropuštěné. DP, PP, PZ stejným principem.
const VLNY = { obecny_f: [[36, 0]], dp1: [[28, 1], [44, 0]], dp2: [[28, 1], [44, 0]], hp1: [[28, 0], [44, 1]], pp: [[22, 1], [36, 0], [50, 1]], pz: [[22, 0], [36, 1], [50, 0]] };
function znackaSVG(kind, size = 72, opt = {}) {
  const vl = y => `M20,${y} q4,-8 8,-8 q4,0 8,8 q4,8 8,8 q4,0 8,-8`, cross = y => `<path d="M30,${y + 9} L42,${y - 9}" style="stroke:var(--new);stroke-width:2.2"/>`;
  const L = 'style="fill:none;stroke:var(--ink);stroke-width:2"';
  let g = `<path d="M0,36 H6 M66,36 H72" ${L}/><rect x="6" y="6" width="60" height="60" style="fill:var(--card);stroke:var(--ink);stroke-width:2"/>`;
  const k = kind === 'obecny' ? null : kind;
  if (VLNY[k]) VLNY[k].forEach(([y, c]) => { g += `<path d="${vl(y)}" style="fill:none;stroke:var(--ink);stroke-width:1.8"/>`; if (c) g += cross(y); });
  else if (kind === 'obecny') g += `<text x="36" y="42" style="font:italic 15px 'Times New Roman',serif;fill:var(--ink);text-anchor:middle">K(jω)</text>`;
  else if (kind === 'orez') g += `<path d="M18,50 L40,24 H56" ${L}/>`;
  else if (kind === 'prah') g += `<path d="M18,30 V48 M18,44 H34 L54,22" ${L}/>`;
  else if (kind === 'prahnast') g += `<path d="M18,30 V48 M18,44 H34 L54,22 M22,52 L46,28" ${L}/><path d="M46,28 l-8,1 m8,-1 l-2,8" ${L}/>`;
  else if (kind === 'prerus') g += `<path d="M6,36 H66" ${L}/><path d="M26,14 V28 L40,21 Z" style="fill:var(--ink)"/><path d="M40,14 V28 M18,21 H54" ${L}/><path d="M16,58 V46 H22 V58 H28 V46 H34 V58 H40 V46 H46 V58 H52" ${L}/>`;
  else if (kind === 'faz') g += `<text x="36" y="44" style="font:italic bold 20px 'Times New Roman',serif;fill:var(--ink);text-anchor:middle">φ</text>`;
  else if (kind === 'utlum') g += `<text x="36" y="44" style="font:italic 20px 'Times New Roman',serif;fill:var(--ink);text-anchor:middle">A</text>`;
  if (opt.text) g += `<text x="62" y="63" style="font:bold 9px system-ui;fill:var(--muted);text-anchor:end">${opt.text}</text>`;
  if (kind === 'dp2' && !opt.text) g += `<text x="62" y="63" style="font:bold 10px system-ui;fill:var(--muted);text-anchor:end">2</text>`;
  return `<svg viewBox="0 0 72 72" width="${size}" height="${size}" role="img" aria-label="Značka: ${KIND[kind] || kind}">${g}</svg>`;
}

// ------------------------------------------------------------------ grafy
function niceTicks(lo, hi, n = 5) { const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)); const st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => span / s <= n) || 10 * mag; const o = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-12; v += st) o.push(Math.abs(v) < st * 1e-6 ? 0 : v); return o; }
function chart(cv, cfg) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const L = 52, R = 10, T = 8, Bm = 24, pw = W - L - R, ph = H - T - Bm;
  const lx = cfg.logx, x0 = lx ? Math.log10(cfg.x0) : cfg.x0, x1 = lx ? Math.log10(cfg.x1) : cfg.x1;
  let lo = cfg.ymin, hi = cfg.ymax;
  if (lo == null) { lo = Infinity; hi = -Infinity; for (const s of cfg.series) if (s.range !== false) for (const v of s.y) if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } const pd = (hi - lo || 1) * 0.08; lo -= pd; hi += pd; }
  const X = v => L + ((lx ? Math.log10(v) : v) - x0) / (x1 - x0) * pw, Y = v => T + (1 - (v - lo) / (hi - lo)) * ph;
  g.font = '11px system-ui,sans-serif'; g.strokeStyle = css('--grid'); g.fillStyle = css('--ink2'); g.lineWidth = 1;
  if (lx) { for (let e = Math.floor(x0); e <= Math.ceil(x1); e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v < cfg.x0 || v > cfg.x1) continue; g.globalAlpha = m === 1 ? 1 : .5; g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), T + ph); g.stroke(); g.globalAlpha = 1; if (m === 1) { g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(si(v, cfg.xu || '', 2).replace(' ', ''), X(v), T + ph + 5); } } }
  else { const xt = cfg.xticks || niceTicks(x0, x1, 6); g.textAlign = 'center'; g.textBaseline = 'top'; for (const v of xt) { g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), T + ph); g.stroke(); g.fillText(cfg.xfmt ? cfg.xfmt(v) : fd(v, 0), X(v), T + ph + 5); } }
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const v of (cfg.yticks || niceTicks(lo, hi, 5))) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(L + pw, Y(v)); g.stroke(); g.fillText(fd(v, Math.abs(v) < 10 && v % 1 ? 1 : 0), L - 6, Y(v)); }
  if (lo < 0 && hi > 0) { g.strokeStyle = css('--ink2'); g.lineWidth = 1.3; g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(L + pw, Y(0)); g.stroke(); g.lineWidth = 1; }
  for (const hl of cfg.hlines || []) { g.strokeStyle = css(hl.c); g.setLineDash([4, 3]); g.beginPath(); g.moveTo(L, Y(hl.y)); g.lineTo(L + pw, Y(hl.y)); g.stroke(); g.setLineDash([]); if (hl.t) { g.fillStyle = css(hl.c); g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(hl.t, L + 4, Y(hl.y) - 2); } }
  g.save(); g.translate(12, T + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = css('--ink2'); g.fillText(cfg.ylabel, 0, 0); g.restore();
  g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = css('--muted'); g.fillText(cfg.xlabel, 2, T + ph + 5);
  g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
  for (const s of cfg.series) {
    g.strokeStyle = css(s.c); g.fillStyle = css(s.c); g.lineWidth = s.w || 2; g.setLineDash(s.dash || []);
    if (s.bars) { const bw = Math.max(4, pw / s.x.length * 0.5); s.x.forEach((xx, k) => { const y = s.y[k]; g.fillRect(X(xx) - bw / 2, Y(Math.max(y, lo)), bw, Y(lo) - Y(Math.max(y, lo))); }); continue; }
    g.beginPath(); let pen = false; s.x.forEach((xx, k) => { const v = s.y[k]; if (!isFinite(v)) { pen = false; return; } const px = X(xx), py = Y(Math.max(lo - 1e3, Math.min(hi + 1e3, v))); pen ? g.lineTo(px, py) : g.moveTo(px, py); pen = true; }); g.stroke();
  }
  g.setLineDash([]);
  for (const vl of cfg.vlines || []) { g.strokeStyle = css(vl.c); g.setLineDash(vl.dash || [4, 3]); g.beginPath(); g.moveTo(X(vl.x), T); g.lineTo(X(vl.x), T + ph); g.stroke(); g.setLineDash([]); if (vl.t) { g.fillStyle = css(vl.c); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(vl.t, X(vl.x) + 4, T + 2); } }
  for (const pt of cfg.points || []) { g.fillStyle = css(pt.c); g.strokeStyle = css('--card'); g.lineWidth = 2; g.beginPath(); g.arc(X(pt.x), Y(pt.y), 4.5, 0, 7); g.fill(); g.stroke(); }
  g.restore();
}
const logspace = (a, b, n) => { const o = []; for (let k = 0; k <= n; k++) o.push(10 ** (Math.log10(a) + (Math.log10(b) - Math.log10(a)) * k / n)); return o; };

// ------------------------------------------------------------------ stav
const S = { type: 'dpRC', p: { R: 1000, C: 100e-9, L: 0.1 }, f: 1000, tmode: 'sin', lim: 'd2', A: 3, Uz: 4.7, Ub: 2, gain: 10, quiz: null, score: [0, 0] };
const lin2log = (v, a, b) => 10 ** (Math.log10(a) + (Math.log10(b) - Math.log10(a)) * v), log2lin = (x, a, b) => (Math.log10(x) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
const RANGES = { R: [10, 1e5, 'Ω'], C: [1e-9, 1e-5, 'F'], L: [1e-3, 1, 'H'], f: [1, 1e6, 'Hz'] };

// ------------------------------------------------------------------ obsah
function render() {
  $('app').innerHTML = String.raw`
<h2 id="zaklad">Co je filtr a co omezovač</h2>
<div class="grid2">
<div class="card"><h3>Filtr = frekvenčně závislý dělič napětí</h3><p class="p" style="margin:0">Filtr je <b>dvojbran</b>: dvě vstupní svorky ($u_1$) a dvě výstupní ($u_2$). Pro sinusový signál o frekvenci $f$ ho popisuje <b>přenos</b> $K(j\omega) = U_2/U_1$ (komplexní číslo: poměr amplitud a fázový posun). Uvnitř jsou R, L a C. Protože impedance L a C závisí na frekvenci, mění se s frekvencí i to, kolik napětí projde. Filtr <b>nemění tvar sinusovky</b>, jen ji zeslabí a posune.</p></div>
<div class="card"><h3>Omezovač = nelineární „strop“</h3><p class="p" style="margin:0">Omezovač (limitér) nepustí napětí přes zvolenou mez, ať je vstup jakkoli velký. Uvnitř je <b>nelineární prvek</b>: dioda, Zenerova dioda nebo zesilovač, který narazí na napájení. Na frekvenci skoro nezáleží, záleží na <b>velikosti</b> signálu. Omezovač <b>mění tvar</b> průběhu (useknutá sinusovka) a tím vyrábí vyšší harmonické.</p></div>
</div>
<div class="card"><table><tr><th>Typ</th><th>Propustí</th><th>Utlumí</th><th>Příklad použití</th></tr>
<tr><td><b>Dolní propust</b> (DP)</td><td>nízké frekvence a stejnosměrnou složku</td><td>vysoké frekvence</td><td>vyhlazení PWM, odstranění šumu, anti-aliasing před A/D převodníkem, filtr derivační složky</td></tr>
<tr><td><b>Horní propust</b> (HP)</td><td>vysoké frekvence</td><td>stejnosměrnou složku a nízké frekvence</td><td>oddělení ss složky (vazební kondenzátor), výškový reproduktor</td></tr>
<tr><td><b>Pásmová propust</b> (PP)</td><td>pásmo kolem $f_0$</td><td>vše ostatní</td><td>ladění rádia, výběr jedné frekvence</td></tr>
<tr><td><b>Pásmová zádrž</b> (PZ)</td><td>vše kromě pásma kolem $f_0$</td><td>pásmo kolem $f_0$</td><td>odstranění brumu 50 Hz</td></tr></table>
<p class="note" style="margin:6px 0 0"><b>Mezní frekvence</b> $f_m$: tam, kde $|K| = 1/\sqrt2 \approx 0{,}707$, tj. útlum $-3\,\mathrm{dB}$ (výkon klesne na polovinu). V decibelech $|K|_{dB} = 20\log_{10}|K|$; $-20\,\mathrm{dB}$ = desetkrát menší amplituda.</p></div>

<div class="card"><h3>Značky filtrů, propustí a omezovačů</h3><p class="p" style="margin:0 0 8px">Podle příručky <i>Grafické značky používané na schématech a výkresech v elektrotechnice podle databáze IEC 60617DB</i> (ÚNMZ; ve vaultu v podkladech EST, str. 90–91). Filtr je čtverec s vlnovkami: <b>horní vlnovka = vyšší, dolní = nižší frekvence</b>, <b>přeškrtnutá = pásmo, které filtr nepropustí</b>.</p>
<div class="scroll"><table class="znacky"><tr><th>Značka</th><th>Název</th><th>IEC</th><th>Čti jako</th></tr>
${[['obecny_f', 'Kmitočtový filtr, obecná značka', 'S01246', 'filtr bez určení typu'], ['hp1', 'Horní propust (hornofrekvenční)', 'S01247', 'dolní (nízké) frekvence přeškrtnuté'], ['dp1', 'Dolní propust', '—*', 'horní (vysoké) frekvence přeškrtnuté'], ['pp', 'Pásmová propust', '—*', 'horní i dolní přeškrtnuté, propustí střed'], ['pz', 'Pásmová zádrž', '—*', 'přeškrtnutý střed'],
   ['orez', 'Ořezávač (omezovač shora)', 'S01267', 'výstup roste se vstupem, pak se zastaví na mezi (saturace)'], ['prah', 'Omezovač prahové úrovně', 'S01268', 'propustí až signál nad prahem'], ['prahnast', 'Omezovač prahové úrovně, nastavitelný práh', 'S01269', 'šipka = práh lze nastavit'],
   ['prerus', 'Elektronický přerušovač', 'S01263', 'spínaný signál (základ PWM měniče)'], ['faz', 'Fázový měnič', 'S01256', 'mění fázi, ne amplitudu'], ['utlum', 'Útlumový článek s pevným útlumem', 'S01244', 'zeslabí všechny frekvence stejně']].map(([k, n, c, d]) => `<tr><td style="width:84px">${znackaSVG(k, 60)}</td><td><b>${n}</b></td><td>${c}</td><td>${d}</td></tr>`).join('')}
</table></div>
<p class="note" style="margin:8px 0 0">* Výběr v příručce obsahuje z filtrů jen obecný filtr a horní propust; dolní propust, pásmovou propust a zádrž kreslíme stejným principem (dvě vlnovky pro DP/HP, tři pro pásmové filtry). Uvnitř značky omezovače je zjednodušená převodní charakteristika výstup(vstup) bez os; krátká svislá čárka značí počátek (osu y), viz aplikační poznámka A00245. K bloku lze připsat mezní frekvenci nebo řád (např. „2“ = 2. řád). V regulaci se filtr kreslí i jako obecný blok s přenosem $K(j\omega)$ nebo $F(p)$, omezení jako blok „mez“ (výklad motoru, krok 5).</p>
<div style="display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-start;margin-top:8px">${[['dp1', 'DP s mezní frekvencí', { text: '1,6 kHz' }], ['dp2', 'DP 2. řádu', {}], ['obecny', 'Obecný blok K(jω), F(p)', {}]].map(([k, n, o]) => `<figure style="margin:0;text-align:center;width:130px">${znackaSVG(k, 72, o)}<figcaption style="font-size:13px">${n}</figcaption></figure>`).join('')}</div></div>

<h2 id="prvky">Proč to funguje: R, L a C při různé frekvenci</h2>
<div class="grid3">
<div class="card"><h3>Rezistor R</h3>$$Z_R = R$$<p class="p" style="margin:0">Na frekvenci nezáleží. Energii mění v teplo ($P = RI^2$).</p></div>
<div class="card"><h3>Cívka L</h3>$$Z_L = j\omega L$$<p class="p" style="margin:0">Roste s frekvencí. Pro ss proud zkrat, pro vysoké frekvence „zeď“. Energii jen dočasně uloží v magnetickém poli ($\tfrac12 L i^2$) a vrátí. Brání <i>změně proudu</i>.</p></div>
<div class="card"><h3>Kondenzátor C</h3>$$Z_C = \dfrac{1}{j\omega C}$$<p class="p" style="margin:0">Klesá s frekvencí. Pro ss proud rozpojený, pro vysoké frekvence zkrat. Energii uloží v elektrickém poli ($\tfrac12 C u^2$) a vrátí. Brání <i>změně napětí</i>.</p></div>
</div>
<div class="card"><div class="controls" style="margin:0"><div class="ctl"><label for="zf"><span>Frekvence f</span><output id="zfo"></output></label><input type="range" id="zf" min="0" max="1" step="0.001" value="${log2lin(1000, 1, 1e6)}"></div></div><div class="read" id="zread"></div>
<div class="box"><b>Dělič napětí</b> je klíč ke všem pasivním filtrům: $\dfrac{U_2}{U_1} = \dfrac{Z_2}{Z_1 + Z_2}$, kde $Z_1$ je podélná větev (nahoře) a $Z_2$ příčná větev (na výstupu). Pro dolní propust RC: $Z_1 = R$, $Z_2 = \frac{1}{j\omega C}$ a po vynásobení $j\omega C$ dostaneme $K = \dfrac{1}{1 + j\omega RC}$. Kde má příčná větev velkou impedanci, výstup dostane skoro celé napětí; kde malou, výstup je „zkratovaný“.</div></div>

<h2 id="lab">Laboratoř filtrů</h2>
<div class="card"><div class="seg" id="ftype">${Object.entries(TYPES).map(([k, t]) => `<button data-t="${k}" aria-pressed="${k === S.type}">${t.n}</button>`).join('')}</div>
<div class="grid2" style="margin-top:12px"><div><div class="sch scroll" id="fsch"></div><p class="note" id="fwhy"></p></div><div><div style="display:flex;gap:12px;align-items:center"><div id="fsym"></div><div class="formula" id="ftex" style="flex:1;min-width:0"></div></div><div class="read" id="fread"></div></div></div>
<div class="controls" id="fctl"></div></div>
<div class="grid2"><div class="card"><h3>Frekvenční charakteristika (Bode)</h3><div class="chleg"><span style="--c:var(--u2)">|K| [dB]</span><span class="dash" style="--c:var(--as)">asymptoty</span></div><canvas id="cvA"></canvas><div class="chleg"><span style="--c:var(--ph)">fáze φ [°]</span></div><canvas id="cvF"></canvas></div>
<div class="card"><h3>Časový průběh</h3><div class="seg" id="tmode"><button data-m="sin" aria-pressed="true">sinus o frekvenci f</button><button data-m="skok" aria-pressed="false">skok (přechodová ch.)</button><button data-m="imp" aria-pressed="false">impuls (impulzní ch.)</button></div>
<div class="chleg"><span style="--c:var(--u1)">u₁ vstup</span><span style="--c:var(--u2)">u₂ výstup</span></div><canvas id="cvT" style="height:260px"></canvas><p class="note" id="tnote"></p></div></div>
<details><summary>Odvození a pojmy (rozklikni)</summary><div class="body">
<p><b>Přenos z děliče.</b> Napětí na příčné větvi $Z_2$ v sérii se $Z_1$: $U_2 = U_1\,\dfrac{Z_2}{Z_1 + Z_2}$. Za $Z$ dosadíme $R$, $j\omega L$, $1/(j\omega C)$ a upravíme.</p>
<p><b>Asymptoty 1. řádu.</b> Pod $f_m$ je $|K| \approx 1$ (0 dB, DP) nebo roste $+20\,\mathrm{dB/dek}$ (HP); nad $f_m$ DP klesá $-20\,\mathrm{dB/dek}$. Skutečná křivka je v $f_m$ o 3 dB pod lomem asymptot a fáze je přesně $\mp 45^\circ$.</p>
<p><b>2. řád (RLC).</b> Rezonance $\omega_0 = 1/\sqrt{LC}$; činitel jakosti $Q = \frac{1}{R}\sqrt{L/C} = 1/(2\zeta)$. Šířka pásma pásmové propusti (mezi body −3 dB) je $B = f_0/Q = R/(2\pi L)$. Velké $Q$ = úzké pásmo a ostrá rezonance.</p>
<p><b>Přechodová a impulzní charakteristika.</b> Přechodová $h(t)$ je odezva na jednotkový skok, impulzní $g(t) = \mathrm dh/\mathrm dt$ odezva na Diracův impuls. U DP RC: $h(t) = 1 - e^{-t/\tau}$, $g(t) = \frac{1}{\tau}e^{-t/\tau}$, $\tau = RC$. U HP CR je to naopak: skok projde a „vybije se“, $h(t) = e^{-t/\tau}$. Podle tvaru odezvy na skok tedy poznáš typ filtru i bez frekvenční charakteristiky.</p>
<p><b>Energie.</b> R energii ztrácí (teplo), L a C ji jen střídavě ukládají a vracejí. Proto ideální LC obvod v rezonanci kmitá a útlum (šířku pásma) určuje jen R.</p></div></details>

<h2 id="poznej">Poznej filtr (dovednost z TEL2)</h2>
<div class="card quiz"><p class="p" style="margin:0 0 6px">Podle schématu, značky, frekvenční charakteristiky nebo přechodové charakteristiky urči typ filtru. Úloha se losuje.</p>
<div id="qbody"></div><div class="opts" id="qopts"></div><p id="qres" style="margin:8px 0 0"></p>
<div class="row" style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="btn primary" id="qnext">Další úloha</button><span class="note" id="qscore"></span></div></div>

<h2 id="omez">Omezovače (limitéry)</h2>
<div class="grid2">
<div class="card"><h3>Dioda: ventil s prahem</h3><p class="p" style="margin:0">Křemíková dioda vede v propustném směru až od asi <b>0,6–0,7 V</b>; nad tím proud prudce roste ($i = I_S(e^{u/nU_T} - 1)$) a napětí na ní se skoro nezvětší. V závěrném směru nevede. <b>Zenerova dioda</b> navíc v závěrném směru při napětí $U_Z$ „prorazí“ (vratně) a drží napětí $U_Z$.</p></div>
<div class="card"><h3>Zapojení omezovače</h3><p class="p" style="margin:0">Do série se signálem dáme <b>rezistor R</b> a diodu (nebo diody) <b>paralelně k výstupu</b>. Dokud je napětí pod prahem, dioda nevede a výstup = vstup. Nad prahem dioda vede, přebytek napětí „spadne“ na R a výstup zůstane u prahu. R je nutný: omezuje proud diodou, bez něj by ji zdroj zničil. Je to opět dělič napětí, jen s nelineární dolní větví.</p></div>
</div>
<div class="card"><div class="seg" id="ltype">
<button data-l="d1">1 dioda</button><button data-l="d2">2 antiparalelní diody</button><button data-l="db">dioda s předpětím U_B</button><button data-l="z1">Zenerova dioda</button><button data-l="z2">2 Zenerovy proti sobě</button><button data-l="oz">zesilovač (saturace)</button></div>
<div class="grid2" style="margin-top:12px"><div class="sch scroll" id="lsch"></div><div><p class="p" id="lwhy" style="margin:0"></p><div class="read" id="lread"></div></div></div>
<div class="controls" id="lctl"></div></div>
<div class="grid3"><div class="card"><h3>Převodní charakteristika u₂(u₁)</h3><canvas id="cvL1"></canvas></div><div class="card"><h3>Časový průběh</h3><div class="chleg"><span style="--c:var(--u1)">u₁</span><span style="--c:var(--u2)">u₂</span></div><canvas id="cvL2"></canvas></div><div class="card"><h3>Harmonické výstupu</h3><canvas id="cvL3"></canvas><p class="note" id="lthd" style="margin:4px 0 0"></p></div></div>

<h2 id="zae">Kde to potkáš v ZAE</h2>
<div class="card"><ul style="margin:0;padding-left:1.2em">
<li><b>RC článek = setrvačný člen 1. řádu.</b> Přednáška o blocích ho uvádí jako dolní propust se zesílením 1: $F(p) = \dfrac{1}{1 + p\tau}$. Přesně takové jsou bloky $F_1$, $F_2$ ve <a href="trenazer.html">vstupním testu</a> a ot02 se ptá na fázi „−29°“ dolní propusti.</li>
<li><b>Kotva motoru je dolní propust RL</b>: $I/U = 1/(R + pL)$ s $\tau_a = L/R$. Proud nemůže skočit, stejně jako výstup RL článku (<a href="index.html#krok1">výklad, krok 1</a>).</li>
<li><b>Průměrovaný měnič (PWM)</b> se modeluje dolní propustí $K_m/(1 + p\tau_m)$: spínané napětí se „vyhladí“ indukčností kotvy.</li>
<li><b>Filtr derivační složky</b>: ideální D zesiluje šum na vysokých frekvencích, proto se za něj dává dolní propust s časovou konstantou $T_f$ (přednáška 07 o derivační složce).</li>
<li><b>Anti-aliasing</b> před vzorkováním: dolní propust odstraní frekvence nad polovinou vzorkovací frekvence (souvisí s ot10 testu).</li>
<li><b>Omezovač = saturace</b> akční veličiny a požadavku proudu (<a href="index.html#krok5">výklad, krok 5</a>). Zenerovy diody chrání vstupy měřicích obvodů před přepětím.</li>
<li><b>Rezonanční převýšení</b> dolní propusti 2. řádu je totéž, co kmitání motoru s malým tlumením $\zeta$ nebo překmit regulační smyčky s malou bezpečností ve fázi.</li></ul>
<p class="note" style="margin:8px 0 0">Zdroje: sylabus TEL2 (základní typy filtrů, frekvenční charakteristiky, rozpoznat typ filtru podle schématu, frekvenční, přenosové a impulzní funkce); ZAE — přednáška o obrazovém a frekvenčním popisu bloků (RC článek jako dolní propust), 07 derivační složka (filtr D), ZAE14 (saturace). Výklad a čísla v laboratoři jsou vlastní; prvky jsou ideální, dioda má exponenciální model ($I_S = 1\,\mathrm{nA}$, $n = 1{,}8$).</p></div>`;
  bind(); math($('app')); drawZ(); drawFilter(); drawLim(); newQuiz();
}

// ------------------------------------------------------------------ R, L, C
function drawZ() {
  const f = lin2log(+$('zf').value, 1, 1e6), w = PI2 * f, p = S.p;
  $('zfo').textContent = si(f, 'Hz');
  $('zread').innerHTML = `<div><span>|Z<sub>R</sub>| (R = ${si(p.R, 'Ω')})</span><b>${si(p.R, 'Ω')}</b></div><div><span>|Z<sub>L</sub>| = ωL (L = ${si(p.L, 'H')})</span><b>${si(w * p.L, 'Ω')}</b></div><div><span>|Z<sub>C</sub>| = 1/(ωC) (C = ${si(p.C, 'F')})</span><b>${si(1 / (w * p.C), 'Ω')}</b></div><div><span>ω = 2πf</span><b>${si(w, 'rad/s')}</b></div>`;
}

// ------------------------------------------------------------------ laboratoř filtrů
function fctlHtml() {
  const t = TYPES[S.type], all = [...new Set(t.series.concat(t.shunt))];
  const sl = (k, lab) => `<div class="ctl"><label for="s_${k}"><span>${lab}</span><output id="o_${k}"></output></label><input type="range" id="s_${k}" data-k="${k}" min="0" max="1" step="0.001" value="${log2lin(k === 'f' ? S.f : S.p[k], RANGES[k][0], RANGES[k][1])}"></div>`;
  return all.map(k => sl(k, { R: 'Odpor R', L: 'Indukčnost L', C: 'Kapacita C' }[k])).join('') + sl('f', 'Frekvence vstupního sinusu f');
}
function drawFilter() {
  const t = TYPES[S.type], p = S.p, fc = charF(S.type, p), all = t.series.concat(t.shunt);
  for (const k of ['R', 'L', 'C', 'f']) if ($('o_' + k)) $('o_' + k).textContent = si(k === 'f' ? S.f : p[k], RANGES[k][2]);
  $('fsch').innerHTML = schemaSVG(S.type, p); $('fwhy').innerHTML = t.why; $('fsym').innerHTML = znackaSVG(t.kind, 64);
  const Kf = K(S.type, p, PI2 * S.f), mag = cabs(Kf), ph = carg(Kf), second = all.includes('L') && all.includes('C');
  const Q = second ? Math.sqrt(p.L / p.C) / p.R : NaN;
  $('ftex').innerHTML = `$$${t.tex}$$`;
  $('fread').innerHTML = `<div><span>${second ? 'rezonance f₀' : 'mezní frekvence f_m'}</span><b>${si(fc, 'Hz')}</b></div>` + (second ? `<div><span>${S.type === 'dpRLC' ? 'tlumení ζ = 1/(2Q)' : 'činitel jakosti Q'}</span><b>${S.type === 'dpRLC' ? fd(1 / (2 * Q), 3) : fd(Q, 2)}</b></div>` : `<div><span>časová konstanta τ</span><b>${si(1 / (PI2 * fc), 's')}</b></div>`) +
    `<div><span>při f = ${si(S.f, 'Hz')}: |K|</span><b>${fd(mag, 3)} (${fd(20 * Math.log10(mag), 1)} dB)</b></div><div><span>fázový posun φ</span><b>${fd(ph, 1)}°</b></div><div><span>výstupní amplituda (vstup 1 V)</span><b>${si(mag, 'V')}</b></div>`;
  math($('ftex'));
  // Bode
  const f0 = fc / 1000, f1 = fc * 1000, fs = logspace(f0, f1, 500);
  const mags = fs.map(f => 20 * Math.log10(cabs(K(S.type, p, PI2 * f)))), phs = fs.map(f => carg(K(S.type, p, PI2 * f)));
  const asy = fs.map(f => { const r = f / fc; switch (t.kind) { case 'dp1': return r < 1 ? 0 : -20 * Math.log10(r); case 'hp1': return r < 1 ? 20 * Math.log10(r) : 0; case 'dp2': return r < 1 ? 0 : -40 * Math.log10(r); default: return NaN; } });
  chart($('cvA'), { logx: true, x0: f0, x1: f1, xu: 'Hz', xlabel: 'f', ylabel: '|K| [dB]', ymin: Math.max(-80, Math.min(...mags) - 5), ymax: Math.max(5, Math.max(...mags) + 5), series: [{ x: fs, y: asy, c: '--as', dash: [5, 4], w: 1.4 }, { x: fs, y: mags, c: '--u2' }], hlines: [{ y: -3, c: '--muted', t: '−3 dB' }], vlines: [{ x: fc, c: '--muted', t: second ? 'f₀' : 'f_m' }, { x: S.f, c: '--u1', dash: [1, 0] }], points: S.f >= f0 && S.f <= f1 ? [{ x: S.f, y: 20 * Math.log10(mag), c: '--u2' }] : [] });
  chart($('cvF'), { logx: true, x0: f0, x1: f1, xu: 'Hz', xlabel: 'f', ylabel: 'φ [°]', ymin: -190, ymax: 190, yticks: [-180, -90, 0, 90, 180], series: [{ x: fs, y: phs, c: '--ph' }], vlines: [{ x: fc, c: '--muted' }, { x: S.f, c: '--u1', dash: [1, 0] }], points: S.f >= f0 && S.f <= f1 ? [{ x: S.f, y: ph, c: '--ph' }] : [] });
  // čas
  let r, note;
  const tauC = 1 / (PI2 * fc);
  if (S.tmode === 'sin') { const T = 5 / S.f; r = simuluj(S.type, p, tt => Math.sin(PI2 * S.f * tt), T); note = `Pět period vstupu od zapnutí: na začátku je vidět přechodový děj, pak se výstup ustálí na amplitudě ${fd(mag, 3)} V a je posunutý o ${fd(ph, 1)}°.`; }
  else { const T = (second ? Math.max(8, 4 * Q) : 6) * tauC * (second ? PI2 / 2 : 1); const st = simuluj(S.type, p, tt => tt > 0 ? 1 : 0, T, 1500); r = st;
    if (S.tmode === 'imp') { const g = st.u2.map((v, k) => k ? (v - st.u2[k - 1]) / (st.t[k] - st.t[k - 1]) * tauC : 0); r = { t: st.t, u1: st.t.map(() => NaN), u2: g }; note = 'Impulzní charakteristika g(t) = dh/dt (zde vynásobená τ, aby měla rozumné měřítko). Dolní propust odpoví „hrbem“, horní propust ostrým impulzem a záporným dozvukem.'; }
    else note = 'Přechodová charakteristika h(t): odezva na skok 1 V. Dolní propust na skok najíždí, horní propust skok propustí a pak „vybije“ na nulu, pásmová propust odpoví zákmitem.'; }
  const scale = r.t[r.t.length - 1] < 1e-3 ? [1e6, 'µs'] : r.t[r.t.length - 1] < 1 ? [1e3, 'ms'] : [1, 's'];
  chart($('cvT'), { x0: 0, x1: r.t[r.t.length - 1] * scale[0], xlabel: 't [' + scale[1] + ']', xfmt: v => fd(v, v % 1 ? 1 : 0), ylabel: S.tmode === 'imp' ? 'τ·g(t)' : 'u [V]', series: [{ x: r.t.map(v => v * scale[0]), y: r.u1, c: '--u1', w: 1.6 }, { x: r.t.map(v => v * scale[0]), y: r.u2, c: '--u2' }] });
  $('tnote').textContent = note;
}

// ------------------------------------------------------------------ omezovače
const IS = 1e-9, NVT = 1.8 * 0.02585, RS = 1000;
const D = v => IS * (Math.exp(Math.min(v, 2) / NVT) - 1) * (v > 2 ? 1 + (v - 2) * 1e3 : 1);
function sit(u1) {
  const L = S.lim, Uz = S.Uz, Ub = S.Ub;
  if (L === 'oz') { const us = 12 - 1.5; return Math.max(-us, Math.min(us, S.gain * u1)); }
  const g = v => L === 'd1' ? D(v) : L === 'd2' ? D(v) - D(-v) : L === 'db' ? D(v - Ub) : L === 'z1' ? D(v - Uz) - D(-v) : D(v - Uz) - D(-v - Uz);
  let lo = -Math.abs(u1) - 1, hi = Math.abs(u1) + 1;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (g(m) - (u1 - m) / RS > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
const LIM = {
  d1: { n: '1 dioda', why: 'Kladná půlvlna se usekne na ≈ 0,6 V (dioda vede), záporná projde beze změny (dioda je v závěrném směru).' },
  d2: { n: '2 antiparalelní diody', why: 'Jedna dioda vede pro kladné, druhá pro záporné napětí: výstup je omezen na ≈ ±0,6 V. Typická ochrana vstupu zesilovače.' },
  db: { n: 'dioda s předpětím', why: 'Zdroj U_B v sérii s diodou posune práh: kladné napětí se omezí na U_B + 0,6 V. Takto lze nastavit libovolnou mez.' },
  z1: { n: 'Zenerova dioda', why: 'Kladné napětí omezí průraz Zenerovy diody na ≈ U_Z, záporné propustný směr na ≈ −0,6 V.' },
  z2: { n: '2 Zenerovy proti sobě', why: 'V každém směru jedna dioda prorazí a druhá vede: symetrické omezení na ≈ ±(U_Z + 0,6 V).' },
  oz: { n: 'zesilovač', why: 'Operační zesilovač se zesílením A nemůže dát víc než své napájení (zde ±12 V, výstup do ≈ ±10,5 V). Při velkém vstupu narazí na mez a „usekne“ vrcholy — to je saturace, stejná jako omezení v regulaci.' }
};
function limSVG() {
  const L = S.lim, T = 50, B = 190, x = 330;
  let g = `<path d="M30,${T} H130 M180,${T} H490 M30,${B} H490" style="fill:none;stroke:var(--ink2);stroke-width:1.6"/><rect x="130" y="${T - 8}" width="50" height="16" style="fill:var(--card);stroke:var(--ink);stroke-width:1.8"/><text x="155" y="${T - 14}" style="font:italic 15px 'Times New Roman',serif;fill:var(--ink);text-anchor:middle">R</text>`;
  ['30', '490'].forEach(xx => g += `<circle cx="${xx}" cy="${T}" r="4" style="fill:var(--card);stroke:var(--ink)"/><circle cx="${xx}" cy="${B}" r="4" style="fill:var(--card);stroke:var(--ink)"/>`);
  g += `<text x="56" y="125" style="font:italic 15px 'Times New Roman',serif;fill:var(--u1)">u₁</text><text x="450" y="125" style="font:italic 15px 'Times New Roman',serif;fill:var(--u2);text-anchor:end">u₂</text>`;
  const dioda = (cx, cy, up, zener) => { const s = up ? -1 : 1; return `<path d="M${cx - 12},${cy + 8 * s} L${cx + 12},${cy + 8 * s} L${cx},${cy - 8 * s} Z" style="fill:var(--ink)"/><path d="M${cx - 12},${cy - 8 * s} H${cx + 12}${zener ? ` M${cx - 12},${cy - 8 * s} l-5,${4 * s} M${cx + 12},${cy - 8 * s} l5,${-4 * s}` : ''}" style="stroke:var(--ink);stroke-width:2;fill:none"/>`; };
  const branch = (cx, inner) => `<circle cx="${cx}" cy="${T}" r="3" style="fill:var(--ink2)"/><circle cx="${cx}" cy="${B}" r="3" style="fill:var(--ink2)"/><path d="M${cx},${T} V${B}" style="stroke:var(--ink2);stroke-width:1.6"/>` + inner;
  if (L === 'd1') g += branch(x, `<rect x="${x - 14}" y="100" width="28" height="40" style="fill:var(--card)"/>` + dioda(x, 120, true));
  if (L === 'd2') g += branch(x - 30, `<rect x="${x - 44}" y="100" width="28" height="40" style="fill:var(--card)"/>` + dioda(x - 30, 120, true)) + branch(x + 30, `<rect x="${x + 16}" y="100" width="28" height="40" style="fill:var(--card)"/>` + dioda(x + 30, 120, false));
  if (L === 'db') g += branch(x, `<rect x="${x - 14}" y="70" width="28" height="100" style="fill:var(--card)"/>` + dioda(x, 92, true) + `<path d="M${x - 14},140 H${x + 14} M${x - 8},150 H${x + 8}" style="stroke:var(--ink);stroke-width:2"/><text x="${x + 20}" y="150" style="font:italic 14px 'Times New Roman',serif;fill:var(--ink)">U<tspan baseline-shift="sub" font-size="70%">B</tspan></text>`);
  if (L === 'z1') g += branch(x, `<rect x="${x - 18}" y="100" width="36" height="40" style="fill:var(--card)"/>` + dioda(x, 120, false, true) + `<text x="${x + 22}" y="124" style="font:italic 14px 'Times New Roman',serif;fill:var(--ink)">U<tspan baseline-shift="sub" font-size="70%">Z</tspan></text>`);
  if (L === 'z2') g += branch(x, `<rect x="${x - 18}" y="70" width="36" height="100" style="fill:var(--card)"/>` + dioda(x, 95, false, true) + dioda(x, 145, true, true));
  if (L === 'oz') g = `<path d="M30,${T + 20} H200 M30,${B} H490 M330,120 H490" style="fill:none;stroke:var(--ink2);stroke-width:1.6"/><path d="M200,70 V170 L330,120 Z" style="fill:var(--card);stroke:var(--ink);stroke-width:1.8"/><text x="240" y="125" style="font:15px system-ui;fill:var(--ink)">A</text><text x="210" y="95" style="font:14px system-ui;fill:var(--ink)">+</text><text x="208" y="152" style="font:16px system-ui;fill:var(--ink)">−</text><path d="M200,145 H170 V${B}" style="fill:none;stroke:var(--ink2);stroke-width:1.6"/><text x="265" y="62" style="font:12px system-ui;fill:var(--muted)">+12 V</text><text x="265" y="190" style="font:12px system-ui;fill:var(--muted)">−12 V</text><circle cx="30" cy="70" r="4" style="fill:var(--card);stroke:var(--ink)"/><circle cx="30" cy="${B}" r="4" style="fill:var(--card);stroke:var(--ink)"/><circle cx="490" cy="120" r="4" style="fill:var(--card);stroke:var(--ink)"/><circle cx="490" cy="${B}" r="4" style="fill:var(--card);stroke:var(--ink)"/><text x="56" y="140" style="font:italic 15px 'Times New Roman',serif;fill:var(--u1)">u₁</text><text x="450" y="160" style="font:italic 15px 'Times New Roman',serif;fill:var(--u2);text-anchor:end">u₂</text>`;
  return `<svg viewBox="0 0 520 220" role="img" aria-label="Schéma omezovače">${g}</svg>`;
}
function drawLim() {
  document.querySelectorAll('#ltype button').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === S.lim));
  $('lsch').innerHTML = limSVG(); $('lwhy').textContent = LIM[S.lim].why;
  const sl = (k, lab, min, max, st, u) => `<div class="ctl"><label for="l_${k}"><span>${lab}</span><output id="lo_${k}">${fd(S[k], st < 1 ? 1 : 0)} ${u}</output></label><input type="range" id="l_${k}" data-k="${k}" min="${min}" max="${max}" step="${st}" value="${S[k]}"></div>`;
  $('lctl').innerHTML = sl('A', 'Amplituda vstupu', 0.2, 15, 0.1, 'V') + (S.lim === 'db' ? sl('Ub', 'Předpětí U_B', 0, 8, 0.1, 'V') : '') + (S.lim.startsWith('z') ? sl('Uz', 'Zenerovo napětí U_Z', 2.7, 12, 0.1, 'V') : '') + (S.lim === 'oz' ? sl('gain', 'Zesílení A', 1, 50, 1, '×') : '');
  $('lctl').querySelectorAll('input').forEach(i => i.addEventListener('input', () => { S[i.dataset.k] = +i.value; $('lo_' + i.dataset.k).textContent = `${fd(S[i.dataset.k], +i.step < 1 ? 1 : 0)} ${i.parentElement.querySelector('output').textContent.split(' ').pop()}`; plotLim(); }));
  plotLim();
}
function plotLim() {
  const A = S.A, xs = [], ys = [];
  for (let k = 0; k <= 200; k++) { const u = -15 + 30 * k / 200; xs.push(u); ys.push(sit(u)); }
  chart($('cvL1'), { x0: -15, x1: 15, xlabel: 'u₁ [V]', ylabel: 'u₂ [V]', ymin: -15, ymax: 15, yticks: [-10, -5, 0, 5, 10], series: [{ x: [-15, 15], y: [-15, 15], c: '--as', dash: [4, 4], w: 1.2 }, { x: xs, y: ys, c: '--u2' }], vlines: [{ x: -A, c: '--muted' }, { x: A, c: '--muted' }] });
  const N = 512, t = [], u1 = [], u2 = [];
  for (let k = 0; k < N; k++) { const ph = 2 * PI2 * k / N; t.push(k / N * 2); u1.push(A * Math.sin(ph)); u2.push(sit(A * Math.sin(ph))); }
  chart($('cvL2'), { x0: 0, x1: 2, xlabel: 'perioda', xfmt: v => fd(v, 1), ylabel: 'u [V]', series: [{ x: t, y: u1, c: '--u1', w: 1.6 }, { x: t, y: u2, c: '--u2' }] });
  // harmonické z jedné periody
  const M = 256, amp = [];
  for (let n = 1; n <= 9; n++) { let re = 0, im = 0; for (let k = 0; k < M; k++) { const v = sit(A * Math.sin(PI2 * k / M)); re += v * Math.cos(PI2 * n * k / M); im += v * Math.sin(PI2 * n * k / M); } amp.push(2 * Math.hypot(re, im) / M); }
  const thd = Math.sqrt(amp.slice(1).reduce((a, v) => a + v * v, 0)) / amp[0];
  chart($('cvL3'), { x0: 0.3, x1: 9.7, xticks: [1, 2, 3, 4, 5, 6, 7, 8, 9], xlabel: 'n', xfmt: v => fd(v, 0), ylabel: 'U_n [V]', ymin: 0, ymax: Math.max(...amp) * 1.15 + 1e-6, series: [{ x: [1, 2, 3, 4, 5, 6, 7, 8, 9], y: amp, c: '--h', bars: true }] });
  const umax = Math.max(...u2), umin = Math.min(...u2);
  $('lthd').innerHTML = `Zkreslení THD = <b>${fd(thd * 100, 1)} %</b>. Useknutá sinusovka obsahuje vyšší harmonické (u symetrického omezení liché 3., 5., 7.); nesymetrické omezení přidá i sudé.`;
  $('lread').innerHTML = `<div><span>výstup max / min</span><b>${fd(umax, 2)} / ${fd(umin, 2)} V</b></div><div><span>sériový rezistor</span><b>${si(RS, 'Ω')}</b></div>` + (S.lim !== 'oz' ? `<div><span>největší proud diodou</span><b>${si(Math.max(0, (A - Math.min(Math.abs(umax), Math.abs(umin))) / RS), 'A')}</b></div>` : `<div><span>mez výstupu</span><b>±10,5 V</b></div>`);
}

// ------------------------------------------------------------------ poznej filtr
function newQuiz() {
  const keys = Object.keys(TYPES), type = keys[Math.floor(Math.random() * keys.length)], mode = ['schema', 'bode', 'skok', 'znacka'][Math.floor(Math.random() * 4)];
  const p = { R: lin2log(Math.random() * 0.6 + 0.2, 10, 1e5), C: lin2log(Math.random() * 0.6 + 0.2, 1e-9, 1e-5), L: lin2log(Math.random() * 0.6 + 0.2, 1e-3, 1) };
  if (TYPES[type].series.concat(TYPES[type].shunt).includes('L') && TYPES[type].series.concat(TYPES[type].shunt).includes('C')) p.R = Math.sqrt(p.L / p.C) / (type === 'ppRLC' || type === 'pzRLC' ? 3 : 1.2);
  S.quiz = { type, mode, p, done: false };
  const fc = charF(type, p);
  $('qbody').innerHTML = mode === 'znacka' ? `<p class="note">Schematická značka:</p><div style="text-align:center">${znackaSVG(TYPES[type].kind, 96)}</div>` : mode === 'schema' ? `<p class="note">Schéma:</p><div class="sch scroll">${schemaSVG(type, p, { vals: false })}</div>` : `<p class="note">${mode === 'bode' ? 'Amplitudová frekvenční charakteristika |K| [dB]:' : 'Přechodová charakteristika (odezva na skok 1 V):'}</p><canvas id="cvQ"></canvas>`;
  if (mode === 'bode') { const fs = logspace(fc / 1000, fc * 1000, 400); chart($('cvQ'), { logx: true, x0: fs[0], x1: fs[fs.length - 1], xu: 'Hz', xlabel: 'f', ylabel: '|K| [dB]', ymin: -80, ymax: 15, series: [{ x: fs, y: fs.map(f => 20 * Math.log10(cabs(K(type, p, PI2 * f)))), c: '--u2' }] }); }
  if (mode === 'skok') { const second = TYPES[type].series.concat(TYPES[type].shunt).includes('L') && TYPES[type].series.concat(TYPES[type].shunt).includes('C'); const r = simuluj(type, p, tt => tt > 0 ? 1 : 0, (second ? 12 : 6) / (PI2 * fc) * (second ? 2 : 1), 1200); chart($('cvQ'), { x0: 0, x1: 1, xlabel: 't (relativně)', xfmt: v => fd(v, 1), ylabel: 'u [V]', series: [{ x: r.t.map(v => v / r.t[r.t.length - 1]), y: r.u1, c: '--u1', w: 1.4 }, { x: r.t.map(v => v / r.t[r.t.length - 1]), y: r.u2, c: '--u2' }] }); }
  $('qopts').innerHTML = Object.entries(KIND).map(([k, n]) => `<button data-k="${k}">${n}</button>`).join('');
  $('qres').innerHTML = '';
  $('qopts').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    if (S.quiz.done) return; S.quiz.done = true; const ok = b.dataset.k === TYPES[S.quiz.type].kind; S.score[0] += ok; S.score[1]++;
    $('qopts').querySelectorAll('button').forEach(x => { if (x.dataset.k === TYPES[S.quiz.type].kind) x.className = 'ok'; else if (x === b) x.className = 'ko'; });
    $('qres').innerHTML = `${ok ? '✓ Správně.' : '✗ Ne.'} Je to <b>${TYPES[S.quiz.type].n}</b>. ${TYPES[S.quiz.type].why}`; math($('qres'));
    $('qscore').textContent = `Skóre ${S.score[0]} / ${S.score[1]}`;
  }));
}

// ------------------------------------------------------------------ ovládání
function bind() {
  $('zf').addEventListener('input', drawZ);
  $('ftype').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.type = b.dataset.t; $('ftype').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); $('fctl').innerHTML = fctlHtml(); bindF(); drawFilter(); });
  $('fctl').innerHTML = fctlHtml(); bindF();
  $('tmode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.tmode = b.dataset.m; $('tmode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); drawFilter(); });
  $('ltype').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.lim = b.dataset.l; drawLim(); });
  $('qnext').addEventListener('click', newQuiz);
}
function bindF() { $('fctl').querySelectorAll('input').forEach(i => i.addEventListener('input', () => { const k = i.dataset.k, v = lin2log(+i.value, RANGES[k][0], RANGES[k][1]); if (k === 'f') S.f = v; else S.p[k] = v; drawFilter(); drawZ(); })); }
function math(el) { if (typeof renderMathInElement === 'function') renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); }

render();
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { drawFilter(); plotLim(); }, 150); });
$('hlasit').addEventListener('click', function () { const q = new URLSearchParams({ template: '1-chyba.yml', stranka: 'Filtry a omezovače', cast: (location.hash || '').replace('#', ''), verze: '1.2.0' }); this.href = 'https://github.com/geproha/zae-sim/issues/new?' + q.toString(); });
