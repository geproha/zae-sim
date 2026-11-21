/* ZAE — Větší motor krok za krokem: výklad, schémata, grafy. Model: vetsi_motor_model.js */
'use strict';
const M = window.VMModel;
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const f = (x, d = 1) => { if (!isFinite(x)) return '—'; const [a, b] = Number(x).toFixed(d).split('.'); return a.replace('-', '−').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (b ? ',' + b : ''); };
const fk = (x, d = 1) => !isFinite(x) ? '?' : Number(x).toFixed(d).replace('.', '{,}');
const sub = (b, s) => `${b}<tspan baseline-shift="sub" font-size="72%">${s}</tspan>`;

// ------------------------------------------------------------------ stav
const P = Object.assign({}, M.BASE);
const S = { step: 1, overlay: true, cursor: 0.12, playing: false, sims: {}, cmp: [true, true, true, true, true], slow: 10, view: null, drag: null, sel: null, ev: [] };

const CTL = {
  omega_w: { l: 'Požadované otáčky ω*', min: 0, max: 250, st: 5, u: 'rad/s', d: 0, src: 'vymyšlené' , amin: 0, amax: 1500 },
  Mz: { l: 'Zátěžný moment M<sub>z</sub>', min: 0, max: 120, st: 5, u: 'N·m', d: 0, src: 'vymyšlené: 40' , amin: 0, amax: 400 },
  t_Mz: { l: 'Čas skoku zátěže', min: 0.05, max: 0.75, st: 0.01, u: 's', d: 2, src: 'vymyšlené: 0,40' },
  omega_w2: { l: 'Nové otáčky ω₂*', min: 0, max: 250, st: 5, u: 'rad/s', d: 0, src: 'vymyšlené: 100' , amin: 0, amax: 1500 },
  t_w2: { l: 'Čas změny otáček', min: 0.05, max: 1.15, st: 0.01, u: 's', d: 2, src: 'vymyšlené: 0,60' },
  J: { l: 'Moment setrvačnosti J', min: 0.02, max: 0.3, st: 0.01, u: 'kg·m²', d: 2, src: 'ZAE14 str. 7: 0,05' , amin: 0.02, amax: 3 },
  Kp_u: { l: 'Zesílení K<sub>p,u</sub> (otáčky → napětí)', min: 0.2, max: 6, st: 0.1, u: 'V·s/rad', d: 1, src: 'vymyšlené: 2' },
  tau_u: { l: 'Integrační čas τ<sub>u</sub>', min: 0.02, max: 0.4, st: 0.005, u: 's', d: 3, src: 'vymyšlené: 0,1' },
  Krw: { l: 'Zesílení K<sub>rω</sub> (otáčky → proud)', min: 2, max: 120, st: 1, u: 'A·s/rad', d: 0, src: 'ZAE14 str. 12: 40' , amin: 2, amax: 3000 },
  tau_rw: { l: 'Integrační čas τ<sub>rω</sub>', min: 0.005, max: 0.2, st: 0.005, u: 's', d: 3, src: 'ZAE14 str. 21: 0,025' },
  Kri: { l: 'Zesílení K<sub>ri</sub> (proud → napětí)', min: 0.5, max: 20, st: 0.1, u: 'V/A', d: 1, src: 'ZAE14 str. 10: 7,9' , amin: 0.05, amax: 10 },
  Imax: { l: 'Mez proudu I<sub>max</sub>', min: 20, max: 400, st: 10, u: 'A', d: 0, src: 'ZAE14 str. 21: 200' , amin: 20, amax: 1500 },
  Umax: { l: 'Mez napětí měniče U<sub>max</sub>', min: 40, max: 200, st: 5, u: 'V', d: 0, src: 'vymyšlené: 100' , amin: 40, amax: 600 }
};
const STEP_CTL = {
  1: ['omega_w', 'J'], 2: ['omega_w', 'J', 'Kp_u'], 3: ['omega_w', 'J', 'Kp_u', 'tau_u'],
  4: ['omega_w', 'J', 'Krw', 'tau_rw', 'Kri'], 5: ['omega_w', 'J', 'Krw', 'tau_rw', 'Kri', 'Imax', 'Umax'],
  6: ['omega_w', 'J', 'Kp_u', 'tau_u', 'Krw', 'tau_rw', 'Kri', 'Imax', 'Umax']
};
// profil AUTO: stejnosměrný ekvivalent jednoho motoru výkonného elektromobilu (odhad, viz poznámka v kroku)
const AUTO = { profil: 'auto', R: 0.01, L: 2e-4, J: 1.1, kPhi: 0.5, tau_m: 1e-4, Kri: 1, Krw: 1100, tau_rw: 0.02, Imax: 800, Umax: 400, Kp_u: 2, tau_u: 0.1,
  omega_w: 700, t_w: 0.1, Mz: 30, t_Mz: 3, T: 5, t_rampa: 1.5, omega_w2: 350, t_w2: 3.8, ff: true };
const KOLO = { r: 0.35, n: 9 }; // poloměr kola [m], převod motor : kolo (odhad)
const kmh = w => w * KOLO.r / KOLO.n * 3.6;
function rng(key) { const c = CTL[key]; return P.profil === 'auto' && c.amax != null ? [c.amin, c.amax] : [c.min, c.max]; }
// předvolby: nastaví více parametrů najednou (vždy od výchozích hodnot); volné posuvníky zůstávají
const PRESETS = {
  1: [['Výchozí', {}, 'Parametry ZAE14, 150 rad/s, zátěž 40 N·m v 0,4 s.'],
    ['Těžký setrvačník', { J: 0.3 }, 'J = 0,3 kg·m²: ω_n klesne, ζ vzroste — rozběh je pomalejší a méně kmitá.'],
    ['Malé otáčky bez zátěže', { omega_w: 30, zatez: false }, '30 rad/s bez poruchy: čistý rozběh motoru, proudová špička je úměrně menší.'],
    ['Zabrzděná kotva 30 V', { omega_w: 60, t_w: 0.05, T: 2, idealni: true, brzda: 'drzi', zatez: false }, 'Brzda drží: proud roste k U/R = 750 A, všechen příkon jde do tepla.'],
    ['Odbrzdění v 0,40 s', { omega_w: 60, t_w: 0.05, Mz: 5, t_Mz: 0.8, T: 2, idealni: true, brzda: 'uvolnit', t_brzda: 0.4 }, 'Referenční pokus z poznámky: 749,3 A při uvolnění, vrchol 164,4 rad/s.']],
  2: [['Výchozí K = 2', {}, 'Odchylka 30 rad/s, výrazné kmitání.'],
    ['Slabý P (K = 0,5)', { Kp_u: 0.5 }, 'Klidnější, ale motor dosáhne jen poloviny: ω = ω*·K/(K + kΦ) = 75 rad/s.'],
    ['Silný P (K = 6)', { Kp_u: 6 }, 'Odchylka jen 11,5 rad/s, ale tlumení klesne (ζ ≈ 0,05) a proud kmitá přes ±2 kA.'],
    ['Velká zátěž 120 N·m', { Mz: 120 }, 'Porucha 3× větší: P ji potlačí jen částečně.']],
  3: [['Výchozí τ_u = 0,1', {}, 'Nulová odchylka, ale silné kmitání.'],
    ['Pomalá integrace', { tau_u: 0.4 }, 'τ_u = 0,4 s: méně kmitá, odchylka mizí pomalu.'],
    ['Na hraně stability', { tau_u: 0.045 }, 'Těsně nad mezí Routhova kritéria (≈ 0,04 s): kmity skoro netlumí.'],
    ['Nestabilní', { tau_u: 0.03 }, 'Pod mezí: kmity rostou — smyčka je nestabilní.']],
  4: [['ZAE14 (výchozí)', {}, 'Rychlé a přesné, ale bez mezí obří proud a napětí.'],
    ['Plynulý požadavek (rampa)', { vstup: 'rampa' }, 'Rampa 150 ms: kaskáda potřebuje jen ≈ 107 A a 146 V — realistické i bez omezení.'],
    ['Měkký regulátor ω', { Krw: 10 }, 'K_rω = 10: pomalejší, menší proudová špička.'],
    ['Agresivní regulátor ω', { Krw: 120 }, 'K_rω = 120: menší překmit (3,6 %), ale proud až ≈ 18 kA. Otáčková smyčka se přiblíží proudové (poměr řezů ≈ 2,6×), takže zjednodušení „proudová smyčka ≈ 1“ přestává platit.'],
    ['Pomalý proudový regulátor', { Kri: 1 }, 'K_ri = 1: proud nesleduje předpis dost rychle, překmit otáček vzroste na ≈ 23 %.']],
  5: [['ZAE14 (výchozí)', {}, 'Rozběh na mezi proudu, jako náčrt ve skenu.'],
    ['Efektivní: rampa', { vstup: 'rampa' }, 'Rampa 150 ms: proud ani napětí nenarazí na mez, rozběh je plynulý.'],
    ['Slabý měnič I_max = 50 A', { Imax: 50 }, 'Čtvrtinový proud: rozběh trvá 4× déle. Zátěž 40 N·m je větší než kΦ·I_max = 25 N·m, takže ji motor neudrží a zpomaluje.'],
    ['Nedostatek napětí', { omega_w: 250 }, '250 rad/s potřebuje u_i = 125 V > U_max = 100 V: otáček nelze dosáhnout, ani integrátor nepomůže.'],
    ['Přetížení M_z = 120 N·m', { Mz: 120 }, 'Zátěž je větší než kΦ·I_max = 100 N·m: motor ji neudrží a zátěž ho začne otáčet zpět.'],
    ['Windup bez ochrany', { aw: false }, 'Bez podmíněné integrace se integrátor „navine“ a po rozběhu přijde velký překmit.'],
    ['Zpomalení s brzděním', { zmena: true, omega_w2: 50, t_w2: 0.6, T: 1.2 }, 'Pokles na 50 rad/s: proud jde na −I_max, motor brzdí a vrací energii do měniče.']],
  6: [['Výchozí', {}, 'Všechny kroky s parametry ZAE14.'], ['Rampa', { vstup: 'rampa' }, 'Plynulý požadavek ve všech krocích.'], ['Bez poruchy', { zatez: false }, 'Jen rozběh, bez skoku zátěže.']]
};
for (const k of [1, 2, 3, 4, 5, 6]) PRESETS[k].push(['🚗 Auto (odhad)', AUTO, 'Stejnosměrný ekvivalent jednoho motoru výkonného elektromobilu: 400 V, 800 A, třetina auta na hřídeli. Parametry jsou odhad — viz rozbalovací „Profil auto“.']);
const SHORT = { 1: 'Motor', 2: 'P regulátor', 3: 'PI regulátor', 4: 'Kaskáda', 5: 'Omezení', 6: 'Shrnutí' };

// odvozené teoretické hodnoty pro text
function teorie(p) {
  const wn = p.kPhi / Math.sqrt(p.L * p.J), z = p.R / (2 * p.L * wn);
  const k2 = p.kPhi * p.kPhi + p.Kp_u * p.kPhi, wn2 = Math.sqrt(k2 / (p.L * p.J)), z2 = p.R / (2 * p.L * wn2);
  return {
    wn, z, ta: p.L / p.R, tem: p.R * p.J / (p.kPhi * p.kPhi), wn2, z2,
    droop1: p.R * p.Mz / (p.kPhi * p.kPhi),
    e2: p.omega_w * p.kPhi / (p.Kp_u + p.kPhi), e2z: (p.omega_w * p.kPhi + p.R * p.Mz / p.kPhi) / (p.Kp_u + p.kPhi),
    tcrit: p.L * p.Kp_u / (p.R * (p.kPhi + p.Kp_u)),
    iEnd: p.Mz / p.kPhi, uEnd: p.R * p.Mz / p.kPhi + p.kPhi * p.omega_w,
    slope: p.kPhi * p.Imax / p.J, trozb: p.J * p.omega_w / (p.kPhi * p.Imax),
    iw0: p.Krw * p.omega_w
  };
}

// ------------------------------------------------------------------ profil auto
function autoNote(r) {
  const p = r.p, m = r.m, pr = M.pruchody(p);
  return ['🚗 Profil auto: odkud jsou parametry a co model neumí', String.raw`
<p><b>Je to odhad.</b> Skutečný motor výkonného elektromobilu je třífázový střídavý (synchronní nebo asynchronní) a řídí se vektorově. Vektorové řízení ale vede na stejnou strukturu jako tady: vnitřní smyčky řídí proud (tedy moment), nad nimi je smyčka otáček nebo požadavku pedálu. Proto lze jako myšlenkový model použít stejnosměrný ekvivalent.</p>
<p><b>Známé údaje (Tesla):</b> Model S Plaid má tři motory, každý s maximem 295 kW, baterii s jmenovitým napětím 407 V.</p>
<p><b>Odhad (vymyšlené pro řádovou představu):</b></p>
<ul>
<li>$U_{max} = 400\,\mathrm V$ (baterie), $I_{max} = 800\,\mathrm A$ → při plném napětí ≈ 320 kW na motor.</li>
<li>$k\Phi = 0{,}5\,\mathrm{V\,s/rad}$ → moment $k\Phi I_{max} = 400\,\mathrm{N\,m}$; plné napětí stačí do ≈ 800 rad/s (≈ 7 600 ot/min). Výš jde skutečný motor <i>odbuzováním</i>, které tento model nemá.</li>
<li>$R = 0{,}01\,\Omega$ (ztráty 6,4 kW při 800 A), $L = 0{,}2\,\mathrm{mH}$ ($\tau_a = 20\,\mathrm{ms}$), $\tau_m = 0{,}1\,\mathrm{ms}$ (rychlý měnič s tranzistory SiC).</li>
<li>$J = 1{,}1\,\mathrm{kg\,m^2}$: třetina auta o hmotnosti 2 200 kg přepočtená na hřídel motoru přes kolo $r = 0{,}35\,\mathrm m$ a převod $9 : 1$: $J = \frac{1}{3}\,m\,r^2/n^2$.</li>
<li>$M_z = 30\,\mathrm{N\,m}$ na motor ≈ stoupání 10 % ($m g \sin\alpha \cdot r / n / 3$).</li>
</ul>
<p><b>Kde je hmotnost auta, když zátěž ukazuje 0 N·m?</b> V setrvačnosti $J$. Hmotnost auta nebrzdí stálým momentem — brání jen <i>změně</i> rychlosti: $J\,\dot\omega = M - M_z$. Na rovině bez odporů (zanedbali jsme valivý odpor i vzduch) je $M_z = 0$; motor potřebuje moment jen na zrychlení a v ustálené rychlosti by stačil skoro nulový proud. Vnější zátěž $M_z$ představuje to, co působí i při stálé rychlosti: stoupání, odpor vzduchu, valivý odpor. Odečet u motoru proto ukazuje zvlášť moment motoru, vnější zátěž a zbytek, který jde na zrychlení.</p>
<p><b>Regulátory přeladěné:</b> $K_{ri} = 1\,\mathrm{V/A}$, $K_{r\omega} = 1\,100\,\mathrm{A\,s/rad}$, $\tau_{r\omega} = 0{,}02\,\mathrm s$. Řez proudové smyčky ≈ ${fk(pr.proud, 0)}\,\mathrm{rad/s}$, otáčkové ≈ ${fk(pr.otacky, 0)}\,\mathrm{rad/s}$ (poměr ${fk(pr.pomer, 1)}×). Zapnutá je <b>dopředná vazba</b> $u_i = k\Phi\omega$: bez ní by P regulátor proudu potřeboval odchylku $u/K_{ri} \approx 350\,\mathrm A$ a auto by nedojelo na požadovanou rychlost (vypni ji v kroku 5 a uvidíš).</p>
<p><b>Rychlost a zrychlení auta:</b> $v = \omega\,r/n$, $a = \dot\omega\,r/n$. Na mezi proudu je $a \approx \frac{k\Phi I_{max}}{J}\cdot\frac{r}{n} = ${fk(p.kPhi * p.Imax / p.J * KOLO.r / KOLO.n / 9.81, 2)}\,g$. V kroku 5 auto dojede z 0 na ${fk(kmh(p.omega_w), 0)} km/h asi za ${fk(p.J * p.omega_w / (p.kPhi * p.Imax), 1)} s — řádově jako výkonné elektromobily (orientačně kolem 2 s na 100 km/h).</p>
<p><b>Co model neumí:</b> odbuzování (vyšší rychlosti), přilnavost pneumatik (skutečné zrychlení omezuje tření kol), odpor vzduchu rostoucí s $v^2$, omezení výkonu baterie a teplotní omezení po opakovaných startech. Kroky 1–4 bez mezí opět ukazují nereálné proudy — u auta s $R = 0{,}01\,\Omega$ ještě větší.</p>`];
}

