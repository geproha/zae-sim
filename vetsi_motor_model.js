/* ZAE — Větší motor: model a simulace (port motor_kaskada.py 1.0.0).
   Stejné rovnice, krok 25 µs, regulátor drží povel mezi kroky, RK4.
   Funguje v prohlížeči (window.VMModel) i v Node (module.exports). */
(function (root) {
  'use strict';
  const BASE = {
    // ZAE14 str. 7, 10, 12, 21 (školní zdroj)
    R: 0.04, L: 0.002, J: 0.05, kPhi: 0.5, Km: 1, tau_m: 1 / 4000,
    Kri: 7.9, Krw: 40, tau_rw: 0.025, Imax: 200,
    // vymyšlené (vlastní scénář)
    Umax: 100, Kp_u: 2, tau_u: 0.1, omega_w: 150, vstup: 'skok',
    t_w: 0.02, t_rampa: 0.15, Mz: 40, t_Mz: 0.4, T: 0.8, h: 25e-6,
    aw: true,  // anti-windup (podmíněná integrace) v kroku 5
    // pokus s brzdou (krok 1, podle poznámky „Větší motor — poznámky pro druhou simulaci“)
    brzda: 'volno',   // 'volno' | 'drzi' | 'uvolnit'
    t_brzda: 0.15,    // čas uvolnění brzdy [s]
    idealni: false,   // ideální zdroj napětí místo měniče 1. řádu
    // porucha a změna požadavku (zapínatelné)
    zatez: true,      // skok zátěžného momentu Mz v čase t_Mz
    zmena: false,     // změna požadovaných otáček za běhu
    omega_w2: 100, t_w2: 0.6,
    ff: false,        // dopředná vazba u_i = kΦ·ω k povelu proudového regulátoru (kroky 4–5)
    profil: 'zae14'   // 'zae14' | 'auto' (jen pro UI)
  };

  function pozadavek(p, t) {
    if (t < p.t_w) return 0;
    const r = k => p.vstup === 'rampa' ? Math.min(1, k / p.t_rampa) : 1;
    let w = p.omega_w * r(t - p.t_w);
    if (p.zmena && t >= p.t_w2) w += (p.omega_w2 - p.omega_w) * r(t - p.t_w2);
    return w;
  }

  function simuluj(opt, krok, maxBodu) {
    const p = Object.assign({}, BASE, opt);
    const { R, L, J, kPhi, Km, tau_m: tm, h } = p;
    const N = Math.round(p.T / h) + 1;
    const step = Math.max(1, Math.floor(N / (maxBodu || 1600)));
    const out = { t: [], w: [], i: [], uv: [], ww: [], iw: [], ur: [], th: [], q: [], br: [] };
    const clip = (v, m) => Math.max(-m, Math.min(m, v));
    let x0 = 0, x1 = 0, x2 = 0, integ = 0, theta = 0;
    // metriky na plném rozlišení
    let wMaxPred = -Infinity, t10 = NaN, t90 = NaN, wMinPo = Infinity;
    let iPeak = 0, uPeak = 0, sumPred = 0, nPred = 0, sumPo = 0, nPo = 0, sumI = 0, sumU = 0;
    let tPk = NaN, iRel = NaN, Q = 0, Esrc = 0, Emech = 0;
    const brzdi = t => p.brzda === 'drzi' || (p.brzda === 'uvolnit' && t < p.t_brzda);
    // brzda drží hřídel: dω/dt = 0; ideální zdroj: u_v = K_m·u_r okamžitě
    const f = (s0, s1, s2, u, z, br) => [br ? 0 : (kPhi * s1 - z) / J, (s2 - R * s1 - kPhi * s0) / L, p.idealni ? 0 : (Km * u - s2) / tm];
    for (let j = 0; j < N; j++) {
      const t = j * h, wref = pozadavek(p, t), z = p.zatez && t >= p.t_Mz ? p.Mz : 0, e = wref - x0;
      let u, iref = NaN;
      if (krok === 1) u = wref * kPhi / Km;
      else if (krok === 2 || krok === 3) {
        u = p.Kp_u * e + (krok === 3 ? integ : 0);
        if (krok === 3) integ += h * p.Kp_u / p.tau_u * e;
      } else {
        const raw = p.Krw * e + integ;
        iref = krok === 5 ? clip(raw, p.Imax) : raw;
        u = p.Kri * (iref - x1) + (p.ff ? kPhi * x0 / Km : 0);
        if (krok === 5) {
          u = clip(u, p.Umax);
          if (!p.aw || Math.abs(raw) <= p.Imax || raw * e < 0) integ += h * p.Krw / p.tau_rw * e;
        } else integ += h * p.Krw / p.tau_rw * e;
      }
      const br = brzdi(t);
      if (p.idealni) x2 = Km * u;
      if (p.brzda === 'uvolnit' && isNaN(iRel) && t >= p.t_brzda) iRel = x1;
      // metriky
      if (t >= p.t_w && t < p.t_Mz) {
        if (x0 > wMaxPred) { wMaxPred = x0; tPk = t; }
        if (isNaN(t10) && x0 >= 0.1 * p.omega_w) t10 = t;
        if (isNaN(t90) && x0 >= 0.9 * p.omega_w) t90 = t;
        if (t >= p.t_Mz - 0.05) { sumPred += x0; nPred++; }
      }
      if (t >= p.t_Mz && x0 < wMinPo) wMinPo = x0;
      if (t >= p.T - 0.05) { sumPo += x0; sumI += x1; sumU += x2; nPo++; }
      iPeak = Math.max(iPeak, Math.abs(x1)); uPeak = Math.max(uPeak, Math.abs(x2));
      if (j % step === 0 || j === N - 1) {
        out.t.push(t); out.w.push(x0); out.i.push(x1); out.uv.push(x2);
        out.ww.push(wref); out.iw.push(iref); out.ur.push(u); out.th.push(theta); out.q.push(Q); out.br.push(br);
      }
      if (j === N - 1) break;
      Q += h * R * x1 * x1; Esrc += h * x2 * x1; Emech += h * kPhi * x1 * x0;
      const a = f(x0, x1, x2, u, z, br);
      const b = f(x0 + h * a[0] / 2, x1 + h * a[1] / 2, x2 + h * a[2] / 2, u, z, br);
      const c = f(x0 + h * b[0] / 2, x1 + h * b[1] / 2, x2 + h * b[2] / 2, u, z, br);
      const d = f(x0 + h * c[0], x1 + h * c[1], x2 + h * c[2], u, z, br);
      const w0 = x0;
      x0 += h * (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6;
      x1 += h * (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6;
      x2 += h * (a[2] + 2 * b[2] + 2 * c[2] + d[2]) / 6;
      theta += h * (w0 + x0) / 2;
      if (!isFinite(x0) || !isFinite(x1) || !isFinite(x2)) { out.nestabilni = true; break; }
    }
    const W = p.omega_w, wPred = sumPred / nPred, wPo = sumPo / nPo;
    out.p = p; out.krok = krok;
    out.m = {
      w_pred: wPred, e_pred: pozadavek(p, p.t_Mz - h) - wPred, e_po: pozadavek(p, p.T) - wPo, w_po: wPo,
      prekmit: W > 0 ? Math.max(0, (wMaxPred - W) / W * 100) : 0,
      w_vrchol: wMaxPred, t_vrchol: tPk, i_uvolneni: iRel, Q_Cu: Q, E_zdroj: Esrc, E_mech: Emech,
      nabeh_ms: (t90 - t10) * 1e3, propad: wPred - wMinPo,
      i_peak: iPeak, u_peak: uPeak, i_end: sumI / nPo, u_end: sumU / nPo
    };
    return out;
  }

  // komplexní čísla pro frekvenční odhad
  const C = {
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    abs: a => Math.hypot(a[0], a[1]), arg: a => Math.atan2(a[1], a[0])
  };

  function pruchody(opt) {
    const p = Object.assign({}, BASE, opt);
    const Foi = om => C.div([p.Kri * p.Km, 0], C.mul([1, om * p.tau_m], [p.R, om * p.L]));
    const Fow = om => {
      const fo = Foi(om), fwi = C.div(fo, C.add([1, 0], fo));
      const pi = C.mul([p.Krw, 0], [1, -1 / (om * p.tau_rw)]);
      return C.mul(C.mul(pi, fwi), C.div([p.kPhi, 0], [0, p.J * om]));
    };
    const rez = F => {
      let lo = 1, hi = 1e6;
      for (let k = 0; k < 80; k++) { const mid = Math.sqrt(lo * hi); if (C.abs(F(mid)) > 1) lo = mid; else hi = mid; }
      const wc = Math.sqrt(lo * hi);
      let pm = 180 + C.arg(F(wc)) * 180 / Math.PI; if (pm > 180) pm -= 360;
      return { wc, pm };
    };
    const ri = rez(Foi), rw = rez(Fow);
    return { proud: ri.wc, pm_proud: ri.pm, otacky: rw.wc, pm_otacky: rw.pm, pomer: ri.wc / rw.wc };
  }

  const api = { BASE, simuluj, pruchody, pozadavek };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VMModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