// ------------------------------------------------------------------ porucha a změna požadavku
function poruchaNote(k, p, T) {
  const Mz = p.Mz, dw = p.omega_w2 - p.omega_w, kk = p.kPhi;
  const krok = {
    1: String.raw`<p><b>Bez regulace</b> nikdo neopraví ani jedno. Porucha trvale ubere $\Delta\omega = R M_z/(k\Phi)^2 = ${fk(p.R * Mz / (kk * kk), 1)}\,\mathrm{rad/s}$. Změna požadavku jen přepočítá napětí $u_r = k\Phi\,\omega_2^*$ a motor se na nové otáčky znovu rozkmitá ($\zeta = ${fk(T.z, 2)}$).</p>`,
    2: String.raw`<p><b>P regulátor</b> potlačí poruchu jen částečně: přispěje odchylkou $\dfrac{R M_z}{k\Phi(k\Phi + K_{p,u})} = ${fk(p.R * Mz / (kk * (kk + p.Kp_u)), 2)}\,\mathrm{rad/s}$ místo ${fk(p.R * Mz / (kk * kk), 1)} bez regulace. Odchylka od požadavku se změní úměrně: pro $\omega_2^* = ${fk(p.omega_w2, 0)}$ je $\omega_2^* k\Phi/(k\Phi + K_{p,u}) = ${fk(p.omega_w2 * kk / (kk + p.Kp_u), 1)}\,\mathrm{rad/s}$.</p>`,
    3: String.raw`<p><b>PI regulátor</b> odstraní trvalou odchylku od poruchy i od změny požadavku (integrátor je před místem vstupu poruchy), ale obojí se vyrovnává pomalu a s kmitáním.</p>`,
    4: String.raw`<p><b>Kaskáda</b> odstraní obojí rychle. Po poruše musí trvale vzrůst proud o $M_z/k\Phi = ${fk(Mz / kk, 0)}\,\mathrm A$. Při změně požadavku skočí $i_w$ o $K_{r\omega}\Delta\omega^* = ${fk(p.Krw * dw, 0)}\,\mathrm A$ — bez mezí nereálně mnoho.</p>`,
    5: String.raw`<p><b>S mezemi</b> se změna otáček provede konstantním proudem. Zrychlení: $(k\Phi I_{max} - M_z)/J = ${fk((kk * p.Imax - (p.zatez ? Mz : 0)) / p.J, 0)}\,\mathrm{rad/s^2}$. Zpomalení: proud jde na $-I_{max}$, motor <b>brzdí</b> a vrací energii do měniče; zátěž brzdění pomáhá: $(k\Phi I_{max} + M_z)/J = ${fk((kk * p.Imax + (p.zatez ? Mz : 0)) / p.J, 0)}\,\mathrm{rad/s^2}$ (počítá s čtyřkvadrantovým měničem).</p>`
  }[k];
  return ['Porucha a změna požadavku: dvě úlohy regulace', String.raw`
<p>Regulační obvod řeší dvě různé úlohy. <b>Sledovat požadavek</b> $w = \omega^*$ (vstupuje do prvního součtového uzlu) a <b>potlačit poruchu</b> $z = M_z$ (vstupuje až do mechaniky, regulátor ji přímo nevidí). V Laplaceově tvaru se výstup skládá ze dvou přenosů:</p>
$$\Omega(p) = F_w(p)\,\Omega^*(p) - F_z(p)\,M_z(p)$$
<p>$F_w$ je přenos řízení, $F_z$ přenos poruchy uzavřené smyčky. Dobrý regulátor má $F_w(0) = 1$ (sleduje) a $F_z(0) = 0$ (potlačí). Obě úlohy zapínáš nezávisle v panelu parametrů, takže jde vidět každá zvlášť.</p>
${krok}
<p><b>Dává změna otáček smysl?</b> Ano: v praxi se požadavek mění (pracovní cyklus, jiná rychlost pásu) a test u regulace obvykle zkoumá odezvu na skok <i>požadavku</i> i <i>poruchy</i> zvlášť. Zpomalení navíc ukáže brzdění motorem, které se při rozběhu neobjeví.</p>`];
}

// ------------------------------------------------------------------ pokus s brzdou (krok 1)
function brzdaText(m, p) {
  const U = p.kPhi * p.omega_w, I = U / p.R, vol = S.volny ? S.volny.m : null;
  if (p.brzda === 'drzi') return String.raw`<b>Brzda drží hřídel.</b> Napětí $${fk(U, 0)}\,\mathrm V$ skočí, proud roste s $\tau_a = L/R = 50\,\mathrm{ms}$ k $U/R = ${fk(I, 0)}\,\mathrm A$, otáčky zůstanou nulové. Nevzniká $u_i$, takže proud nic neomezí kromě odporu. Celý příkon $U^2/R = ${fk(U * U / p.R / 1000, 1)}\,\mathrm{kW}$ se mění v teplo vinutí.`;
  return String.raw`Při uvolnění v ${f(p.t_brzda * 1000, 0)} ms už kotvou teče <b>${f(m.i_uvolneni, 0)} A</b> (moment ${f(p.kPhi * m.i_uvolneni, 0)} N·m). Hřídel prudce zrychlí: první vrchol <b>${f(m.w_vrchol, 1)} rad/s</b> v ${f(m.t_vrchol * 1000, 0)} ms${vol ? `, bez brzdy jen ${f(vol.w_vrchol, 1)} rad/s` : ''}. Jak roste $u_i$, proud klesá a může se obrátit: motor pak brzdí a vrací energii do zdroje.`;
}
function brzdaNotes(p) {
  if (S.step !== 1) return [];
  const R = refBrzda();
  const rows = REF_POZN.map(([t, b], j) => { const m = R[j]; const irel = b === 'uvolnit' ? f(m.i_uvolneni, 1) + ' A' : b === 'drzi' ? '→ ' + f(m.i_end, 1) + ' A' : '0 A'; const vr = b === 'drzi' ? 'hřídel stojí' : `${f(m.w_vrchol, 1)} rad/s v ${f(m.t_vrchol, 4)} s`; return `<tr><td>${t}</td><td>${REF_POZN[j][3]}</td><td>${irel}</td><td>${REF_POZN[j][4]}</td><td>${vr}</td></tr>`; }).join('');
  return [
    ['Pokus s brzdou: proč pozdější uvolnění zvětší překmit', String.raw`
<p>Dokud brzda drží, je $\omega = 0$ a tedy i $u_i = 0$. Proud roste jen přes $R$ a $L$:</p>
$$i(t) = \frac{U}{R}\left(1 - e^{-(t - t_0)/\tau_a}\right),\qquad \tau_a = \frac{L}{R} = 50\,\mathrm{ms}$$
<p>V okamžiku uvolnění už existuje velký moment $M = k\Phi\,i$, takže hřídel zrychlí mnohem prudčeji než při rozběhu z nulového proudu. S rostoucí rychlostí roste $u_i = k\Phi\omega$ a proud klesá. Když je proud při kladné rychlosti záporný, motor brzdí a vrací energii do zdroje (model předpokládá, že ji ideální zdroj přijme). Při uvolnění se zachovává proud i rychlost: obě veličiny jsou stavy (energie v $L$ a $J$), skokem se změnit nemohou.</p>`],
    ['Referenční pokus z poznámky a shoda tohoto modelu', String.raw`
<p>Ideálních 30 V od 0,05 s, $M_z = 5\,\mathrm{N\,m}$ od 0,8 s, záznam 2 s, $R = 0{,}04\,\Omega$, $L = 2\,\mathrm{mH}$, $J = 0{,}05\,\mathrm{kg\,m^2}$, $k\Phi = 0{,}5$. Hodnoty z poznámky patří k průvodci Codex 1.3; vpravo je výpočet tohoto modelu (tlačítko „Referenční pokus“ nastaví totéž).</p>
<div class="scroll"><table><tr><th>Brzda</th><th>Proud při uvolnění (poznámka)</th><th>tento model</th><th>První vrchol ω (poznámka)</th><th>tento model</th></tr>${rows}</table></div>
<p class="note">Čas vrcholu 0,1874 s vs. 0,188 s v poznámce je jen zaokrouhlení. Stejné hodnoty dává <code>motor_kaskada.py --brzda</code>.</p>`],
    ['Výkony a teplo: kolik dodá zdroj a co vydrží vinutí', String.raw`
$$P_{zdroj} = u_v\,i,\qquad P_{Cu} = R\,i^2,\qquad P_{mech} = M\,\omega,\qquad Q_{Cu} = \int_0^t R\,i^2\,\mathrm dt$$
<p>Při náběhu jde část příkonu do magnetického pole $\tfrac12 L i^2$. Po ustálení zabrzděné kotvy je $I_\infty = U/R$ a celý příkon $U^2/R$ je teplo: pro 30 V je to 750 A a 22,5 kW, mechanický výkon je nulový. Poloviční napětí dá poloviční proud a čtvrtinový ohřev. Odečet vpravo od motoru ukazuje okamžité výkony a nasčítané teplo v čase kurzoru.</p>
<p>Model má konstantní odpor; bez údajů konkrétního motoru (proudové omezení zdroje, průřez a tepelná kapacita vinutí, chlazení) z něj nelze určit bezpečnou dobu zabrzdění. Příklad z praxe uvádí poznámka <i>Větší motor — poznámky pro druhou simulaci</i>.</p>`]
  ];
}

// ------------------------------------------------------------------ texty kroků
const STEPS = {
  1: {
    title: 'Krok 1 · Samotný motor bez regulace',
    sub: 'Nejdřív poznáme soustavu. Měnič dostane napětí, které by v ustáleném stavu naprázdno dalo požadované otáčky. Nic neměříme, nic neopravujeme.',
    add: (m, p) => String.raw`Motor napájený z měniče. Povel nastavíme naslepo z požadavku: $u_r = k\Phi\,\omega^*/K_m = ${fk(p.kPhi * p.omega_w / p.Km, 0)}\,\mathrm{V}$.`,
    why: (m, p, T) => String.raw`Motor má dvě „paměti“: proud v indukčnosti $L$ a otáčky setrvačnosti $J$. Spolu tvoří soustavu 2. řádu, která sama kmitá ($\zeta = ${fk(T.z, 2)}$).`,
    see: (m, p, T) => p.brzda !== 'volno' ? brzdaText(m, p) : String.raw`Otáčky přestřelí o <b>${f(m.prekmit, 0)} %</b> a doznívají. Proud při rozběhu vystřelí na <b>${f(m.i_peak, 0)} A</b>. ${p.zatez && p.Mz > 0 ? String.raw`Po zátěži motor trvale zpomalí o <b>${f(T.droop1, 1)} rad/s</b> (teorie $RM_z/(k\Phi)^2$) a nikdo to nepozná.` : 'Porucha je vypnutá — zapni ji a uvidíš trvalý pokles otáček.'}`,
    notes: (p, T) => [
      ...brzdaNotes(p),
      ['Elektrická část kotvy — napěťová rovnice', String.raw`
<p>Druhý Kirchhoffův zákon pro obvod kotvy: napětí měniče pokryje úbytek na odporu, změnu proudu v indukčnosti a indukované napětí.</p>
$$u_v = R\,i + L\frac{\mathrm{d}i}{\mathrm{d}t} + u_i,\qquad u_i = k\Phi\,\omega$$
<p>Pro simulaci izolujeme derivaci, protože ta říká, o kolik se proud změní v dalším kroku:</p>
$$\frac{\mathrm{d}i}{\mathrm{d}t} = \frac{u_v - R\,i - k\Phi\,\omega}{L}\qquad\left[\frac{\mathrm{V}}{\mathrm{H}} = \frac{\mathrm{A}}{\mathrm{s}}\right]$$
<p>$R = ${fk(p.R, 2)}\,\Omega$, $L = ${fk(p.L, 3)}\,\mathrm{H}$ (ZAE14 str. 7). Indukované napětí $u_i$ působí proti $u_v$: čím rychleji se motor točí, tím méně napětí zbude na protlačení proudu.</p>
<p><b>Je zpětná vazba přes $u_i$ opravdu součástí motoru?</b> Ano. Nikdo nic neměří ani nepočítá: vodiče kotvy se otáčejí v magnetickém poli buzení, a proto se v nich indukuje napětí $u_i = k\Phi\,\omega$ (motor se zároveň chová jako dynamo). Ve schématu je to proto uvnitř rámečku MOTOR a odečítá se v součtovém uzlu před kotvou. Tuto vazbu má každý stejnosměrný motor; díky ní se i neregulovaný motor ustálí na konečných otáčkách (bez ní by byl čistý integrátor $1/(Jp)$ a otáčky by rostly bez omezení). Měřené zpětné vazby (čidlo otáček, čidlo proudu) přibudou až v krocích 2 a 4 a vedou mimo motor do regulátorů.</p>`],
      ['Mechanická část — pohybová rovnice', String.raw`
$$M = k\Phi\,i,\qquad J\frac{\mathrm{d}\omega}{\mathrm{d}t} = M - M_z$$
<p>Rozdíl momentu motoru a zátěže zrychluje setrvačnost. V ustáleném stavu je $\mathrm{d}\omega/\mathrm{d}t = 0$, ale motor dál dodává moment proti zátěži: $i = M_z/(k\Phi)$.</p>
<p><b>Jednotky:</b> $[k\Phi] = \mathrm{V\,s/rad} = \mathrm{N\,m/A}$. Elektrický výkon přeměněný v motoru se rovná mechanickému: $u_i\,i = M\,\omega$. Pro $u_i = c_e\,\omega$ a $M = c_m\,i$ z toho plyne $c_e = c_m = k\Phi$. Jednotky: $\mathrm{V\,s} = \frac{\mathrm{W}}{\mathrm{A}}\,\mathrm{s} = \frac{\mathrm{N\,m}}{\mathrm{A}}$ (radián je bezrozměrný). $J = ${fk(p.J, 2)}\,\mathrm{kg\,m^2}$, $k\Phi = ${fk(p.kPhi, 1)}\,\mathrm{V\,s/rad}$.</p>`],
      ['Z rovnic do přenosů (Laplaceova transformace)', String.raw`
<p>Při nulových počátečních podmínkách nahradíme $\frac{\mathrm{d}}{\mathrm{d}t} \to p$. Kotva (napětí, které zbude po odečtení $U_i$, na proud):</p>
$$F_{RL}(p) = \frac{I(p)}{U_v(p) - U_i(p)} = \frac{1}{R + pL} = \frac{1/R}{1 + p\tau_a},\qquad \tau_a = \frac{L}{R} = ${fk(T.ta * 1e3, 0)}\,\mathrm{ms}$$
<p>Mechanika a měnič:</p>
$$\Omega(p) = \frac{M(p) - M_z(p)}{Jp},\qquad F_m(p) = \frac{U_v(p)}{U_r(p)} = \frac{K_m}{1 + p\tau_m},\quad \tau_m = \frac{1}{f_{PWM}} = ${fk(p.tau_m * 1e3, 2)}\,\mathrm{ms}$$
<p>Celý motor: dosadíme $I = \dfrac{U_v - k\Phi\,\Omega}{R + pL}$ do $Jp\,\Omega = k\Phi\,I - M_z$:</p>
$$Jp\,\Omega\,(R + pL) = k\Phi\,U_v - (k\Phi)^2\,\Omega - (R + pL)\,M_z$$
$$\Omega(p) = \underbrace{\frac{k\Phi}{LJp^2 + RJp + (k\Phi)^2}}_{F_u(p)}\,U_v(p) \;-\; \underbrace{\frac{R + pL}{LJp^2 + RJp + (k\Phi)^2}}_{F_z(p)}\,M_z(p)$$
<p>Motor tedy není jen integrátor $1/(Jp)$: vnitřní vazba přes $u_i$ z něj dělá soustavu 2. řádu se stabilním ustáleným stavem.</p>`],
      ['Proč motor kmitá — charakteristický polynom', String.raw`
$$LJp^2 + RJp + (k\Phi)^2 = 0 \;\Rightarrow\; p^2 + 2\zeta\omega_n p + \omega_n^2 = 0$$
$$\omega_n = \frac{k\Phi}{\sqrt{LJ}} = ${fk(T.wn, 1)}\,\mathrm{rad/s},\qquad \zeta = \frac{R}{2L\,\omega_n} = \frac{1}{2}\sqrt{\frac{\tau_{em}}{\tau_a}} = ${fk(T.z, 3)}$$
<p>Elektromechanická časová konstanta $\tau_{em} = RJ/(k\Phi)^2 = ${fk(T.tem * 1e3, 1)}\,\mathrm{ms}$. Aperiodický (nekmitavý) rozběh by vyžadoval $\tau_{em} \ge 4\tau_a$. Tady je $\tau_a$ velká (velká indukčnost vůči odporu), proto póly vyjdou komplexní a motor kmitá s periodou asi $2\pi/(\omega_n\sqrt{1-\zeta^2}) = ${fk(2 * Math.PI / (T.wn * Math.sqrt(Math.max(1e-9, 1 - T.z * T.z))) * 1e3, 0)}\,\mathrm{ms}$.</p>
<p>Zkus zvětšit $J$: $\omega_n$ klesne, $\zeta$ vzroste, kmitání se zpomalí a utlumí.</p>`],
      ['Co je na začátku a na konci', String.raw`
<p><b>Na začátku</b> nemůže skočit proud (indukčnost $L$) ani otáčky (setrvačnost $J$). Skočit může jen povel; napětí měniče nabíhá s $\tau_m$. Proud zprvu roste se strmostí $\mathrm{d}i/\mathrm{d}t \approx u_v/L$.</p>
<p><b>Na konci</b> jsou všechny derivace nulové:</p>
$$i_\infty = \frac{M_z}{k\Phi} = ${fk(T.iEnd, 0)}\,\mathrm{A},\qquad \omega_\infty = \frac{u_v - R\,i_\infty}{k\Phi} = \omega^* - \frac{R\,M_z}{(k\Phi)^2} = ${fk(p.omega_w - T.droop1, 1)}\,\mathrm{rad/s}$$
<p>Bez zátěže by $\omega_\infty = \omega^*$ přesně. Ovládání naslepo funguje jen tehdy, když dokonale známe motor i zátěž.</p>`]
    ]
  },
  2: {
    title: 'Krok 2 · P regulátor otáček',
    sub: 'Přidáme čidlo otáček a nejjednodušší regulátor. Vznikne první uzavřená smyčka: w → e → u → y a zpět.',
    add: (m, p) => String.raw`Tachodynamo (čidlo otáček) a P regulátor: $u_r = K_{p,u}\,e_\omega$, kde $e_\omega = \omega^* - \omega$. Výstupem regulátoru je přímo povel měniči.`,
    why: () => String.raw`Bez zpětné vazby motor nepozná zátěž ani chybu nastavení. Regulátor porovná požadavek se skutečností a přidá napětí úměrně tomu, kolik chybí.`,
    see: (m, p, T) => String.raw`Zbude ustálená odchylka <b>${f(m.e_pred, 1)} rad/s</b> (teorie $${fk(T.e2, 1)}$): P regulátor potřebuje odchylku, aby vůbec dal napětí. ${p.zatez && p.Mz > 0 ? `Zátěž přidá jen ${f(T.e2z - T.e2, 1)} rad/s.` : ''} Tlumení ale kleslo na $\zeta = ${fk(T.z2, 2)}$: překmit <b>${f(m.prekmit, 0)} %</b>, proud až <b>${f(m.i_peak, 0)} A</b>.`,
    notes: (p, T) => [
      ['Proč P regulátor neroztočí motor na požadované otáčky?', String.raw`
<p>P regulátor dává napětí <b>jen úměrně odchylce</b>: $u_r = K_{p,u}\,e_\omega$. Bez odchylky by dal nulové napětí a motor by se zastavil. Aby se motor točil rychlostí $\omega$, potřebuje přibližně napětí $u \approx k\Phi\,\omega$ (pokrýt indukované napětí). To musí regulátor vyrobit z odchylky:</p>
$$K_{p,u}\,(\omega^* - \omega) = k\Phi\,\omega\;\Rightarrow\;\omega = \omega^*\frac{K_{p,u}}{K_{p,u} + k\Phi} = ${fk(p.omega_w, 0)}\cdot\frac{${fk(p.Kp_u, 1)}}{${fk(p.Kp_u + p.kPhi, 1)}} = ${fk(p.omega_w * p.Kp_u / (p.Kp_u + p.kPhi), 1)}\,\mathrm{rad/s}$$
<p>Rovnováha nastane tam, kde odchylka „vyrobí“ právě potřebné napětí. Jako pružina, která drží závaží: drží ho jen tehdy, když je trochu natažená. Větší $K_{p,u}$ = tužší pružina = menší odchylka, ale nikdy nulová (a soustava víc kmitá). Odchylku odstraní až integrační složka (krok 3), která si potřebné napětí „pamatuje“ i při nulové odchylce.</p>`],
      ['P regulátor', String.raw`
$$u_r(t) = K_{p,u}\,e_\omega(t),\qquad F_R(p) = K_{p,u} = ${fk(p.Kp_u, 1)}\,\mathrm{V\,s/rad}$$
<p>Jednotka: kolik voltů povelu dá regulátor na každý chybějící rad/s. Regulátor nemá paměť: při nulové odchylce dá nulové napětí.</p>`],
      ['Uzavřená smyčka a tlumení', String.raw`
<p>Přenos řízení (měnič zanedbán, $\tau_m \ll \tau_a$):</p>
$$F_w(p) = \frac{\Omega(p)}{\Omega^*(p)} = \frac{F_R F_u}{1 + F_R F_u} = \frac{K_{p,u}\,k\Phi}{LJp^2 + RJp + (k\Phi)^2 + K_{p,u}\,k\Phi}$$
$$\omega_{n} = \sqrt{\frac{(k\Phi)^2 + K_{p,u}k\Phi}{LJ}} = ${fk(T.wn2, 1)}\,\mathrm{rad/s},\qquad \zeta = \frac{R}{2L\,\omega_n} = ${fk(T.z2, 3)}$$
<p>Zesílení zvětšuje jen absolutní člen polynomu. Smyčka zrychlí, ale člen s $p$ (tlumení) zůstává stejný, takže $\zeta$ klesá. Proto větší $K_{p,u}$ = menší odchylka, ale víc kmitání.</p>`],
      ['Ustálená odchylka — věta o koncové hodnotě', String.raw`
$$e(\infty) = \lim_{t\to\infty} e(t) = \lim_{p\to 0} p\,E(p)$$
<p>Pro skok $\Omega^*(p) = \omega^*/p$ a skok zátěže $M_z(p) = M_z/p$ dosadíme $p \to 0$ do přenosů ($F_u(0) = 1/k\Phi$, $F_z(0) = R/(k\Phi)^2$):</p>
$$e(\infty) = \frac{\omega^*}{1 + K_{p,u}/k\Phi} + \frac{R\,M_z/k\Phi}{k\Phi + K_{p,u}} = \frac{\omega^* k\Phi + R\,M_z/k\Phi}{k\Phi + K_{p,u}}$$
<p>Bez zátěže $${fk(T.e2, 1)}\,\mathrm{rad/s}$, se zátěží $${fk(T.e2z, 1)}\,\mathrm{rad/s}$. Zátěž se projeví ${fk(T.droop1 / (T.e2z - T.e2), 1)}× slaběji než bez regulace, ale nezmizí.</p>`],
      ['Vyzkoušej', String.raw`<p>Zvyš $K_{p,u}$ na 5: odchylka klesne na zhruba ${fk(p.omega_w * p.kPhi / (5 + p.kPhi), 0)} rad/s, ale kmitání a špička proudu porostou. Sniž na 0,5: klidnější, ale motor dosáhne jen poloviny otáček. Tohle dilema řeší až integrační složka (krok 3) a pak kaskáda (krok 4).</p>`]
    ]
  },
  3: {
    title: 'Krok 3 · PI regulátor otáček',
    sub: 'Regulátor dostane paměť: sčítá odchylku v čase. Ustálená odchylka zmizí, ale zaplatíme za to stabilitou.',
    add: () => String.raw`Integrační složku: $u_r = K_{p,u}\left(e_\omega + \dfrac{1}{\tau_u}\displaystyle\int e_\omega\,\mathrm{d}t\right)$.`,
    why: () => String.raw`Integrál roste, dokud odchylka nezmizí — jako dluh, který se splácí, dokud není nula. Odstraní odchylku od požadavku i od zátěže.`,
    see: (m, p, T) => m.nestabilni ? String.raw`<b>Smyčka je nestabilní!</b> Pro $K_{p,u} = ${fk(p.Kp_u, 1)}$ musí být $\tau_u > ${fk(T.tcrit, 3)}\,\mathrm{s}$.` :
      String.raw`Odchylka na konci <b>${f(m.e_po, 2)} rad/s</b>. Integrátor ale přidal fázové zpoždění: překmit <b>${f(m.prekmit, 0)} %</b>, proud až <b>±${f(m.i_peak, 0)} A</b>, kmitání dlouho nedozní. Pro $\tau_u < ${fk(T.tcrit, 3)}\,\mathrm{s}$ by smyčka byla nestabilní.`,
    notes: (p, T) => [
      ['PI regulátor v čase a v Laplaceově tvaru', String.raw`
$$u_r(t) = K_{p,u}\left(e(t) + \frac{1}{\tau_u}\int_0^t e(\tau)\,\mathrm{d}\tau\right),\qquad F_R(p) = K_{p,u}\left(1 + \frac{1}{p\tau_u}\right) = K_{p,u}\frac{1 + p\tau_u}{p\tau_u}$$
<p>$\tau_u$ [s] je doba, za kterou integrační složka při konstantní odchylce dorovná proporcionální. Menší $\tau_u$ = silnější integrace.</p>`],
      ['Proč zmizí ustálená odchylka', String.raw`
<p>Regulátor má pól v $p = 0$, takže $F_R(p) \to \infty$ pro $p \to 0$. Ve větě o koncové hodnotě pak:</p>
$$e(\infty) = \lim_{p\to 0} \frac{\omega^*}{1 + F_R(p)F_u(p)} = 0$$
<p>Totéž platí pro skok zátěže, protože integrátor je před místem, kde porucha vstupuje. Smyčka je astatická 1. řádu.</p>`],
      ['Stabilita — Routhovo kritérium', String.raw`
<p>Charakteristická rovnice uzavřené smyčky (bez $\tau_m$), vynásobená $p\tau_u$ a vydělená $\tau_u$:</p>
$$LJp^3 + RJp^2 + \left[(k\Phi)^2 + K_{p,u}k\Phi\right]p + \frac{K_{p,u}k\Phi}{\tau_u} = 0$$
<p>Polynom 3. řádu $a_3p^3 + a_2p^2 + a_1p + a_0$ je stabilní, když jsou všechny koeficienty kladné a $a_2a_1 > a_3a_0$:</p>
$$RJ\left[(k\Phi)^2 + K_{p,u}k\Phi\right] > LJ\frac{K_{p,u}k\Phi}{\tau_u}\;\Rightarrow\;\tau_u > \frac{L\,K_{p,u}}{R\,(k\Phi + K_{p,u})} = ${fk(T.tcrit, 3)}\,\mathrm{s}$$
<p>Zkus posuvník $\tau_u$ pod tuto mez. Měnič ($\tau_m$) mez ještě mírně zvýší.</p>`],
      ['Proč jeden regulátor nestačí', String.raw`<p>Regulátor vidí jen otáčky. Proud je vnitřní stav, který nikdo nehlídá: aby regulátor rychle opravil otáčky, musí pustit obrovský proud, a přitom ho brzdí vlastní kmitavost motoru ($\zeta = ${fk(T.z, 2)}$). Řešení: proud změřit a řídit samostatně ve vnitřní smyčce.</p>`]
    ]
  },
  4: {
    title: 'Krok 4 · Kaskáda s proudovou smyčkou',
    sub: 'Přidáme čidlo proudu a vnitřní proudovou smyčku. Regulátor otáček už nezadává napětí, ale požadovaný proud, tedy moment.',
    add: (m, p) => String.raw`Čidlo proudu a P regulátor proudu $u_r = K_{ri}(i_w - i)$. Nadřazený PI regulátor otáček dává $i_w = K_{r\omega}\left(e_\omega + \frac{1}{\tau_{r\omega}}\int e_\omega\,\mathrm{d}t\right)$ v ampérech.`,
    why: () => String.raw`Proud je moment ($M = k\Phi\,i$). Když ho rychle hlídá vnitřní smyčka, chová se motor pro vnější regulátor jako zdroj momentu a zbyde jednoduchá mechanika $1/(Jp)$. Kmitavost kotvy potlačí proudová smyčka.`,
    see: (m, p, T) => String.raw`Náběh <b>${f(m.nabeh_ms, 1)} ms</b>, překmit <b>${f(m.prekmit, 0)} %</b>, ${p.zatez && p.Mz > 0 ? `po zátěži propad jen ${f(m.propad, 1)} rad/s a návrat na nulu` : 'bez poruchy (vypnutá)'}. Jenže bez mezí lineární model chce proud <b>${f(m.i_peak, 0)} A</b> a napětí <b>${f(m.u_peak, 0)} V</b>. Takový motor ani měnič neexistuje.`,
    notes: (p, T, pr) => [
      ['Struktura kaskády', String.raw`
$$F_{R\omega}(p) = K_{r\omega}\left(1 + \frac{1}{p\tau_{r\omega}}\right)\;[\mathrm{A\,s/rad}],\qquad F_{Ri}(p) = K_{ri}\;[\mathrm{V/A}]$$
<p>Výstup otáčkového regulátoru $i_w$ je požadavek (w) pro proudovou smyčku. Postup návrhu: nejdřív naladit vnitřní proudovou smyčku, pak ji vnější regulátor vidí jako část své soustavy. Parametry $K_{ri} = 7{,}9$ (str. 10), $K_{r\omega} = 40$ (str. 12), $\tau_{r\omega} = 0{,}025\,\mathrm{s}$ (str. 21) jsou ze ZAE14.</p>`],
      ['Proudová smyčka', String.raw`
<p>Pro návrh se indukované napětí $u_i$ bere jako pomalá porucha (otáčky se mění mnohem pomaleji než proud):</p>
$$F_{oi}(p) = K_{ri}\cdot\frac{K_m}{1 + p\tau_m}\cdot\frac{1}{R + pL},\qquad F_{oi}(0) = \frac{K_{ri}K_m}{R} = ${fk(p.Kri * p.Km / p.R, 1)}$$
$$F_{wi}(p) = \frac{I(p)}{I_w(p)} = \frac{F_{oi}}{1 + F_{oi}},\qquad F_{wi}(0) = ${fk((p.Kri * p.Km / p.R) / (1 + p.Kri * p.Km / p.R), 3)}$$
<p>P regulátor proudu má trvalou odchylku: aby dal napětí $u_v$, potřebuje $e_i = u_v/(K_mK_{ri})$. Při 75 V je to asi ${fk(75 / (p.Km * p.Kri), 1)} A. Otáčkový PI ji sám dorovná tím, že zvýší $i_w$ (v grafu je $i_w$ trvale nad $i$).</p>`],
      ['Otáčková smyčka', String.raw`
<p>S rychlou proudovou smyčkou ($F_{wi} \approx 1$) vidí regulátor otáček jen mechaniku:</p>
$$F_{o\omega}(p) \approx K_{r\omega}\frac{1 + p\tau_{r\omega}}{p\tau_{r\omega}}\cdot k\Phi\cdot\frac{1}{Jp}$$
<p>Pro $\omega \gg 1/\tau_{r\omega}$ je $|F_{o\omega}| \approx K_{r\omega}k\Phi/(J\omega)$, takže frekvence řezu $\omega_c \approx K_{r\omega}k\Phi/J = ${fk(p.Krw * p.kPhi / p.J, 0)}\,\mathrm{rad/s}$. Integrátor mechaniky zajistí nulovou odchylku od požadavku, integrátor regulátoru nulovou odchylku od zátěže.</p>`],
      ['„Proudová smyčka 100× rychlejší než otáčková“', String.raw`
<p>Frekvence řezu $|F_o(j\omega_c)| = 1$ spočtené z plného modelu (s měničem):</p>
$$\omega_{c,i} \approx ${fk(pr.proud, 0)}\,\mathrm{rad/s}\;(\text{rezerva fáze } ${fk(pr.pm_proud, 0)}^\circ),\qquad \omega_{c,\omega} \approx ${fk(pr.otacky, 0)}\,\mathrm{rad/s}\;(${fk(pr.pm_otacky, 0)}^\circ)$$
<p>Poměr je asi <b>${fk(pr.pomer, 1)}×</b>. Ruční zápis uvádí „100×“ jako pravidlo, kam míříme; ve výukovém příkladu ZAE14 je oddělení menší a kaskáda přesto funguje. Čím větší oddělení, tím přesněji platí zjednodušení $F_{wi} \approx 1$. Zkus zvětšit $K_{r\omega}$ a sleduj, kdy se odezva začne kazit.</p>`],
      ['Jsou 6,6 kA a 26,6 kV reálné? A jak je to u skutečných pohonů?', String.raw`
<p><b>Ne, reálné nejsou.</b> Matematicky jsou správně: lineární model bez mezí poslušně spočítá, co by regulátor chtěl. Fyzicky je to ale nemožné ze dvou důvodů:</p>
<ul>
<li><b>Napětí:</b> měnič dá nejvýš napětí svého zdroje. Tyristorový můstek napájený ze sítě 3 × 400 V dá naprázdno nejvýš $U_{di0} = 1{,}35\cdot 400 \approx 540\,\mathrm V$; motory k němu mívají jmenovité napětí kotvy kolem 400–500 V. 26,6 kV je zhruba 50× víc.</li>
<li><b>Proud:</b> průmyslové měniče pro stejnosměrné motory se dimenzují tak, že snesou krátkodobé přetížení typicky <b>150 % jmenovitého proudu po dobu 60 s</b> (třída DC II) nebo <b>200 % po 10 s</b> (DC IV), vždy po 15 min při jmenovitém proudu. Uvádějí to např. ABB DCS800 a Siemens SIMOREG/SINAMICS DCM. Regulátor proudu proto má omezení nastavené na tyto hodnoty.</li>
</ul>
<p>U výukového motoru ZAE14 ($R = 0{,}04\,\Omega$, $k\Phi = 0{,}5$) dává mez $I_{max} = 200\,\mathrm A$ maximální moment $k\Phi I_{max} = 100\,\mathrm{N\,m}$. 6 647 A by byl 33× tento limit. Vinutí, kartáče i polovodiče by to nepřežily: kartáče a komutátor by jiskřily a ztráty $Ri^2 \approx ${fk(p.R * 6647 * 6647 / 1e6, 1)}\,\mathrm{MW}$ by vinutí zničily během okamžiku.</p>
<p>Proto skutečný pohon vypadá jako krok 5: proud omezený na 1,5–2× jmenovitý, napětí omezené měničem, rozběh po přímce. Kaskáda bez mezí (tento krok) je jen myšlenkový mezikrok, který ukazuje <i>strukturu</i> regulace. Realistické proudy dá i bez omezení plynulý požadavek: předvolba „Plynulý požadavek (rampa)“ potřebuje jen ≈ 107 A.</p>
<p class="note">Zdroje: ABB DCS800 Technical catalogue (třídy DC II/DC IV), Siemens SINAMICS DCM Base Drives brochure (150 % po 60 s každých 15 min). Konkrétní motor ZAE14 je výukový, jeho jmenovitý proud v podkladech není; mez 200 A je ze str. 21.</p>`],
      ['Proč tak obří proud a napětí', String.raw`
<p>V okamžiku skoku je $e_\omega = \omega^*$, takže $i_w(0^+) = K_{r\omega}\,\omega^* = ${fk(T.iw0, 0)}\,\mathrm{A}$ a povel měniči $u_r = K_{ri}(i_w - i) \approx ${fk(p.Kri * T.iw0 / 1000, 0)}\,\mathrm{kV}$. Lineární model nic neomezuje, proto „funguje“. Skutečný pohon by to nepřežil. Proto krok 5.</p>`]
    ]
  },
  5: {
    title: 'Krok 5 · Omezení proudu a napětí',
    sub: 'Doplníme to, co má každý skutečný pohon: mez proudu, mez napětí měniče a ochranu integrátoru před „navinutím“.',
    add: (m, p) => String.raw`Omezení požadavku proudu na $\pm I_{max} = \pm${fk(p.Imax, 0)}\,\mathrm{A}$, omezení povelu měniči na $\pm U_{max} = \pm${fk(p.Umax, 0)}\,\mathrm{V}$ a anti-windup (integrace se na mezi zastaví).`,
    why: () => String.raw`Motor snese jen omezený proud (oteplení, komutace, měnič) a měnič dá jen napětí meziobvodu. Omezení $i_w$ je přirozené místo: rovnou omezuje moment.`,
    see: (m, p, T) => String.raw`Proud drží mez (špička <b>${f(m.i_peak, 0)} A</b>), otáčky rostou po přímce se sklonem $\approx ${fk(T.slope, 0)}\,\mathrm{rad/s^2}$ a ω* dosáhnou asi za ${f(T.trozb * 1e3, 0)} ms. Překmit <b>${f(m.prekmit, 1)} %</b>. Napětí nejdřív na $U_{max}$, pak propad, roste s $u_i$ a ustálí se na <b>${f(m.u_end, 1)} V</b>. Přesně jako náčrt ve skenu.`,
    notes: (p, T) => [
      ['Saturace', String.raw`
$$\operatorname{sat}_{\pm X}(v) = \begin{cases} X & v > X\\ v & |v| \le X\\ -X & v < -X\end{cases}\qquad i_w = \operatorname{sat}_{\pm I_{max}}(i_{w,raw}),\quad u_r = \operatorname{sat}_{\pm U_{max}}(K_{ri}e_i)$$
<p>Omezení je nelineární: přenos v Laplaceově tvaru pro něj neexistuje. Proto se pohon s mezemi ověřuje simulací.</p>`],
      ['Rozběh s omezeným proudem', String.raw`
<p>Dokud $i_w$ stojí na mezi, je $i \approx I_{max}$ a pohybová rovnice dává konstantní zrychlení:</p>
$$J\frac{\mathrm{d}\omega}{\mathrm{d}t} = k\Phi\,I_{max} - M_z \;\Rightarrow\; \frac{\mathrm{d}\omega}{\mathrm{d}t} = \frac{${fk(p.kPhi, 1)}\cdot${fk(p.Imax, 0)}}{${fk(p.J, 2)}} = ${fk(T.slope, 0)}\,\mathrm{rad/s^2}$$
$$t_{rozb} \approx \frac{J\,\omega^*}{k\Phi\,I_{max}} = ${fk(T.trozb * 1e3, 0)}\,\mathrm{ms}$$
<p>Proto je náběh pomalejší než v kroku 4, ale fyzikálně možný. Větší $J$ nebo menší $I_{max}$ = delší rozběh.</p>`],
      ['Napětí při rozběhu — čtyři fáze z náčrtu', String.raw`
<ol>
<li><b>Skok:</b> $u_r = K_{ri}(I_{max} - i)$ je obrovské, měnič narazí na $U_{max}$. Proud roste rychlostí $(U_{max} - Ri - u_i)/L$.</li>
<li><b>Propad</b> (ve skenu hvězdička u „RI“): proud dosáhl meze, odchylka $e_i$ je malá, P regulátor proudu napětí stáhne.</li>
<li><b>Lineární růst:</b> $u_v \approx R\,i + k\Phi\,\omega$, s rostoucími otáčkami roste $u_i$, napětí jde po přímce nahoru. Proud mírně klesá, protože P regulátor potřebuje odchylku $e_i = u_v/K_{ri}$.</li>
<li><b>Konec:</b> otáčky dosáhly ω*, $i_w$ opustí mez, proud spadne na $M_z/k\Phi$ a napětí se ustálí na $R\,i + k\Phi\,\omega^*$ („≈U1“ ve skenu).</li>
</ol>`],
      ['Anti-windup (podmíněná integrace)', String.raw`
<p>Během rozběhu je $i_w$ na mezi, ale odchylka otáček je velká. Kdyby integrátor dál sčítal, „navinul“ by obrovskou hodnotu a po dosažení ω* by ji musel dlouho odbourávat — vznikl by velký překmit. Podmínka v programu:</p>
$$\text{integruj, jen když } |i_{w,raw}| \le I_{max} \;\text{ nebo }\; i_{w,raw}\cdot e_\omega < 0$$
<p>Vypni anti-windup přepínačem níže a porovnej překmit.</p>`],
      ['Ustálený stav po zátěži', String.raw`
$$i_\infty = \frac{M_z}{k\Phi} = ${fk(T.iEnd, 0)}\,\mathrm{A},\qquad u_{v,\infty} = R\,i_\infty + k\Phi\,\omega^* = ${fk(p.R * T.iEnd, 1)} + ${fk(p.kPhi * p.omega_w, 1)} = ${fk(T.uEnd, 1)}\,\mathrm{V}$$
<p>Pokud by $u_{v,\infty} > U_{max}$, požadované otáčky nejsou dosažitelné a ani integrátor nepomůže: měnič už víc napětí nemá.</p>`]
    ]
  }
};

// ------------------------------------------------------------------ blokové schéma
function schema(k) {
  const Y = 150, N = id => (NEW[k] || []).includes(id) ? ' new' : '';
  const NEW = { 2: ['S1', 'R', 'fbw'], 3: ['R'], 4: ['R', 'S2', 'Ri', 'fbi'], 5: ['sat1', 'sat2'] };
  let s = '';
  const wire = (pts, arrow = true, cls = '') => `<path class="wire${cls}" d="M${pts.map(p => p.join(',')).join(' L')}"${arrow ? ' marker-end="url(#ar)"' : ''}/>`;
  const box = (id, x, w, inner, cap) => `<g class="blk${N(id)}"><rect x="${x}" y="${Y - 28}" width="${w}" height="56" rx="4"/>${inner}${cap ? `<text class="cap" x="${x + w / 2}" y="${Y + 46}">${cap}</text>` : ''}</g>`;
  const one = (x, w, t) => `<text class="tf" x="${x + w / 2}" y="${Y + 6}">${t}</text>`;
  const frac = (x, w, a, b) => `<text class="tf" x="${x + w / 2}" y="${Y - 7}">${a}</text><line class="fr" x1="${x + 10}" x2="${x + w - 10}" y1="${Y}" y2="${Y}"/><text class="tf" x="${x + w / 2}" y="${Y + 19}">${b}</text>`;
  const sum = (id, cx, cy, signs) => `<g class="sum${N(id)}"><circle cx="${cx}" cy="${cy}" r="13"/><path d="M${cx - 9.2},${cy - 9.2} L${cx + 9.2},${cy + 9.2} M${cx - 9.2},${cy + 9.2} L${cx + 9.2},${cy - 9.2}"/>${signs.map(([dx, dy, t]) => `<text class="sg" x="${cx + dx}" y="${cy + dy}">${t}</text>`).join('')}</g>`;
  const sat = (id, x) => `<g class="blk${N(id)}"><rect x="${x}" y="${Y - 28}" width="46" height="56" rx="4"/><path class="satl" d="M${x + 7},${Y + 15} L${x + 16},${Y + 15} L${x + 30},${Y - 15} L${x + 39},${Y - 15}"/><text class="cap" x="${x + 23}" y="${Y + 46}">mez</text></g>`;
  const lab = (x, y, t, g) => `<text class="sig" x="${x}" y="${y}">${t}</text>${g ? `<text class="gen" x="${x}" y="${y + 36}">${g}</text>` : ''}`;
  const dot = (x, y) => `<circle class="dot" cx="${x}" cy="${y}" r="3.2"/>`;
  // rám motoru
  s += `<rect class="frame" x="692" y="22" width="446" height="196" rx="10"/><text class="frl" x="1130" y="38">MOTOR</text>`;
  // vstup
  s += lab(P.zmena ? 40 : 30, Y - 10, P.zmena ? 'ω* → ω₂*' : 'ω*', '(w)');
  if (k === 1) {
    s += wire([[14, Y], [142, Y]]);
    s += box('ff', 142, 120, frac(142, 120, 'kΦ', sub('K', 'm')), 'nastavení naslepo');
    s += wire([[262, Y], [572, Y]]);
  } else {
    s += wire([[14, Y], [82, Y]]);
    s += sum('S1', 95, Y, [[-22, -8, '+'], [-14, 28, '−']]);
    s += wire([[108, Y], [142, Y]]); s += lab(125, Y - 10, sub('e', 'ω'), '(e)');
    const Rl = k === 2 ? sub('K', 'p,u') : k === 3 ? `${sub('K', 'p,u')}(1+<tspan font-size="80%">1/pτ</tspan>${''})` : '';
    if (k === 2) s += box('R', 142, 120, one(142, 120, sub('K', 'p,u')), 'P regulátor otáček');
    else if (k === 3) s += box('R', 142, 120, frac(142, 120, `${sub('K', 'p,u')}(1 + pτ<tspan baseline-shift="sub" font-size="72%">u</tspan>)`, 'pτ<tspan baseline-shift="sub" font-size="72%">u</tspan>'), 'PI regulátor otáček');
    else s += box('R', 142, 120, frac(142, 120, `${sub('K', 'rω')}(1 + pτ<tspan baseline-shift="sub" font-size="72%">rω</tspan>)`, 'pτ<tspan baseline-shift="sub" font-size="72%">rω</tspan>'), 'nadřazený regulátor ω');
    if (k <= 3) { s += wire([[262, Y], [572, Y]]); }
    else {
      if (k === 5) { s += wire([[262, Y], [284, Y]], false); s += sat('sat1', 284); s += wire([[330, Y], [359, Y]]); }
      else s += wire([[262, Y], [359, Y]]);
      s += lab(345, Y - 10, sub('i', 'w'), '');
      s += sum('S2', 372, Y, [[-22, -8, '+'], [-14, 28, '−']]);
      s += wire([[385, Y], [410, Y]]);
      s += box('Ri', 410, 60, one(410, 60, sub('K', 'ri')), 'regulátor proudu');
      if (k === 5) { s += wire([[470, Y], [490, Y]], false); s += sat('sat2', 490); s += wire([[536, Y], [572, Y]]); }
      else s += wire([[470, Y], [572, Y]]);
    }
  }
  s += lab(554, Y - 10, sub('u', 'r'), '(u)');
  // měnič a motor
  const ideal = k === 1 && P.idealni && S.step === 1, brz = k === 1 && S.step === 1 ? P.brzda : 'volno';
  s += ideal ? box('m', 572, 100, one(572, 100, sub('K', 'm')), 'ideální zdroj') : box('m', 572, 100, frac(572, 100, sub('K', 'm'), `1 + pτ<tspan baseline-shift="sub" font-size="72%">m</tspan>`), 'měnič');
  s += wire([[672, Y], [703, Y]]); s += lab(688, Y - 10, sub('u', 'v'), '');
  s += sum('S3', 716, Y, [[-19, 26, '+'], [-12, -18, '−']]);
  s += wire([[729, Y], [752, Y]]);
  s += box('RL', 752, 92, frac(752, 92, '1', 'R + pL'), 'kotva');
  s += wire([[844, Y], [884, Y]]); s += lab(868, Y - 10, 'i', '');
  s += box('k', 884, 50, one(884, 50, 'kΦ'), 'moment');
  s += wire([[934, Y], [959, Y]]); s += lab(946, Y - 10, 'M', '');
  s += sum('S4', 972, Y, [[-19, 26, '+'], [12, 28, '−']]);
  s += wire([[985, Y], [1008, Y]]);
  s += box('J', 1008, 72, frac(1008, 72, '1', 'Jp'), brz === 'drzi' ? 'BRZDA: ω = 0' : brz === 'uvolnit' ? `brzda do ${f(P.t_brzda * 1000, 0)} ms` : 'mechanika');
  s += wire([[1080, Y], [1206, Y]]); s += lab(1186, Y - 10, 'ω', '(y)');
  // indukované napětí
  s += dot(1120, Y) + wire([[1120, Y], [1120, 62], [934, 62]]);
  s += `<g class="blk"><rect x="884" y="44" width="50" height="36" rx="4"/><text class="tf" x="909" y="68">kΦ</text></g>`;
  s += wire([[884, 62], [716, 62], [716, Y - 13]]); s += lab(800, 54, sub('u', 'i'), '');
  s += `<text class="cap" x="880" y="98">vnitřní vazba motoru: indukované napětí (fyzika, ne čidlo)</text>`;
  // zátěž
  s += `<g${P.zatez ? '' : ' opacity=".3"'}>` + wire([[972, 226], [972, Y + 13]]) + `<text class="sig" x="1002" y="222">${sub('M', 'z')}</text><text class="gen" x="1002" y="238">(z)${P.zatez ? '' : ' vypnuto'}</text></g>`;
  // zpětné vazby
  if (k >= 4) { s += `<g class="${N('fbi').trim() ? 'new' : ''}">${dot(858, Y)}${wire([[858, Y], [858, 250], [372, 250], [372, Y + 13]], true, N('fbi'))}<text class="sigs" x="610" y="244">i (čidlo proudu)</text></g>`; }
  if (k >= 2) { s += `<g class="${N('fbw').trim() ? 'new' : ''}">${dot(1160, Y)}${wire([[1160, Y], [1160, 284], [95, 284], [95, Y + 13]], true, N('fbw'))}<text class="sigs" x="610" y="278">ω (čidlo otáček)</text></g>`; }
  return `<svg viewBox="0 0 1220 300" role="img" aria-label="Blokové schéma kroku ${k}">
<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--ink2)"/></marker></defs>
<style>
.wire{fill:none;stroke:var(--ink2);stroke-width:1.6}.wire.new{stroke:var(--new);stroke-width:2.2}
.blk rect{fill:var(--card);stroke:var(--ink);stroke-width:1.5}.blk.new rect{fill:var(--newbg);stroke:var(--new);stroke-width:2.4}
.sum circle{fill:var(--card);stroke:var(--ink);stroke-width:1.5}.sum path{stroke:var(--ink);stroke-width:1}.sum.new circle{fill:var(--newbg);stroke:var(--new);stroke-width:2.4}
.tf{font:italic 15px "Times New Roman",serif;fill:var(--ink);text-anchor:middle}.fr{stroke:var(--ink);stroke-width:1}
.cap{font:11px system-ui,sans-serif;fill:var(--muted);text-anchor:middle}
.sig{font:italic 15px "Times New Roman",serif;fill:var(--ink);text-anchor:middle}.sigs{font:12px system-ui,sans-serif;fill:var(--ink2);text-anchor:middle}
.gen{font:12px system-ui,sans-serif;fill:var(--muted);text-anchor:middle}
.sg{font:bold 14px system-ui,sans-serif;fill:var(--ink);text-anchor:middle}
.satl{fill:none;stroke:var(--ink);stroke-width:1.6}.dot{fill:var(--ink2)}
.frame{fill:none;stroke:var(--muted);stroke-dasharray:5 4}.frl{font:bold 11px system-ui,sans-serif;letter-spacing:.12em;fill:var(--muted);text-anchor:end}
</style>${s}</svg>`;
}

// ------------------------------------------------------------------ obvod kotvy (ČSN EN 60617)
function obvod(k) {
  const tg = k >= 2, ci = k >= 4, nw = (c, kk) => c ? (kk ? ' class="new"' : '') : ' style="display:none"';
  return `<svg viewBox="0 0 560 210" role="img" aria-label="Elektrické schéma kotvy">
<defs><marker id="av" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--accent)"/></marker>
<marker id="ai" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--i)"/></marker></defs>
<style>.c{fill:none;stroke:var(--ink);stroke-width:1.8}.cf{fill:var(--card);stroke:var(--ink);stroke-width:1.8}.t{font:italic 15px "Times New Roman",serif;fill:var(--ink);text-anchor:middle}
.ts{font:11px system-ui,sans-serif;fill:var(--muted);text-anchor:middle}.va{stroke:var(--accent);stroke-width:1.5;fill:none}.vt{font:italic 14px "Times New Roman",serif;fill:var(--accent)}
.new .cf,.new .c{stroke:var(--new)}.new .ts{fill:var(--new)}</style>
<path class="c" d="M0,82 H22 M0,138 H22"/>
<rect class="cf" x="22" y="50" width="88" height="120"/><path class="c" d="M22,170 L110,50"/>
<path class="c" d="M34,72 h18 M34,78 h18 M80,146 h18 M80,152 h18"/>
<text class="ts" x="66" y="188">měnič DC/DC</text>
<path class="c" d="M110,70 H${ci ? 168 : 215} M${ci ? 192 : 215},70 H215 M259,70 H285 M345,70 H420 V73 M420,137 V140 H110"/>
<g${nw(ci, k === 4)}><circle class="cf" cx="180" cy="70" r="12"/><text class="t" x="180" y="75" style="font-style:normal;font-size:13px">A</text><text class="ts" x="180" y="46">čidlo proudu</text></g>
<rect class="cf" x="215" y="62" width="44" height="16"/><text class="t" x="237" y="100">R</text>
<path class="c" d="M285,70 a7.5,7.5 0 0 1 15,0 a7.5,7.5 0 0 1 15,0 a7.5,7.5 0 0 1 15,0 a7.5,7.5 0 0 1 15,0"/><text class="t" x="315" y="100">L</text>
<circle class="cf" cx="420" cy="105" r="32"/><text class="t" x="420" y="108" style="font-style:normal;font-size:20px">M</text>
<path class="c" d="M408,118 h24 M408,124 h5 M417,124 h6 M427,124 h5" style="stroke-width:1.4"/>
<path class="c" d="M452,105 H556" style="stroke-width:3"/>
<rect class="cf" x="478" y="78" width="12" height="54"/><text class="t" x="484" y="150">J</text>
<g${nw(tg, k === 2)}><circle class="cf" cx="540" cy="105" r="13"/><text class="t" x="540" y="109" style="font-style:normal;font-size:11px">TG</text><text class="ts" x="534" y="80">čidlo ω</text></g>
<path class="va" d="M136,80 V132" marker-end="url(#av)"/><text class="vt" x="142" y="112">u</text><text class="vt" x="150" y="116" style="font-size:10px">v</text>
<path class="va" d="M217,54 H257" marker-end="url(#av)"/><text class="vt" x="231" y="48">u</text><text class="vt" x="239" y="52" style="font-size:10px">R</text>
<path class="va" d="M287,54 H343" marker-end="url(#av)"/><text class="vt" x="309" y="48">u</text><text class="vt" x="317" y="52" style="font-size:10px">L</text>
<path class="va" d="M376,80 V130" marker-end="url(#av)"/><text class="vt" x="356" y="110">u</text><text class="vt" x="364" y="114" style="font-size:10px">i</text>
<path d="M${ci ? 150 : 165},70 h1" style="stroke:var(--i)" marker-end="url(#ai)"/><text class="vt" x="${ci ? 150 : 165}" y="62" style="fill:var(--i)">i</text>
<path class="va" d="M462,92 a18,18 0 0 1 0,26" style="stroke:var(--ink2)" marker-end="url(#av)"/><text class="t" x="470" y="86" style="font-size:13px">ω</text>
<path class="va" d="M509,122 a18,18 0 0 0 0,-34" style="stroke:var(--i)"/><text class="t" x="512" y="146" style="font-size:13px">M<tspan baseline-shift="sub" font-size="70%">z</tspan></text>
</svg>`;
}

// ------------------------------------------------------------------ obrázek motoru
function motorSvg() {
  return `<svg viewBox="0 0 220 160" role="img" aria-label="Motor, značka na hřídeli ukazuje pootočení">
<rect x="34" y="128" width="20" height="10" rx="2" style="fill:var(--body2)"/><rect x="118" y="128" width="20" height="10" rx="2" style="fill:var(--body2)"/>
<rect x="20" y="138" width="134" height="6" rx="3" style="fill:var(--body2)"/>
<rect x="66" y="16" width="34" height="16" rx="3" style="fill:var(--body2)"/><path d="M100,24 C118,24 120,6 140,6" style="fill:none;stroke:var(--ink2);stroke-width:3"/>
<rect x="18" y="28" width="122" height="102" rx="16" style="fill:var(--body)"/>
<g id="mWind" opacity=".2">${[44, 56, 68, 80, 92, 104, 116].map(y => `<path d="M30,${y} H118" style="stroke:var(--copper);stroke-width:5;stroke-linecap:round"/>`).join('')}</g>
<g style="stroke:rgba(255,255,255,.25);stroke-width:3">${[44, 56, 68, 80, 92, 104, 116].map(y => `<path d="M30,${y} H118"/>`).join('')}</g>
<circle cx="150" cy="79" r="46" style="fill:var(--metal);stroke:var(--body2);stroke-width:4"/>
<circle cx="150" cy="79" r="31" style="fill:var(--body2)"/>
<g id="mRot"><circle cx="150" cy="79" r="19" style="fill:var(--card)"/><path d="M150,79 L166,79" style="stroke:var(--i);stroke-width:6;stroke-linecap:round"/><circle cx="150" cy="79" r="4" style="fill:var(--ink2)"/></g>
<g id="mBrake" opacity="0"><path d="M188,52 A46,46 0 0 1 196,79 L204,79 A54,54 0 0 0 194,47 Z" style="fill:var(--i)"/><rect x="196" y="60" width="18" height="12" rx="2" style="fill:var(--i)"/><text x="205" y="100" style="font:bold 10px system-ui;fill:var(--i);text-anchor:middle">BRZDA</text></g>
<g id="mLoad" opacity="0"><path d="M150,98 V138" style="stroke:var(--ink2);stroke-width:2"/><rect x="136" y="138" width="28" height="18" rx="3" style="fill:var(--ink2)"/><text x="150" y="151" style="font:bold 10px system-ui;fill:var(--card);text-anchor:middle">Mz</text></g>
</svg>`;
}

// ------------------------------------------------------------------ grafy
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const st = [1, 2, 2.5, 5, 10].map(k => k * mag).find(s => span / s <= n) || 10 * mag;
  const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(Math.abs(v) < st * 1e-6 ? 0 : v);
  return out;
}
function drawChart(cv, cfg) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const L = 56, R = 12, T = 8, B = 22, pw = W - L - R, ph = H - T - B;
  const x0 = cfg.x0 != null ? cfg.x0 : 0, x1 = cfg.x1 != null ? cfg.x1 : cfg.T;
  const sym = cfg.symlog, c = 300, tr = v => sym ? Math.sign(v) * Math.log10(1 + Math.abs(v) / c) : v;
  const vis = s => [Math.max(0, idx(s.t, x0) - 1), Math.min(s.t.length - 1, idx(s.t, x1) + 1)];
  let lo = Infinity, hi = -Infinity;
  for (const s of cfg.series) if (s.range !== false) { const [a, b] = vis(s); for (let j = a; j <= b; j++) { const v = s.y[j]; if (isFinite(v)) { const q = tr(v); if (q < lo) lo = q; if (q > hi) hi = q; } } }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  lo = Math.min(lo, 0); const pad = (hi - lo || 1) * 0.08; lo -= lo < 0 ? pad : 0; hi += pad;
  const X = t => L + (t - x0) / (x1 - x0) * pw, Yp = v => T + (1 - (tr(v) - lo) / (hi - lo)) * ph;
  g.font = '11px system-ui,sans-serif'; g.fillStyle = css('--ink2'); g.strokeStyle = css('--grid'); g.lineWidth = 1;
  let ticks;
  if (sym) { ticks = [0]; for (const m of [1000, 10000, 100000]) { if (tr(m) <= hi) ticks.push(m); if (tr(-m) >= lo) ticks.push(-m); } }
  else ticks = niceTicks(lo, hi);
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (const v of ticks) { const y = Yp(v); g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); g.fillText(f(v, Math.abs(v) < 10 && v % 1 ? 1 : 0), L - 6, y); }
  const xt = niceTicks(x0 * 1000, x1 * 1000, 8), st = xt.length > 1 ? xt[1] - xt[0] : 1, dec = st < 0.1 ? 2 : st < 1 ? 1 : 0;
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (const t of xt) { const x = X(t / 1000); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.fillText(f(t, dec), x, T + ph + 5); }
  // osa nuly: přechod do záporných hodnot
  if (lo < 0 && hi > 0) { g.strokeStyle = css('--ink2'); g.lineWidth = 1.4; g.beginPath(); g.moveTo(L, Yp(0)); g.lineTo(L + pw, Yp(0)); g.stroke(); g.lineWidth = 1; if (!sym) { g.fillStyle = css('--grid'); g.globalAlpha = 0.35; g.fillRect(L, Yp(0), pw, T + ph - Yp(0)); g.globalAlpha = 1; } }
  g.fillStyle = css('--ink2');
  g.save(); g.translate(12, T + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cfg.ylabel, 0, 0); g.restore();
  g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = css('--muted'); g.fillText('t [ms]', 2, T + ph + 5);
  for (const mk of cfg.marks || []) { if (mk[0] < x0 || mk[0] > x1) continue; g.strokeStyle = css('--muted'); g.setLineDash([2, 3]); const x = X(mk[0]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.setLineDash([]); if (cfg.labels) { g.fillStyle = css('--muted'); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(mk[1], x + 3, T + 1); } }
  if (cfg.sel) { const a = X(Math.min(...cfg.sel)), b = X(Math.max(...cfg.sel)); g.fillStyle = css('--accent'); g.globalAlpha = 0.15; g.fillRect(a, T, b - a, ph); g.globalAlpha = 1; }
  g.save(); g.beginPath(); g.rect(L, T, pw, ph); g.clip();
  for (const s of cfg.series) {
    g.strokeStyle = css(s.c); g.lineWidth = s.w || 2; g.setLineDash(s.dash || []); g.beginPath();
    const [a, b] = vis(s), dense = b - a + 1 > pw * 2;
    let pen = false, cb = null, mn = 0, mx = 0;
    const Y = v => Yp(Math.max(-1e9, Math.min(1e9, v)));
    for (let j = a; j <= b; j++) {
      const v = s.y[j]; if (!isFinite(v)) { pen = false; cb = null; continue; }
      const x = X(s.t[j]);
      if (!dense) { if (pen) g.lineTo(x, Y(v)); else { g.moveTo(x, Y(v)); pen = true; } continue; }
      const px = Math.round(x); // min/max v každém sloupci pixelů: špičky se při oddálení neztratí
      if (px !== cb) { if (cb !== null) { g.lineTo(cb, Y(mn)); g.lineTo(cb, Y(mx)); } if (pen) g.lineTo(px, Y(v)); else { g.moveTo(px, Y(v)); pen = true; } cb = px; mn = mx = v; }
      else { if (v < mn) mn = v; if (v > mx) mx = v; }
    }
    if (cb !== null) { g.lineTo(cb, Y(mn)); g.lineTo(cb, Y(mx)); }
    g.stroke();
  }
  g.setLineDash([]);
  for (const ev of cfg.events || []) { if (ev.t < x0 || ev.t > x1) continue; const x = X(ev.t); g.fillStyle = css(ev.hit ? '--new' : '--muted'); g.beginPath(); g.moveTo(x - 5, T); g.lineTo(x + 5, T); g.lineTo(x, T + 8); g.closePath(); g.fill(); }
  if (cfg.cursor != null && cfg.cursor >= x0 && cfg.cursor <= x1) {
    const x = X(cfg.cursor); g.strokeStyle = css('--ink2'); g.lineWidth = 1; g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke();
    for (const s of cfg.series) if (s.marker) { const j = idx(s.t, cfg.cursor), v = s.y[j]; if (isFinite(v)) { g.fillStyle = css(s.c); g.strokeStyle = css('--card'); g.lineWidth = 2; g.beginPath(); g.arc(x, Yp(v), 4.5, 0, 7); g.fill(); g.stroke(); } }
  }
  g.restore();
  cv._map = { L, pw, x0, x1 };
}
function znacky(p) { const m = []; if (p.zatez && p.Mz > 0) m.push([p.t_Mz, 'Mz']); if (p.zmena) m.push([p.t_w2, 'ω₂*']); return m; }
function idx(t, x) { let lo = 0, hi = t.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] < x) lo = m; else hi = m; } return Math.abs(t[hi] - x) < Math.abs(t[lo] - x) ? hi : lo; }

// ------------------------------------------------------------------ vykreslení kroku
function sim(k, extra, nBodu = 20000) {
  const jenKrok1 = (k === 1 && S.step === 1) ? {} : { brzda: 'volno', idealni: false };
  return M.simuluj(Object.assign({}, P, jenKrok1, extra || {}), k, nBodu);
}
// referenční pokus s brzdou z poznámky (nezávisí na posuvnících)
const REF = { omega_w: 60, t_w: 0.05, Mz: 5, t_Mz: 0.8, T: 2, idealni: true, vstup: 'skok', J: 0.05 };
const REF_POZN = [['drží po celý pokus', 'drzi', 0, '→ 750 A', 'hřídel stojí'], ['volno od začátku', 'volno', 0, '0 A', '91,6 rad/s v 0,114 s'],
  ['uvolnit v 0,15 s', 'uvolnit', 0.15, '648,5 A', '150,5 rad/s v 0,188 s'], ['uvolnit v 0,40 s', 'uvolnit', 0.40, '749,3 A', '164,4 rad/s v 0,436 s']];
let REF_VYSL = null;
function refBrzda() {
  if (!REF_VYSL) REF_VYSL = REF_POZN.map(([, b, tb]) => M.simuluj(Object.assign({}, M.BASE, REF, { brzda: b, t_brzda: tb }), 1, 400).m);
  return REF_VYSL;
}

function srcTxt(key) {
  const c = CTL[key]; let t = P.profil === 'auto' ? 'auto: odhad' : c.src;
  if (key === 'omega_w' || key === 'omega_w2') t += ` · ${f(P[key] * 60 / (2 * Math.PI), 0)} ot/min` + (P.profil === 'auto' ? ` · auto ≈ ${f(kmh(P[key]), 0)} km/h` : '');
  return t;
}
function ctlHtml(keys) {
  const ps = PRESETS[S.step] || [];
  let h = `<div class="presets"><span class="note">Předvolby:</span>${ps.map(([n], j) => `<button class="btn${S.preset === S.step + ':' + j ? ' act' : ''}" data-ps="${j}">${n}</button>`).join('')}</div>`;
  const pi = S.preset && S.preset.startsWith(S.step + ':') ? ps[+S.preset.split(':')[1]] : null;
  if (pi) h += `<p class="note" style="margin:-4px 0 10px">${pi[2]} Posuvníky dál fungují volně.</p>`;
  h += `<div class="controls">`;
  h += `<div class="ctl"><label>Vstup ω*</label><div class="seg" id="vstup"><button data-v="skok" aria-pressed="${P.vstup === 'skok'}">skok</button><button data-v="rampa" aria-pressed="${P.vstup === 'rampa'}">rampa 150 ms</button></div></div>`;
  for (const key of keys) {
    const c = CTL[key];
    const [mn, mx] = rng(key);
    h += `<div class="ctl"><label for="c_${key}"><span>${c.l}</span><output id="o_${key}">${f(P[key], c.d)} ${c.u}</output></label><input type="range" id="c_${key}" data-k="${key}" min="${mn}" max="${mx}" step="${c.st}" value="${P[key]}"><span class="src">${srcTxt(key)}</span></div>`;
  }
  h += `</div>`;
  const sl = (key, on) => { const c = CTL[key], mx = key.startsWith('t_') ? +(P.T - 0.05).toFixed(2) : rng(key)[1]; return `<div class="ctl" style="${on ? '' : 'opacity:.4'}"><label for="c_${key}"><span>${c.l}</span><output id="o_${key}">${f(P[key], c.d)} ${c.u}</output></label><input type="range" id="c_${key}" data-k="${key}" min="${c.min}" max="${mx}" step="${c.st}" value="${P[key]}" ${on ? '' : 'disabled'}><span class="src">${srcTxt(key)}</span></div>`; };
  h += `<div class="pz"><div class="pzc"><label class="pzh"><input type="checkbox" id="zatez" ${P.zatez ? 'checked' : ''}> <b>Porucha z:</b> skok zátěžného momentu M<sub>z</sub></label>
<p class="note" style="margin:2px 0 6px">Vnější vliv, který regulátor nezná (bedna na pásu). Vstupuje až do mechaniky; regulátor ho pozná jen z poklesu otáček a musí ho <i>potlačit</i>.</p><div class="controls">${sl('Mz', P.zatez)}${sl('t_Mz', P.zatez)}</div></div>
<div class="pzc"><label class="pzh"><input type="checkbox" id="zmena" ${P.zmena ? 'checked' : ''}> <b>Změna požadavku w:</b> nové otáčky za běhu</label>
<p class="note" style="margin:2px 0 6px">Povel, který má výstup <i>sledovat</i> (jiná rychlost pásu). Vstupuje do prvního součtového uzlu. Zpomalení ukáže, jak pohon brzdí.</p><div class="controls">${sl('omega_w2', P.zmena)}${sl('t_w2', P.zmena)}</div></div></div>`;
  if (S.step === 1) {
    h += `<div class="controls" style="margin-top:10px"><div class="ctl"><label>Brzda hřídele</label><div class="seg" id="brzda">${[['volno', 'volno'], ['drzi', 'drží'], ['uvolnit', 'uvolnit v čase']].map(([v, t]) => `<button data-b="${v}" aria-pressed="${P.brzda === v}">${t}</button>`).join('')}</div></div>
<div class="ctl" style="${P.brzda === 'uvolnit' ? '' : 'opacity:.4'}"><label for="c_tb"><span>Uvolnit brzdu v čase</span><output id="o_tb">${f(P.t_brzda * 1000, 0)} ms</output></label><input type="range" id="c_tb" min="0.02" max="${Math.max(0.1, P.T - 0.05).toFixed(2)}" step="0.01" value="${P.t_brzda}" ${P.brzda === 'uvolnit' ? '' : 'disabled'}><span class="src">proud i otáčky se při uvolnění zachovají</span></div>
<div class="ctl"><label><span><input type="checkbox" id="ideal" ${P.idealni ? 'checked' : ''}> ideální zdroj napětí (bez měniče)</span></label><button class="btn" id="refbtn" style="margin-top:4px">Referenční pokus z poznámky (30 V)</button></div></div>`;
  }
  h += `<div class="row">`;
  if (S.step >= 5) h += `<label><input type="checkbox" id="aw" ${P.aw ? 'checked' : ''}> anti-windup (podmíněná integrace)</label>`;
  if (S.step >= 4) h += `<label title="Přičte k povelu proudového regulátoru vypočtené indukované napětí kΦ·ω"><input type="checkbox" id="ff" ${P.ff ? 'checked' : ''}> dopředná vazba u<sub>i</sub> = kΦ·ω</label>`;
  if (S.step >= 2 && S.step <= 5) h += `<label><input type="checkbox" id="ovl" ${S.overlay ? 'checked' : ''}> překrýt předchozí krok (čárkovaně)</label>`;
  if (S.step === 1 && P.brzda === 'uvolnit') h += `<label><input type="checkbox" id="ovl" ${S.overlay ? 'checked' : ''}> porovnat s trvale zabrzděným motorem (čárkovaně)</label>`;
  h += `<button class="btn" id="reset">Výchozí hodnoty</button></div>`;
  return h;
}


function chartsHtml(id) {
  const sp = [1, 10, 20, 100, 1000], dl = [0.8, 1.2, 2, 5];
  return `<div class="card charts" id="${id}">
<div class="row" style="margin:0 0 6px"><button class="btn primary" id="play">▶ Přehrát</button>
<span class="seg" id="slow" title="Zpomalení přehrávání">${sp.map(k => `<button data-s="${k}" aria-pressed="${S.slow === k}">${k}×</button>`).join('')}</span>
<label style="flex:1;min-width:160px;display:flex;gap:8px;align-items:center">čas <input type="range" id="tcur" min="0" max="${P.T}" step="0.0001" value="${S.cursor}" style="flex:1"></label></div>
<div class="row" style="margin:0 0 6px">Záznam <span class="seg" id="delka">${dl.map(k => `<button data-d="${k}" aria-pressed="${Math.abs(P.T - k) < 1e-9}">${f(k, k % 1 ? 1 : 0)} s</button>`).join('')}</span>
Lupa <button class="btn" id="zin" title="Přiblížit kolem kurzoru">＋</button><button class="btn" id="zout" title="Oddálit">－</button><button class="btn" id="zall">celý průběh</button><span class="note" id="zinfo"></span></div>
<div class="evrow"><span class="note">Zajímavé okamžiky:</span> <span id="ev"></span></div>
<div class="chleg" id="lg_w"></div><div class="ch"><canvas id="cv_w"></canvas><div class="tip" id="tp_w"></div></div>
<div class="chleg" id="lg_i"></div><div class="ch"><canvas id="cv_i"></canvas><div class="tip" id="tp_i"></div></div>
<div class="chleg" id="lg_u"></div><div class="ch"><canvas id="cv_u"></canvas><div class="tip" id="tp_u"></div></div>
<p class="note" style="margin:6px 0 0">Najeď myší na graf: svislá čára ukáže hodnoty ve všech třech grafech a motor nahoře se natočí do stejného okamžiku. <b>Táhni myší</b> přes graf = přiblížit vybraný úsek, <b>dvojklik</b> = celý průběh. Silná vodorovná čára je nula (pod ní šedě záporné hodnoty). Tečkované svislé čáry: skok zátěže M<sub>z</sub> a změna otáček ω₂*.</p></div>`;
}
function view() { const T = P.T; return S.view ? [Math.max(0, S.view[0]), Math.min(T, S.view[1])] : [0, T]; }
function setView(a, b) {
  const T = P.T; let w = Math.max(0.0005, b - a);
  if (w >= T * 0.999) { S.view = null; } else { a = Math.max(0, Math.min(T - w, a)); S.view = [a, a + w]; }
  const [x0, x1] = view(); if ($('zinfo')) $('zinfo').textContent = S.view ? `výřez ${f(x0 * 1000, 1)}–${f(x1 * 1000, 1)} ms` : '';
}
function play() {
  if (S.playing) { S.playing = false; return; }
  const [x0, x1] = view();
  S.playing = true; $('play').textContent = '❚❚ Zastavit';
  let t0 = null; const start = (S.cursor >= x1 - (x1 - x0) * 0.01 || S.cursor < x0) ? x0 : S.cursor;
  const frame = ts => {
    if (!S.playing || !$('play')) { S.playing = false; if ($('play')) $('play').textContent = '▶ Přehrát'; return; }
    if (t0 === null) t0 = ts;
    S.cursor = Math.min(x1, start + (ts - t0) / 1000 / S.slow);
    if ($('tcur')) $('tcur').value = S.cursor;
    S.step === 6 ? drawSummaryCharts() : drawAll();
    if (S.cursor >= x1) { S.playing = false; $('play').textContent = '▶ Přehrát'; return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function tAt(cv, ev) { const m = cv._map, rect = cv.getBoundingClientRect(), x = ev.clientX - rect.left; return { x, t: Math.max(m.x0, Math.min(m.x1, m.x0 + (x - m.L) / m.pw * (m.x1 - m.x0))), rect }; }
function tooltips(ev, which) {
  const cv = ev.currentTarget; if (!cv._map) return;
  const { x, t, rect } = tAt(cv, ev);
  if (S.drag) { S.sel = [S.drag.t, t]; drawAll(); return; }
  S.cursor = t; if ($('tcur')) $('tcur').value = t;
  drawAll();
  const r = S.cur, j = idx(r.t, t);
  const vals = { w: `ω = ${f(r.w[j], 1)} rad/s · ω* = ${f(r.ww[j], 0)}`, i: `i = ${f(r.i[j], 1)} A${S.step >= 4 && S.step <= 5 ? ` · i_w = ${f(r.iw[j], 1)}` : ''}`, u: `u_v = ${f(r.uv[j], 1)} V · u_i = ${f(r.w[j] * r.p.kPhi, 1)}` };
  for (const k of ['w', 'i', 'u']) { const tp = $('tp_' + k); if (tp) tp.style.display = k === which ? 'block' : 'none'; }
  const tp = $('tp_' + which); if (tp) { tp.textContent = `${f(t * 1000, 2)} ms · ${vals[which]}`; tp.style.left = Math.min(x + 10, rect.width - tp.offsetWidth - 4) + 'px'; tp.style.top = '6px'; }
}
function udalosti(r) {
  const p = r.p, t = r.t, n = t.length, E = [];
  const at = (tt, lab) => { if (tt >= 0 && tt <= p.T) E.push({ t: tt, l: lab }); };
  const amax = (arr, a = 0, b = n - 1, fn = v => v) => { let k = a; for (let j = a; j <= b; j++) if (fn(arr[j]) > fn(arr[k])) k = j; return k; };
  const iMz = p.zatez && p.Mz > 0 ? idx(t, p.t_Mz) : n - 1, iW = idx(t, p.t_w);
  if (p.vstup === 'skok') at(p.t_w, 'povel ω*'); else { at(p.t_w, 'začátek rampy'); at(p.t_w + p.t_rampa, 'konec rampy'); }
  if (r.krok === 1 && p.brzda === 'uvolnit') at(p.t_brzda, 'uvolnění brzdy');
  const ki = amax(r.i, 0, n - 1, Math.abs); if (r.i[ki] > 0) at(t[ki], `špička proudu ${f(r.i[ki], 0)} A`);
  if (!(r.krok === 1 && p.brzda === 'drzi')) { const kw = amax(r.w, iW, iMz); at(t[kw], `vrchol otáček ${f(r.w[kw], 1)} rad/s`); }
  const kn = amax(r.i, 0, n - 1, v => -v); if (r.i[kn] < -5) at(t[kn], `proud nejvíc záporný ${f(r.i[kn], 0)} A (brzdí)`);
  for (let j = iW; j < iMz; j++) if (r.w[j] >= 0.9 * r.ww[j] && r.ww[j] > 0) { at(t[j], 'otáčky na 90 %'); break; }
  if (r.krok === 5) {
    let on = false; for (let j = 0; j < n; j++) { const lim = Math.abs(r.iw[j]) >= p.Imax - 1e-9; if (lim && !on) on = true; if (!lim && on) { at(t[j], 'konec omezení proudu'); break; } }
    for (let j = 0; j < n; j++) if (Math.abs(r.ur[j]) >= p.Umax - 1e-9) { at(t[j], 'napětí na mezi U_max'); break; }
  }
  let ks = -1; for (let j = iW; j < iMz; j++) if (r.ww[j] > 0 && Math.abs(r.w[j] - r.ww[j]) > 0.05 * Math.abs(r.ww[j])) ks = j;
  if (ks > 0 && ks < iMz - 2) at(t[ks + 1], 'ustálení ±5 %');
  if (p.zatez && p.Mz > 0) { at(p.t_Mz, 'přiložení zátěže'); const iE = p.zmena && p.t_w2 > p.t_Mz ? idx(t, p.t_w2) : n - 1; const km = amax(r.w, iMz, iE, v => -v); if (r.w[iMz] - r.w[km] > 0.002 * Math.abs(p.omega_w)) at(t[km], `největší propad ${f(r.w[km], 1)} rad/s`); }
  if (p.zmena) at(p.t_w2, 'změna na ω₂*');
  return E.sort((a, b) => a.t - b.t);
}
function drawEvents() {
  if (!$('ev') || !S.ev) return;
  let hit = -1; S.ev.forEach((e, j) => { if (e.t <= S.cursor + 1e-9) hit = j; });
  S.ev.forEach((e, j) => e.hit = j === hit);
  $('ev').querySelectorAll('button').forEach((b, j) => b.classList.toggle('hit', j === hit));
}
function renderEvents() {
  if (!$('ev')) return;
  $('ev').innerHTML = S.ev.map((e, j) => `<button class="btn evb" data-j="${j}">${e.l} <span class="note">${f(e.t * 1000, 1)} ms</span></button>`).join('');
  $('ev').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const e = S.ev[+b.dataset.j]; S.cursor = e.t; S.playing = false;
    const [x0, x1] = view(); if (e.t < x0 || e.t > x1) setView(e.t - (x1 - x0) / 2, e.t + (x1 - x0) / 2);
    if ($('tcur')) $('tcur').value = e.t; drawAll();
  }));
}

function render() {
  const k = S.step, sec = $('step');
  document.querySelectorAll('#steps button').forEach(b => b.setAttribute('aria-current', +b.dataset.k === k ? 'step' : 'false'));
  $('prev').disabled = k === 1; $('next').disabled = k === 6;
  if (k === 6) { renderSummary(sec); return; }
  const st = STEPS[k];
  sec.innerHTML = `<h2>${st.title}</h2><p class="sub">${st.sub}</p>${P.profil === 'auto' ? `<p class="motto" style="max-width:none">🚗 <b>Profil auto</b> (odhad): stejnosměrný ekvivalent jednoho motoru výkonného elektromobilu, 400 V / 800 A, třetina auta na hřídeli. Texty s konkrétními čísly ZAE14 platí pro výchozí motor. <button class="btn" id="zae14">zpět na motor ZAE14</button></p>` : ''}
<div class="card schema"><h3>Blokové schéma${k > 1 ? ' <span class="tag">NOVÉ</span> oranžově' : ''}</h3><div class="scroll" id="sch">${schema(k)}</div>
<p class="legend-sch">Obecné značky regulačního obvodu: <i>w</i> požadovaná hodnota, <i>e</i> regulační odchylka, <i>u</i> akční veličina, <i>y</i> regulovaná veličina, <i>z</i> porucha. Bloky nesou přenos v Laplaceově tvaru (proměnná <i>p</i>). Součtový uzel: znaménko u vstupu.</p></div>
<div class="duo"><div class="card circuit"><h3>Elektrické schéma kotvy (značky ČSN EN 60617)</h3><div class="scroll">${obvod(k)}</div><p class="note" style="margin:4px 0 0">Šipky napětí od + k −. Měnič je průměrovaný (bez spínání), motor M s cizím buzením, kΦ = konst.</p></div>
<div class="card"><h3>Motor v okamžiku kurzoru</h3><div class="motorbox">${motorSvg()}<dl class="readout" id="ro"></dl></div></div></div>
<div class="three"><div class="card new"><div class="k">Co přidáváme</div><p id="tx_add"></p></div><div class="card"><div class="k">Proč</div><p id="tx_why"></p></div><div class="card"><div class="k">Co uvidíš v grafech</div><p id="tx_see"></p></div></div>
<div class="card"><h3>Parametry pokusu</h3>${ctlHtml(STEP_CTL[k])}</div>
${chartsHtml('charts')}
<div class="row" style="margin-top:18px"><h3 style="margin:0">Vztahy a odvození (rozklikni)</h3><button class="btn" id="openall">Rozbalit vše</button></div><div id="notes"></div>`;
  bindControls(); recompute();
}

function recompute() {
  const k = S.step;
  if (k === 6) { recomputeSummary(); return; }
  const r = sim(k), T = teorie(r.p);
  const prev = !S.overlay ? null : k >= 2 ? sim(k - 1) : (P.brzda === 'uvolnit' ? sim(1, { brzda: 'drzi' }) : null);
  if (k === 1) { S.volny = P.brzda !== 'volno' ? sim(1, { brzda: 'volno' }) : r; if ($('sch')) $('sch').innerHTML = schema(1); }
  S.cur = r; S.prev = prev; S.ev = udalosti(r); renderEvents(); setView(...view());
  const st = STEPS[k], m = Object.assign({ nestabilni: r.nestabilni }, r.m);
  $('tx_add').innerHTML = st.add(m, r.p, T); $('tx_why').innerHTML = st.why(m, r.p, T); $('tx_see').innerHTML = st.see(m, r.p, T);
  const pr = M.pruchody(r.p);
  const open = [...document.querySelectorAll('#notes details')].map(d => d.open), all = /open/.test(location.hash);
  $('notes').innerHTML = [...(r.p.profil === 'auto' ? [autoNote(r)] : []), ...st.notes(r.p, T, pr), poruchaNote(k, r.p, T)].map(([h, b], j) => `<details${open[j] || all ? ' open' : ''}><summary>${h}</summary><div class="body">${b}</div></details>`).join('');
  math($('step'));
  drawAll();
}

function legend(el, items) { $(el).innerHTML = items.map(([t, c, cls]) => `<span class="${cls || ''}" style="--c:var(${c})">${t}</span>`).join(''); }

function drawAll() {
  const r = S.cur, pv = S.prev, k = S.step, T = r.p.T, marks = znacky(r.p);
  const ser = (t, y, c, o = {}) => Object.assign({ t, y, c }, o);
  const W = [ser(r.t, r.ww, '--ref', { dash: [6, 4], w: 1.5 })], I = [], U = [];
  if (pv) { W.push(ser(pv.t, pv.w, '--prev', { dash: [3, 3], w: 1.6, range: false })); I.push(ser(pv.t, pv.i, '--prev', { dash: [3, 3], w: 1.6, range: false })); U.push(ser(pv.t, pv.uv, '--prev', { dash: [3, 3], w: 1.6, range: false })); }
  W.push(ser(r.t, r.w, '--w', { marker: true }));
  if (k >= 4) I.push(ser(r.t, r.iw, '--ref', { dash: [6, 4], w: 1.5, range: false }));
  I.push(ser(r.t, r.i, '--i', { marker: true }));
  U.push(ser(r.t, r.ur, '--ref', { dash: [6, 4], w: 1.5, range: false }));
  U.push(ser(r.t, r.w.map(v => v * r.p.kPhi), '--u', { dash: [1.5, 3], w: 2 }));
  U.push(ser(r.t, r.uv, '--u', { marker: true }));
  const pl = pv ? [[k === 1 ? 'trvale zabrzděný motor' : `předchozí krok ${k - 1}`, '--prev', 'dash']] : [];
  legend('lg_w', [['ω skutečné [rad/s]', '--w'], ['ω* požadované', '--ref', 'dash'], ...pl]);
  legend('lg_i', [['i proud kotvy [A]', '--i'], ...(k >= 4 ? [['i_w požadovaný proud', '--ref', 'dash']] : []), ...pl]);
  legend('lg_u', [['u_v napětí měniče [V]', '--u'], ['u_r povel měniči', '--ref', 'dash'], ['u_i = kΦ·ω indukované', '--u', 'dot'], ...pl]);
  const [x0, x1] = view(); drawEvents();
  drawChart($('cv_w'), { series: W, T, x0, x1, sel: S.sel, events: S.ev, ylabel: 'ω [rad/s]', cursor: S.cursor, marks, labels: true });
  drawChart($('cv_i'), { series: I, T, x0, x1, sel: S.sel, ylabel: 'i [A]', cursor: S.cursor, marks, labels: false });
  drawChart($('cv_u'), { series: U, T, x0, x1, sel: S.sel, ylabel: 'u [V]', cursor: S.cursor, marks, labels: false });
  updateMotor();
}

function updateMotor() {
  const r = S.cur; if (!r || !$('ro')) return;
  const j = idx(r.t, S.cursor), w = r.w[j], i = r.i[j], u = r.uv[j], p = r.p, mzNow = p.zatez && r.t[j] >= p.t_Mz ? p.Mz : 0;
  $('ro').innerHTML = `<dt>čas t</dt><dd>${f(r.t[j] * 1000, 1)} ms</dd><dt>otáčky ω</dt><dd>${f(w, 1)} rad/s</dd><dt>n</dt><dd>${f(w * 60 / (2 * Math.PI), 0)} ot/min</dd>
<dt>proud i</dt><dd style="color:var(--i)">${f(i, 1)} A</dd><dt>napětí u<sub>v</sub></dt><dd style="color:var(--u)">${f(u, 1)} V</dd><dt>u<sub>i</sub> = kΦω</dt><dd>${f(p.kPhi * w, 1)} V</dd>
<dt>moment motoru M</dt><dd>${f(p.kPhi * i, 1)} N·m</dd><dt>vnější zátěž M<sub>z</sub></dt><dd>${f(mzNow, 0)} N·m</dd><dt>na zrychlení M − M<sub>z</sub></dt><dd>${r.br[j] ? 'brzda' : f(p.kPhi * i - mzNow, 1) + ' N·m'}</dd>
${S.step === 1 ? `<dt>brzda</dt><dd>${r.br[j] ? '<span style="color:var(--i)">drží</span>' : 'volná'}</dd>` : ''}<dt>příkon u<sub>v</sub>·i</dt><dd>${f(u * i / 1000, 2)} kW</dd><dt>ztráty ve vinutí R·i²</dt><dd>${f(p.R * i * i / 1000, 2)} kW</dd><dt>výkon na hřídeli M·ω</dt><dd>${f(p.kPhi * i * w / 1000, 2)} kW</dd><dt>teplo ∫R·i² dt</dt><dd>${f(r.q[j] / 1000, 2)} kJ</dd>${p.profil === 'auto' ? `<dt>rychlost auta</dt><dd>${f(kmh(w), 0)} km/h</dd><dt>zrychlení auta</dt><dd>${f((p.kPhi * i - mzNow) / p.J * KOLO.r / KOLO.n / 9.81, 2)} g</dd>` : ''}`;
  const rot = document.getElementById('mRot'); if (rot) rot.setAttribute('transform', `rotate(${-(r.th[j] * 180 / Math.PI) % 360} 150 79)`);
  const wd = document.getElementById('mWind'); if (wd) wd.setAttribute('opacity', (0.15 + 0.85 * Math.min(1, Math.abs(i) / 300)).toFixed(2));
  const ld = document.getElementById('mLoad'); if (ld) ld.setAttribute('opacity', p.zatez && r.t[j] >= p.t_Mz && p.Mz > 0 && !r.br[j] ? 1 : 0);
  const bk = document.getElementById('mBrake'); if (bk) bk.setAttribute('opacity', r.br[j] ? 1 : 0);
}


function bindControls() {
  document.querySelectorAll('.ctl input[type=range]').forEach(el => el.addEventListener('input', () => {
    const key = el.dataset.k, c = CTL[key]; P[key] = +el.value;
    $('o_' + key).textContent = `${f(P[key], c.d)} ${c.u}`;
    const sr = el.parentElement.querySelector('.src'); if (sr) sr.textContent = srcTxt(key);
    recompute();
  }));
  document.querySelectorAll('#vstup button').forEach(b => b.addEventListener('click', () => { P.vstup = b.dataset.v; document.querySelectorAll('#vstup button').forEach(x => x.setAttribute('aria-pressed', x === b)); recompute(); }));
  if ($('aw')) $('aw').addEventListener('change', e => { P.aw = e.target.checked; recompute(); });
  if ($('ff')) $('ff').addEventListener('change', e => { P.ff = e.target.checked; recompute(); });
  if ($('ovl')) $('ovl').addEventListener('change', e => { S.overlay = e.target.checked; recompute(); });
  $('reset').addEventListener('click', () => { Object.assign(P, M.BASE); S.preset = null; S.view = null; render(); });
  if ($('zae14')) $('zae14').addEventListener('click', () => { Object.assign(P, M.BASE); S.preset = null; S.view = null; render(); });
  if ($('zatez')) $('zatez').addEventListener('change', e => { P.zatez = e.target.checked; render(); });
  if ($('zmena')) $('zmena').addEventListener('change', e => { P.zmena = e.target.checked; if (P.zmena && P.T < 1.2) { P.T = 1.2; } render(); });
  document.querySelectorAll('[data-ps]').forEach(b => b.addEventListener('click', () => { const ps = PRESETS[S.step][+b.dataset.ps]; Object.assign(P, M.BASE, ps[1]); S.preset = S.step + ':' + b.dataset.ps; S.view = null; S.cursor = Math.min(S.cursor, P.T); render(); }));
  document.querySelectorAll('#brzda button').forEach(b => b.addEventListener('click', () => { P.brzda = b.dataset.b; render(); }));
  if ($('c_tb')) $('c_tb').addEventListener('input', e => { P.t_brzda = +e.target.value; $('o_tb').textContent = `${f(P.t_brzda * 1000, 0)} ms`; recompute(); });
  if ($('ideal')) $('ideal').addEventListener('change', e => { P.idealni = e.target.checked; recompute(); });
  if ($('refbtn')) $('refbtn').addEventListener('click', () => { Object.assign(P, REF, { brzda: 'uvolnit', t_brzda: 0.40 }); S.cursor = 0.40; render(); });
  for (const k of ['w', 'i', 'u']) {
    const cv = $('cv_' + k); if (!cv) continue;
    cv.addEventListener('pointermove', e => tooltips(e, k));
    cv.addEventListener('pointerleave', () => { const tp = $('tp_' + k); if (tp) tp.style.display = 'none'; });
  }
  if ($('tcur')) $('tcur').addEventListener('input', e => { S.cursor = +e.target.value; drawAll(); });
  document.querySelectorAll('#slow button').forEach(b => b.addEventListener('click', () => { S.slow = +b.dataset.s; document.querySelectorAll('#slow button').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  document.querySelectorAll('#delka button').forEach(b => b.addEventListener('click', () => { P.T = +b.dataset.d; S.view = null; S.cursor = Math.min(S.cursor, P.T); render(); }));
  if ($('zin')) $('zin').addEventListener('click', () => { const [a, b] = view(), w = (b - a) / 2; setView(S.cursor - w / 2, S.cursor + w / 2); S.step === 6 ? drawSummaryCharts() : drawAll(); });
  if ($('zout')) $('zout').addEventListener('click', () => { const [a, b] = view(), m = (a + b) / 2, w = (b - a) * 2; setView(m - w / 2, m + w / 2); S.step === 6 ? drawSummaryCharts() : drawAll(); });
  if ($('zall')) $('zall').addEventListener('click', () => { setView(0, P.T); S.step === 6 ? drawSummaryCharts() : drawAll(); });
  for (const k of ['w', 'i', 'u']) {
    const cv = $('cv_' + k); if (!cv) continue;
    cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || !cv._map) return; S.drag = { t: tAt(cv, e).t, x: e.clientX }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointerup', e => { if (!S.drag) return; const t = tAt(cv, e).t, d = S.drag; S.drag = null; S.sel = null; if (Math.abs(e.clientX - d.x) > 6) setView(Math.min(d.t, t), Math.max(d.t, t)); drawAll(); });
    cv.addEventListener('dblclick', () => { setView(0, P.T); drawAll(); });
  }
  if ($('play')) $('play').addEventListener('click', play);
  if ($('openall')) $('openall').addEventListener('click', () => { const ds = [...document.querySelectorAll('#notes details')], o = !ds.every(d => d.open); ds.forEach(d => d.open = o); $('openall').textContent = o ? 'Sbalit vše' : 'Rozbalit vše'; });
}


// ------------------------------------------------------------------ shrnutí
function renderSummary(sec) {
  if (!S.mhm || S.mhmProf !== P.profil) { S.mhm = P.profil === 'auto' ? 40 : 50; S.mhmProf = P.profil; }
  if (!S.pcu) S.pcu = 0.15;
  sec.innerHTML = `<h2>Krok 6 · Kompletní simulace a shrnutí</h2>
<p class="sub">Všech pět kroků se stejnými parametry. Posuvníky mění všechny kroky najednou; grafy dole ukazují celou kaskádu s omezením (krok 5).</p>
<div class="card schema"><h3>Výsledné zapojení</h3><div class="scroll">${schema(5).replace(/class="(blk|sum|wire) new"/g, 'class="$1"').replace(/ new"/g, '"')}</div></div>
<div class="card"><h3>Parametry (platí pro všechny kroky)</h3>${ctlHtml(STEP_CTL[6])}</div>
<div class="card"><h3>Srovnání kroků</h3><div class="scroll"><table id="tbl"></table></div><p class="note">Překmit a náběh před zátěží, odchylka na konci simulace (po zátěži), špičky v absolutní hodnotě.</p></div>
<div class="card charts"><h3>Otáčky a proud ve všech krocích</h3>
<div class="row" style="margin:0 0 4px">Zobrazit: <button class="btn" data-cmp="all">vše</button><button class="btn" data-cmp="none">nic</button><button class="btn" data-cmp="real">bez kroku 4 (bez mezí)</button></div>
<div class="chleg" id="lg_cmp"></div><div class="ch"><canvas id="cv_cw"></canvas></div><div class="ch"><canvas id="cv_ci"></canvas></div>
<p class="note" id="cmpnote"></p></div>
<h3>Kompletní simulace (krok 5)</h3>
<div class="duo"><div class="card"><h3>Motor v okamžiku kurzoru</h3><div class="motorbox">${motorSvg()}<dl class="readout" id="ro"></dl></div></div>
<div class="card"><h3>Co si odnést</h3><ul style="margin:0;padding-left:1.2em;font-size:15px">
<li>Motor sám je kmitavá soustava 2. řádu; ovládání naslepo nepozná zátěž.</li>
<li>P regulátor: zpětná vazba, ale ustálená odchylka a menší tlumení.</li>
<li>PI: nulová odchylka, ale zpoždění a riziko nestability.</li>
<li>Kaskáda: vnitřní proudová smyčka udělá z motoru zdroj momentu; vnější PI řídí otáčky.</li>
<li>Meze a anti-windup: fyzikálně možný rozběh s konstantním proudem a lineárně rostoucími otáčkami.</li></ul></div></div>
${chartsHtml('charts')}
<div class="card"><h3>Energie a ohřev motoru (krok 5)</h3>
<p class="note" style="margin:0 0 8px">Teplo vzniká ve vinutí: $Q_{Cu} = \\int R\\,i^2\\,\\mathrm dt$. Ohřev $\\Delta T = Q/(m\\,c)$ počítá bez chlazení (horní odhad pro krátké děje). Dvě krajní představy: teplo se stihne rozprostřít do železa celého motoru, nebo zůstane jen v mědi vinutí (prvních pár sekund).</p>
<div class="controls"><div class="ctl"><label for="c_mhm"><span>Hmotnost motoru m (odhad)</span><output id="o_mhm">${f(S.mhm, 0)} kg</output></label><input type="range" id="c_mhm" min="5" max="300" step="1" value="${S.mhm}"><span class="src">${P.profil === 'auto' ? 'odhad pro motor elektromobilu' : 'odhad: rotor ≈ 2J/r² ≈ 10 kg (r ≈ 0,1 m), celý stroj ≈ 5× víc'}</span></div>
<div class="ctl"><label for="c_pcu"><span>Podíl mědi ve hmotnosti</span><output id="o_pcu">${f(S.pcu * 100, 0)} %</output></label><input type="range" id="c_pcu" min="0.05" max="0.4" step="0.01" value="${S.pcu}"><span class="src">odhad: vinutí bývá 10–25 % hmotnosti stroje</span></div></div>
<div class="read" id="energ"></div>
<details><summary>Jak se počítá a proč je ohřev tak malý / velký</summary><div class="body">
$$\\Delta T_{Fe} = \\frac{Q_{Cu}}{m\\,c_{Fe}},\\qquad \\Delta T_{Cu} = \\frac{Q_{Cu}}{p_{Cu}\\,m\\,c_{Cu}},\\qquad c_{Fe} \\approx 450\\,\\tfrac{\\mathrm J}{\\mathrm{kg\\,K}},\\; c_{Cu} \\approx 385\\,\\tfrac{\\mathrm J}{\\mathrm{kg\\,K}}$$
<p>Krátký rozběh ohřeje motor jen nepatrně: energie ztrát se měří v jednotkách až desítkách kJ, kdežto ohřát 50 kg železa o 1 K stojí 22,5 kJ. Nebezpečné je až <b>trvání</b>: ustálené ztráty $R\\,i^2$ ohřívají stroj stále dál, dokud teplo neodvede chlazení. Proto se motory a měniče hlídají tepelným modelem a proud nad jmenovitý je dovolen jen na omezenou dobu (viz krok 4). Pro zabrzděnou kotvu z kroku 1 (750 A, 22,5 kW) by 50 kg železa rostlo o ≈ 1 K každou sekundu, samotná měď (7,5 kg) o ≈ 8 K/s.</p>
<p class="note">Hmotnost a podíl mědi jsou odhady (výukový motor ZAE14 nemá v podkladech hmotnost). Model nepočítá s chlazením, s růstem odporu mědi s teplotou (asi +0,4 % na kelvin) ani s ztrátami v železe.</p></div></details></div>
<details><summary>Ověř si sám (doklad zvládnutí)</summary><div class="body"><ul class="check">
<li>Bez simulace odhadni ustálené $i$ a $u_v$ pro jiné $M_z$ a ω*, pak to ověř posuvníky.</li>
<li>Vysvětli, proč má krok 2 ustálenou odchylku, a spočítej ji větou o koncové hodnotě.</li>
<li>V kroku 3 nastav $\tau_u$ pod mez z Routhova kritéria a vysvětli, co se stalo.</li>
<li>V kroku 5 zmenši $I_{max}$ na 100 A a předem odhadni dobu rozběhu $J\omega^*/(k\Phi I_{max})$.</li>
<li>Vypni anti-windup a vysvětli, odkud se vzal překmit.</li>
<li>Přepiš krok 5 do MATLABu (výchozí bod <span>motor_zae.m</span>) a spusť ho.</li></ul></div></details>
<details><summary>Meze modelu a zdroje</summary><div class="body"><p>Průměrovaný měnič 1. řádu (bez PWM zvlnění), konstantní buzení $k\Phi$, bez tření a oteplení, čtyřkvadrantový pohon. Regulátor i integrace s krokem 25 µs (RK4, povel držený mezi kroky). Parametry motoru a kaskády: ZAE14_regulaceSSmot(PIvsLSR).pdf, str. 7, 10, 12, 21. Vymyšlené: $U_{max}$, $K_{p,u}$, $\tau_u$, ω*, $M_z$, časování. Schéma podle ručního zápisu z výuky 21. 11. 2026, list 4. Stejné výsledky dává <code>motor_kaskada.py</code>.</p></div></details>`;
  bindControls();
  $('c_mhm').addEventListener('input', e => { S.mhm = +e.target.value; $('o_mhm').textContent = `${f(S.mhm, 0)} kg`; drawEnergy(); });
  $('c_pcu').addEventListener('input', e => { S.pcu = +e.target.value; $('o_pcu').textContent = `${f(S.pcu * 100, 0)} %`; drawEnergy(); });
  recompute();
}

function recomputeSummary() {
  S.all = [1, 2, 3, 4, 5].map(k => sim(k, null, 5000));
  S.cur = S.all[4]; S.prev = null; S.ev = udalosti(S.cur); renderEvents();
  const rows = S.all.map((r, j) => {
    const m = r.m, bad = r.nestabilni;
    return `<tr data-k="${j}"><td><label style="cursor:pointer"><input type="checkbox" data-cmpk="${j}"> <span class="sw" style="background:var(--s${j + 1})"></span>${j + 1} · ${SHORT[j + 1]}${j === 4 ? ' + meze' : ''}</label></td><td>${bad ? 'nestabilní' : f(m.prekmit, 1) + ' %'}</td><td>${bad ? '—' : f(m.nabeh_ms, 1) + ' ms'}</td><td>${bad ? '—' : f(m.e_po, 2) + ' rad/s'}</td><td>${bad ? '—' : f(m.i_peak, 0) + ' A'}</td><td>${bad ? '—' : f(m.u_peak, 0) + ' V'}</td></tr>`;
  }).join('');
  $('tbl').innerHTML = `<tr><th>Krok (zaškrtni pro graf)</th><th>Překmit</th><th>Náběh 10–90 %</th><th>Odchylka na konci</th><th>Špička i</th><th>Špička u<sub>v</sub></th></tr>${rows}`;
  $('lg_cmp').innerHTML = [1, 2, 3, 4, 5].map(k => `<label style="cursor:pointer"><input type="checkbox" data-cmpk="${k - 1}"> <span style="--c:var(--s${k})">${k} · ${SHORT[k]}</span></label>`).join('') + `<span class="dash" style="--c:var(--ref)">ω*</span>`;
  document.querySelectorAll('[data-cmpk]').forEach(el => el.addEventListener('change', () => { S.cmp[+el.dataset.cmpk] = el.checked; syncCmp(); drawSummaryCharts(); }));
  document.querySelectorAll('[data-cmp]').forEach(b => b.onclick = () => { const m = b.dataset.cmp; S.cmp = S.cmp.map((_, j) => m === 'all' || (m === 'real' && j !== 3)); syncCmp(); drawSummaryCharts(); });
  syncCmp();
  math($('step'));
  drawSummaryCharts();
}
function syncCmp() {
  document.querySelectorAll('[data-cmpk]').forEach(el => { el.checked = S.cmp[+el.dataset.cmpk]; });
  document.querySelectorAll('#tbl tr[data-k]').forEach(tr => { tr.style.opacity = S.cmp[+tr.dataset.k] ? 1 : 0.45; });
}
function drawEnergy() {
  const r = S.cur; if (!r || !$('energ')) return;
  const p = r.p, m = r.m, j = idx(r.t, S.cursor), mFe = S.mhm, mCu = S.pcu * S.mhm;
  const dT = (Q, mm, c) => Q / (mm * c);
  const qN = r.q[j], Q = m.Q_Cu, Ek = 0.5 * p.J * r.w[r.w.length - 1] ** 2, Pend = p.R * m.i_end ** 2;
  $('energ').innerHTML = `<div><span>teplo ve vinutí do kurzoru (${f(r.t[j] * 1000, 0)} ms)</span><b>${f(qN / 1000, 2)} kJ</b></div>
<div><span>ohřev železa celého motoru do kurzoru</span><b>${f(dT(qN, mFe, 450), 3)} K</b></div>
<div><span>ohřev samotné mědi do kurzoru</span><b>${f(dT(qN, mCu, 385), 3)} K</b></div>
<div><span>teplo za celý záznam</span><b>${f(Q / 1000, 2)} kJ</b></div>
<div><span>ohřev železa / mědi za záznam</span><b>${f(dT(Q, mFe, 450), 3)} / ${f(dT(Q, mCu, 385), 3)} K</b></div>
<div><span>energie ze zdroje / na hřídeli</span><b>${f(m.E_zdroj / 1000, 1)} / ${f(m.E_mech / 1000, 1)} kJ</b></div>
<div><span>kinetická energie na konci ½Jω²</span><b>${f(Ek / 1000, 1)} kJ</b></div>
<div><span>kdyby ustálený stav trval: ztráty R·i²</span><b>${f(Pend, 0)} W → ${f(Pend * 60 / (mFe * 450), 2)} K/min</b></div>`;
}
function drawSummaryCharts() {
  const T = P.T, marks = znacky(P), a = S.all;
  // barva patří kroku, ne pořadí: skrytí kroku nepřebarví ostatní
  const vis = a.map((r, j) => ({ r, j })).filter(x => S.cmp[x.j]);
  const peak = Math.max(0, ...vis.map(x => x.r.m.i_peak));
  const sym = peak > 1500;
  drawChart($('cv_cw'), { T, x0: view()[0], x1: view()[1], marks, labels: true, ylabel: 'ω [rad/s]', series: [{ t: a[0].t, y: a[0].ww, c: '--ref', dash: [6, 4], w: 1.5 }, ...vis.map(({ r, j }) => ({ t: r.t, y: r.w, c: `--s${j + 1}`, w: 1.8 }))] });
  drawChart($('cv_ci'), { T, x0: view()[0], x1: view()[1], marks, ylabel: sym ? 'i [A] (symlog)' : 'i [A]', symlog: sym, series: vis.map(({ r, j }) => ({ t: r.t, y: r.i, c: `--s${j + 1}`, w: 1.8 })) });
  $('cmpnote').textContent = !vis.length ? 'Není vybrán žádný krok.' : sym ? 'Proud je v symetrickém logaritmickém měřítku (do ±300 A lineárně), protože vybraný krok má špičku přes 1 500 A. Skryj krok 4 a měřítko se přepne na lineární.' : 'Proud v lineárním měřítku (žádný vybraný krok nemá špičku přes 1 500 A).';
  drawAll(); drawEnergy();
}

function math(el) {
  if (typeof renderMathInElement !== 'function') return;
  renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
}

// ------------------------------------------------------------------ start
$('steps').innerHTML = [1, 2, 3, 4, 5, 6].map(k => `<button data-k="${k}"><span class="n">${k}</span>${SHORT[k]}</button>`).join('');
$('steps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.k); });
$('prev').addEventListener('click', () => go(S.step - 1));
$('next').addEventListener('click', () => go(S.step + 1));
function go(k) { if (k < 1 || k > 6) return; S.playing = false; S.step = k; S.view = null; try { history.replaceState(null, '', '#krok' + k); } catch (e) { } render(); window.scrollTo({ top: $('steps').offsetTop - 4, behavior: 'smooth' }); }
const h = /#krok(\d)/.exec(location.hash); if (h) S.step = Math.min(6, Math.max(1, +h[1]));
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => S.step === 6 ? drawSummaryCharts() : drawAll(), 120); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => S.step === 6 ? drawSummaryCharts() : drawAll());
render();
