// Cliente de Puto Cartas: lobby, mesa, arrastrar/apuntar, animaciones y sonido.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $("#app");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let DB = {};
let HEROES = {};

// ================= sonido (sintetizado, sin archivos) =================
const Sonido = (() => {
  let ctx = null;
  let mudo = localStorage.getItem("mudo") === "1";
  const a = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function tono(f, dur, tipo = "sine", vol = 0.15, slide = 0, delay = 0) {
    if (mudo) return;
    const c = a(), t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur);
  }
  function ruido(dur, vol = 0.2, filtro = 800) {
    if (mudo) return;
    const c = a(), b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = "lowpass"; f.frequency.value = filtro; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start();
  }
  return {
    jugar() { ruido(0.22, 0.35, 380); tono(90, 0.25, "sine", 0.35, 0.5); },
    carta() { ruido(0.1, 0.12, 3000); },
    golpe(n = 2) { ruido(0.16 + 0.02 * Math.min(n, 8), 0.4, 420 + n * 70); tono(120, 0.22, "sine", 0.3, 0.45); },
    ataque() { ruido(0.14, 0.18, 2200); },
    muere() { tono(240, 0.4, "sawtooth", 0.07, 0.35); ruido(0.3, 0.15, 900); },
    turno() { tono(523, 0.15, "triangle", 0.15); tono(784, 0.3, "triangle", 0.15, 0, 0.12); },
    roba() { tono(880, 0.07, "sine", 0.06, 1.4); },
    cura() { tono(660, 0.25, "sine", 0.1, 1.5); },
    escudo() { tono(1400, 0.3, "triangle", 0.1, 0.5); },
    hechizo() { tono(500, 0.35, "triangle", 0.1, 2.2); ruido(0.3, 0.1, 4000); },
    victoria() { [523, 659, 784, 1046].forEach((f, i) => tono(f, 0.35, "triangle", 0.15, 0, i * 0.13)); },
    derrota() { [392, 330, 262].forEach((f, i) => tono(f, 0.45, "sawtooth", 0.06, 0, i * 0.2)); },
    error() { tono(140, 0.15, "square", 0.05); },
    // mono: "uh uh uh ¡AAH AAH!" con formantes (sierra filtrada + vibrato)
    mono() {
      if (mudo) return;
      const c = a(), t0 = c.currentTime, base = 380 + Math.random() * 120;
      const llamada = (t, f, dur, vol, sube, chillido) => {
        const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * sube, t + dur * 0.6);
        o.frequency.exponentialRampToValueAtTime(f * sube * 0.8, t + dur);
        lfo.frequency.value = chillido ? 32 : 9; lg.gain.value = chillido ? f * 0.06 : f * 0.02;
        lfo.connect(lg).connect(o.frequency);
        bp.type = "bandpass"; bp.frequency.value = chillido ? 1900 : 900; bp.Q.value = chillido ? 3 : 5;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(bp).connect(g).connect(c.destination);
        o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
      };
      const n = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) llamada(t0 + i * 0.13, base * (1 + i * 0.12), 0.11, 0.35, 1.5, false);
      for (let i = 0; i < 2; i++) llamada(t0 + n * 0.13 + 0.05 + i * 0.24, base * 2.2, 0.22, 0.28, 1.35, true);
    },
    monito() { // un solo "uh" corto para los Tun invocados
      if (mudo) return;
      const c = a(), t = c.currentTime, o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.09);
      bp.type = "bandpass"; bp.frequency.value = 1000; bp.Q.value = 5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(bp).connect(g).connect(c.destination); o.start(t); o.stop(t + 0.14);
    },
    lanzar() { ruido(0.25, 0.12, 1800); },
    // entrada legendaria: brillo que sube (o coro oscuro si es demonio)
    legendaria(oscuro) {
      if (mudo) return;
      const notas = oscuro ? [110, 131, 156, 185] : [392, 494, 587, 784, 988];
      notas.forEach((f, i) => tono(f, 0.9 - i * 0.08, oscuro ? "sawtooth" : "triangle", oscuro ? 0.05 : 0.07, 1.02, i * 0.07));
      if (!oscuro) [1568, 1976, 2637].forEach((f, i) => tono(f, 0.4, "sine", 0.035, 1, 0.3 + i * 0.09));
      ruido(0.7, 0.05, oscuro ? 500 : 4000);
    },
    robo() { ruido(0.3, 0.15, 3000); tono(300, 0.25, "triangle", 0.08, 2.2); tono(900, 0.2, "sine", 0.05, 0.5, 0.25); },
    descubrir() { [523, 659, 784, 988, 1175, 1568].forEach((f, i) => tono(f, 0.5, "triangle", 0.05, 1, i * 0.06)); ruido(0.6, 0.04, 7000); },
    slam() { tono(55, 0.6, "sine", 0.6, 0.5); tono(110, 0.25, "square", 0.08, 0.4); ruido(0.5, 0.35, 900); },
    activa() { [880, 1320, 1760].forEach((f, i) => tono(f, 0.22, "sine", 0.07, 1.01, i * 0.05)); ruido(0.15, 0.04, 5000); },
    progreso(fr) { const f = 520 + fr * 700; tono(f, 0.14, "triangle", 0.09); tono(f * 1.5, 0.12, "sine", 0.04, 1, 0.03); },
    logro() { // fanfarria de misión cumplida
      [523, 659, 784, 1046, 1318].forEach((f, i) => tono(f, 0.5, "triangle", 0.12, 1, i * 0.09));
      [[1046, 1318, 1568]].forEach((ac) => ac.forEach((f) => tono(f, 1.3, "sine", 0.06, 1, 0.5)));
      [2093, 2637, 3136].forEach((f, i) => tono(f, 0.6, "sine", 0.03, 1, 0.55 + i * 0.12));
      tono(65, 0.5, "sine", 0.4, 0.6, 0.45); ruido(0.6, 0.08, 6000);
    },
    piedra() { // crac de piedra: chasquido agudo + golpe grave + cascajo
      if (mudo) return;
      ruido(0.05, 0.6, 6000); tono(70, 0.25, "sine", 0.45, 0.4);
      setTimeout(() => ruido(0.35, 0.12, 2500), 40);
    },
    demonio() { // gruñido grave con distorsión
      if (mudo) return;
      const c = a(), t = c.currentTime, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), ws = c.createWaveShaper();
      const curva = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curva[i] = Math.tanh(x * 6); }
      ws.curve = curva;
      o.type = "sawtooth"; o2.type = "square";
      o.frequency.setValueAtTime(58, t); o.frequency.linearRampToValueAtTime(42, t + 0.9);
      o2.frequency.setValueAtTime(87, t); o2.frequency.linearRampToValueAtTime(60, t + 0.9);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
      o.connect(ws); o2.connect(ws); ws.connect(g).connect(c.destination);
      o.start(t); o2.start(t); o.stop(t + 1.05); o2.stop(t + 1.05);
      ruido(0.8, 0.08, 300);
    },
    archivo(url) { if (mudo) return; try { const au = new Audio(url); au.volume = 0.8; au.play().catch(() => {}); } catch {} },
    tic() { tono(1000, 0.04, "square", 0.03); },
    get mudo() { return mudo; },
    toggle() { mudo = !mudo; localStorage.setItem("mudo", mudo ? "1" : "0"); },
    despertar() { try { a().resume(); } catch {} },
  };
})();
addEventListener("pointerdown", () => Sonido.despertar(), { once: true });

// ================= utilidades visuales =================
function colorDe(t) {
  let h = 0;
  for (const ch of String(t || "x")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 45% 45%), hsl(${(h + 40) % 360} 50% 28%))`;
}
const artHTML = (arte) => (/^(https?:)?\//.test(arte || "") ? `<img src="${esc(arte)}" alt="">` : esc(arte || "❔"));

function cartaHTML(c, { uid = "", clase = "" } = {}) {
  const esH = c.tipo === "hechizo" || c.tipo === "mision";
  const etiqueta = [c.clase ? HEROES[c.clase]?.nombre || c.clase : (c.token ? "" : "Neutral"), c.arquetipo || "", c.tribu && c.tribu !== c.clase ? c.tribu[0].toUpperCase() + c.tribu.slice(1) : "", { hombre: "♂", mujer: "♀", no_binario: "⚧" }[c.genero] || ""].filter(Boolean).join(" · ");
  // como en Hearthstone: las cartas de clase llevan el marco del color de su héroe; las neutrales, piedra gris
  const marco = c.clase && c.tipo !== "mision" ? HEROES[c.clase]?.marco : null;
  return `<div class="carta ${esH ? "hechizo" : ""} ${c.tipo === "mision" ? "mision" : ""} ${c.rareza === "legendaria" ? "legendaria" : ""} ${clase}" ${uid ? `data-uid="${uid}"` : ""} data-carta="${esc(c.id)}"${marco ? ` style="--marco:${esc(marco)}"` : ""}>
    <div class="arte" style="--fondo:${colorDe(c.arquetipo || c.id)}">${artHTML(c.arte)}</div>
    <div class="titulo">${esc(c.nombre)}</div>
    <div class="texto ${((l) => (l > 115 ? "t4" : l > 85 ? "t3" : l > 50 ? "t2" : ""))((c.texto || "").length)}">${esc(c.texto || "")}</div>
    ${etiqueta ? `<div class="arq">${esc(etiqueta)}</div>` : ""}
    <div class="stat mana ${DB[c.id] && c.coste < DB[c.id].coste ? "rebajado" : ""}">${c.coste}</div>
    ${esH ? "" : `<div class="stat atk">${c.ataque}</div><div class="stat hp">${c.vida}</div>`}
  </div>`;
}

function toast(t, ms = 1600) {
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = t;
  document.body.append(d);
  d.animate([{ opacity: 0, transform: "translate(-50%, 10px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], 150);
  setTimeout(() => d.animate([{ opacity: 1 }, { opacity: 0 }], 250).onfinish = () => d.remove(), ms);
}

const centro = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

function numero(el, txt, tipo) {
  if (!el) return;
  const { x, y } = centro(el);
  const d = document.createElement("div");
  d.className = `numero ${tipo}`; d.textContent = txt;
  d.style.left = x + "px"; d.style.top = y + "px";
  $("#fx").append(d);
  d.animate([{ transform: "scale(.3)", opacity: 0 }, { transform: "scale(1.25)", opacity: 1, offset: 0.25 },
    { transform: "scale(1)", opacity: 1, offset: 0.7 }, { transform: "translateY(-24px) scale(.9)", opacity: 0 }],
    { duration: 1100, easing: "ease-out" }).onfinish = () => d.remove();
}

function particulas(x, y, color, n = 14, fuerza = 70) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement("div");
    p.className = "particula"; p.style.left = x + "px"; p.style.top = y + "px"; p.style.background = color;
    $("#fx").append(p);
    const ang = Math.random() * Math.PI * 2, dist = fuerza * (0.5 + Math.random());
    p.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(.2)`, opacity: 0 }],
      { duration: 500 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => p.remove();
  }
}

function temblar(el, fuerte = false) {
  if (!el) return;
  el.animate(fuerte
    ? [{ transform: "translate(0,0)" }, { transform: "translate(-9px,5px)" }, { transform: "translate(8px,-6px)" }, { transform: "translate(-6px,-3px)" }, { transform: "translate(4px,4px)" }, { transform: "translate(0,0)" }]
    : [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
    { duration: fuerte ? 380 : 260 });
}

// onda expansiva
function onda(x, y, color = "#ffd34f", tam = 260) {
  const o = document.createElement("div");
  o.className = "onda"; o.style.cssText = `left:${x}px;top:${y}px;--c:${color}`;
  $("#fx").append(o);
  o.animate([{ transform: "translate(-50%,-50%) scale(.1)", opacity: 1 }, { transform: `translate(-50%,-50%) scale(${tam / 40})`, opacity: 0 }], { duration: 600, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => o.remove();
}

// entrada de legendaria (estilo Hearthstone): se oscurece todo, aparece grande con rayos y cae de golpe a la mesa
async function entradaEspecial(c, seat, tipo) {
  const tab = $(`.tablero[data-seat="${seat}"]`);
  if (!tab) return;
  const demonio = tipo === "demonio", color = demonio ? "#ff2a2a" : "#ffd34f";
  const d = centro(tab), cx = innerWidth / 2, cy = innerHeight / 2;
  const velo = document.createElement("div"), rayos = document.createElement("div"), fig = document.createElement("div");
  velo.className = "velo" + (demonio ? " rojo" : "");
  rayos.className = "rayos" + (demonio ? " rojo" : "");
  fig.className = "entrada-fig" + (demonio ? " rojo" : "");
  fig.innerHTML = `<span>${artHTML(c.arte)}</span>`;
  fig.style.setProperty("--fondo", colorDe(c.arquetipo || c.id));
  rayos.style.cssText = fig.style.cssText + `;left:${cx}px;top:${cy}px`;
  fig.style.left = cx + "px"; fig.style.top = cy + "px";
  $("#fx").append(velo, rayos, fig);
  Sonido.legendaria(demonio);
  if (demonio) setTimeout(() => Sonido.demonio(), 250);
  velo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "forwards" });
  rayos.animate([{ transform: "translate(-50%,-50%) scale(.2) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(90deg)", opacity: 1 }], { duration: 750, fill: "forwards", easing: "ease-out" });
  await fig.animate([{ transform: "translate(-50%,-50%) scale(.1) rotate(-20deg)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(2.1) rotate(3deg)", opacity: 1, offset: 0.7 },
    { transform: "translate(-50%,-50%) scale(1.9) rotate(0)", opacity: 1 }], { duration: 700, easing: "cubic-bezier(.2,.9,.3,1.2)", fill: "forwards" }).finished;
  await esperar(320);
  rayos.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" });
  await fig.animate([{ transform: "translate(-50%,-50%) scale(1.9)" }, { transform: `translate(calc(-50% + ${d.x - cx}px), calc(-50% + ${d.y - cy}px)) scale(1)` }],
    { duration: 190, easing: "cubic-bezier(.7,0,1,.6)", fill: "forwards" }).finished;
  Sonido.slam();
  temblar($(".mesa"), true);
  onda(d.x, d.y, color, 360);
  particulas(d.x, d.y, color, 34, 140);
  particulas(d.x, d.y + 20, "#d8c3a0", 20, 80);
  fig.remove(); rayos.remove();
  await velo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished;
  velo.remove();
}

// efecto de fin de turno: la carta se levanta brillando y se muestra al lado, como en Hearthstone
async function activarCarta(el) {
  Sonido.activa();
  const c = centro(el), id = el.dataset.carta;
  el.style.zIndex = 30;
  const anillo = document.createElement("div");
  anillo.className = "runa"; anillo.style.left = c.x + "px"; anillo.style.top = c.y + "px";
  $("#fx").append(anillo);
  anillo.animate([{ transform: "translate(-50%,-50%) scale(.4) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.2) rotate(120deg)", opacity: 1, offset: 0.4 },
    { transform: "translate(-50%,-50%) scale(1.6) rotate(240deg)", opacity: 0 }], { duration: 900 }).onfinish = () => anillo.remove();
  el.animate([{ transform: "translateY(0) scale(1)", filter: "none" }, { transform: "translateY(-14px) scale(1.25)", filter: "brightness(1.5) drop-shadow(0 0 16px #ffd34f)", offset: 0.3 },
    { transform: "translateY(-14px) scale(1.25)", filter: "brightness(1.5) drop-shadow(0 0 16px #ffd34f)", offset: 0.75 }, { transform: "translateY(0) scale(1)", filter: "none" }],
    { duration: 950, easing: "ease-in-out" }).onfinish = () => (el.style.zIndex = "");
  particulas(c.x, c.y, "#ffd34f", 14, 60);
  if (DB[id]) { // la carta aparece a un lado del esbirro
    const m = document.createElement("div");
    m.className = "popup-carta";
    m.innerHTML = cartaHTML(DB[id]);
    const izq = c.x > innerWidth / 2;
    m.style.top = Math.min(Math.max(c.y, 140), innerHeight - 140) + "px";
    m.style[izq ? "right" : "left"] = Math.max(8, izq ? innerWidth - c.x + 50 : c.x + 50) + "px";
    document.body.append(m);
    await m.animate([{ transform: "translateY(-50%) scale(.3)", opacity: 0 }, { transform: "translateY(-50%) scale(1.05)", opacity: 1, offset: 0.2 },
      { transform: "translateY(-50%) scale(1)", opacity: 1, offset: 0.85 }, { transform: "translateY(-50%) scale(.6)", opacity: 0 }], { duration: 1100, easing: "ease-out" }).finished;
    m.remove();
  } else await esperar(700);
}

// golpe con peso: destello blanco, sacudida según el daño y temblor de pantalla si es grande
function impacto(el, n) {
  if (!el) return;
  const fuerza = Math.min(14, 3 + n * 1.6);
  el.animate([{ filter: "brightness(3) saturate(0)" }, { filter: "brightness(1.6) sepia(1) hue-rotate(-30deg) saturate(4)", offset: 0.25 }, { filter: "none" }], { duration: 320 });
  el.animate([{ transform: "translate(0,0)" }, { transform: `translate(${-fuerza}px, ${fuerza * 0.4}px) rotate(-3deg)` }, { transform: `translate(${fuerza * 0.8}px, ${-fuerza * 0.5}px) rotate(2deg)` },
    { transform: `translate(${-fuerza * 0.5}px, ${-fuerza * 0.2}px)` }, { transform: "translate(0,0)" }], { duration: 300, easing: "ease-out" });
  const c = centro(el);
  particulas(c.x, c.y, "#ff3b2f", Math.min(22, 6 + n * 2), 40 + n * 6);
  if (n >= 5 || (el.classList.contains("heroe") && n >= 4)) temblar($(".mesa"), true);
}

// piedra realista: sale del esbirro, vuela en arco girando con su sombra, revienta en pedazos
const PIEDRA_SVG = `<svg viewBox="0 0 64 64" width="100%" height="100%"><defs>
  <radialGradient id="pg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#b9b2a6"/><stop offset=".45" stop-color="#7d756a"/><stop offset="1" stop-color="#3b3631"/></radialGradient>
  <filter id="pr"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>
  <path d="M14 22 L26 9 L44 11 L56 26 L52 45 L36 56 L18 52 L8 38 Z" fill="url(#pg)" filter="url(#pr)" stroke="#2a2622" stroke-width="2"/>
  <path d="M26 9 L30 24 L44 11 M30 24 L18 52 M30 24 L52 45" stroke="#2a262266" stroke-width="1.5" fill="none"/></svg>`;
async function tirarPiedra(desdeEl, aEl) {
  if (!aEl) return;
  const o = centro(desdeEl || document.body), d = centro(aEl);
  const piedra = document.createElement("div"), sombra = document.createElement("div");
  piedra.style.cssText = "position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;z-index:67;pointer-events:none;filter:drop-shadow(0 3px 2px #000a)";
  sombra.style.cssText = "position:fixed;width:30px;height:10px;margin:-5px 0 0 -15px;border-radius:50%;background:#0006;filter:blur(2px);z-index:63;pointer-events:none";
  piedra.innerHTML = PIEDRA_SVG;
  $("#fx").append(sombra, piedra);
  Sonido.lanzar();
  const altura = Math.max(90, Math.abs(d.x - o.x) * 0.35 + 70), dur = 520;
  const pasos = 24, kfP = [], kfS = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos, x = o.x + (d.x - o.x) * t, ySuelo = o.y + (d.y - o.y) * t, y = ySuelo - Math.sin(Math.PI * t) * altura;
    const esc = 1 + Math.sin(Math.PI * t) * 0.45;
    kfP.push({ left: x + "px", top: y + "px", transform: `rotate(${t * 720}deg) scale(${esc})`, offset: t });
    kfS.push({ left: x + "px", top: ySuelo + 18 + "px", transform: `scale(${1 - Math.sin(Math.PI * t) * 0.5})`, opacity: 0.4 + (1 - Math.sin(Math.PI * t)) * 0.5, offset: t });
  }
  sombra.animate(kfS, { duration: dur, easing: "linear" });
  await piedra.animate(kfP, { duration: dur, easing: "cubic-bezier(.3,.1,.7,1)" }).finished;
  piedra.remove(); sombra.remove();
  Sonido.piedra();
  // pedazos de piedra y polvo
  for (let i = 0; i < 12; i++) {
    const f = document.createElement("div"), lado = 4 + Math.random() * 7;
    f.style.cssText = `position:fixed;left:${d.x}px;top:${d.y}px;width:${lado}px;height:${lado}px;z-index:66;pointer-events:none;
      background:${["#8a8276", "#5e574e", "#a59d90"][i % 3]};clip-path:polygon(50% 0,100% 40%,80% 100%,10% 85%,0 30%)`;
    $("#fx").append(f);
    const ang = -Math.PI * (0.1 + Math.random() * 0.8), dist = 40 + Math.random() * 60;
    f.animate([{ transform: "translate(0,0) rotate(0)", opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist * 0.6}px) rotate(${Math.random() * 400}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${Math.cos(ang) * dist * 1.2}px, ${Math.sin(ang) * dist * 0.2 + 30}px) rotate(${Math.random() * 600}deg)`, opacity: 0 }],
      { duration: 650, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => f.remove();
  }
  particulas(d.x, d.y, "#c9b79a", 10, 35);
}

async function banner(texto, ms = 1000) {
  const b = document.createElement("div");
  b.className = "banner"; b.innerHTML = `<span>${esc(texto)}</span>`;
  document.body.append(b);
  await b.animate([{ opacity: 0, transform: "scale(1.6)" }, { opacity: 1, transform: "scale(1)", offset: 0.25 },
    { opacity: 1, transform: "scale(1)", offset: 0.8 }, { opacity: 0, transform: "scale(.9)" }], { duration: ms, easing: "ease-out" }).finished;
  b.remove();
}

async function mostrarCarta(id, ms = 900) {
  const c = DB[id];
  if (!c) return;
  const m = document.createElement("div");
  m.className = "banner";
  m.innerHTML = cartaHTML(c, { clase: "grande" });
  document.body.append(m);
  await m.firstElementChild.animate([{ transform: "scale(.4) rotate(-8deg)", opacity: 0 }, { transform: "scale(1.05)", opacity: 1, offset: 0.2 },
    { transform: "scale(1)", opacity: 1, offset: 0.85 }, { transform: "scale(.6)", opacity: 0 }], { duration: ms, easing: "ease-out" }).finished;
  m.remove();
}

// ================= ruteo =================
const ruta = location.pathname;
cargarCartas().then(() => {
  if (ruta.startsWith("/p/")) pantallaPartida(ruta.slice(3).replace(/\/$/, ""));
  else if (ruta.startsWith("/cartas")) pantallaColeccion();
  else pantallaLobby();
});

async function cargarCartas() {
  try {
    const d = await (await fetch("/api/cartas")).json();
    DB = Object.fromEntries(d.cartas.map((c) => [c.id, c]));
    HEROES = Object.fromEntries((d.heroes || []).map((h) => [h.id, h]));
  } catch { toast("no cargaron las cartas"); }
}

function pantallaLobby() {
  app.innerHTML = `<div class="lobby"><div class="lobby-caja">
    <h1 class="logo">PUTO<small>CARTAS</small></h1>
    <input id="nombre" maxlength="20" placeholder="tu nombre" value="${esc(localStorage.getItem("nombre") || "")}">
    <button class="boton" id="crear">Crear partida</button>
    <button class="boton" id="bot">Jugar contra el bot</button>
    <button class="boton sec" id="ver">Ver cartas</button>
    <div class="ayuda">Creás la partida y le pasás el link a tu rival, o practicás contra el bot.</div>
  </div></div>`;
  const crear = async (bot) => {
    const n = $("#nombre").value.trim();
    if (!n) { $("#nombre").focus(); toast("poné tu nombre"); return; }
    localStorage.setItem("nombre", n);
    const { id } = await (await fetch("/api/crear", { method: "POST" })).json();
    location.href = "/p/" + id + (bot ? "?bot=1" : "");
  };
  $("#crear").onclick = () => crear(false);
  $("#bot").onclick = () => crear(true);
  $("#ver").onclick = () => (location.href = "/cartas");
}

function pantallaColeccion() {
  const cartas = Object.values(DB).filter((c) => !c.token).sort((a, b) => a.coste - b.coste || a.nombre.localeCompare(b.nombre));
  app.innerHTML = `<div class="coleccion"><h2>Cartas (${cartas.length})</h2>
    <div class="rejilla">${cartas.map((c) => cartaHTML(c)).join("")}</div>
    <button class="boton sec" style="max-width:300px;margin:0 auto 30px" onclick="location.href='/'">Volver</button></div>`;
}

// ================= partida =================
let ws = null, V = null, desfase = 0, cola = [], procesando = false;
let apuntando = null; // { tipo: 'ataque'|'carta', de, uid, pos, origen:{x,y}, validos:Set, fantasma }
let PID = "";

function pedirNombre() {
  return new Promise((res) => {
    app.innerHTML = `<div class="lobby"><div class="lobby-caja">
      <h1 class="logo">PUTO<small>CARTAS</small></h1>
      <div>Te retaron a una partida</div>
      <input id="nombre" maxlength="20" placeholder="tu nombre" value="${esc(localStorage.getItem("nombre") || "")}">
      <button class="boton" id="ok">Entrar</button></div></div>`;
    $("#ok").onclick = () => {
      const n = $("#nombre").value.trim();
      if (!n) return toast("poné tu nombre");
      localStorage.setItem("nombre", n); res(n);
    };
  });
}

async function pantallaPartida(id) {
  PID = id;
  if (!localStorage.getItem("tok_" + id) && !localStorage.getItem("nombre")) await pedirNombre();
  conectar();
  setInterval(actualizarReloj, 250);
}

let intentos = 0;
function conectar() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/${PID}`);
  ws.onopen = () => {
    intentos = 0;
    ws.send(JSON.stringify({ t: "hola", token: localStorage.getItem("tok_" + PID), nombre: localStorage.getItem("nombre"),
      bot: new URLSearchParams(location.search).has("bot") }));
  };
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.t === "token") localStorage.setItem("tok_" + PID, d.token);
    else if (d.t === "error") { Sonido.error(); toast(d.msg); if (V) render(V); }
    else if (d.t === "estado") { cola.push(d); procesar(); }
  };
  ws.onclose = () => {
    if (++intentos > 1) toast("reconectando...", 900);
    setTimeout(conectar, Math.min(5000, 600 * intentos));
  };
}
const enviar = (a) => ws?.readyState === 1 && ws.send(JSON.stringify(a));

async function procesar() {
  if (procesando) return;
  procesando = true;
  try {
    while (cola.length) {
      const { ev, v } = cola.shift();
      desfase = v.ahora - Date.now();
      const nuevos = new Set();
      if (V && V.fase === "jugando" && ev.length) await animar(ev, v, nuevos);
      const antes = V;
      render(v);
      await despues(ev, v, antes, nuevos);
    }
  } finally { procesando = false; }
}

const yoDe = (v) => (v.yo >= 0 ? v.yo : 0);
const refEl = (ref) => $(`[data-ref="${ref}"]`);

// ---------- animaciones de eventos (sobre la mesa anterior) ----------
async function animar(ev, v, nuevos) {
  const yo = yoDe(v);
  for (const e of ev) {
    try { await animarUno(e, ev, v, nuevos, yo); } catch (err) { console.warn("animacion", e.e, err); }
  }
}
async function animarUno(e, ev, v, nuevos, yo) {
  {
    switch (e.e) {
      case "hechizo":
        Sonido.hechizo();
        if (e.seat !== yo) await mostrarCarta(e.carta, 1000); else await esperar(150);
        break;
      case "invoca": {
        nuevos.add(e.uid);
        const c = DB[e.carta] || {};
        if (e.seat !== yo && !c.token) await mostrarCarta(e.carta, 850);
        const tipo = c.entrada || (c.rareza === "legendaria" ? "legendaria" : null);
        if (tipo) {
          ev.__origen = null;
          (nuevos.especial ||= new Set()).add(e.uid);
          await entradaEspecial(c, e.seat, tipo);
        } else if (ev.__origen) (nuevos.origen ||= new Map()).set(e.uid, ev.__origen);
        break;
      }
      case "grito": ev.__origen = e.uid; break;
      case "robo": { // una carta pasa de la mano rival a la tuya
        Sonido.robo();
        const desdeEl = e.de === yo ? $(`.mano .carta[data-uid="${e.uid}"]`) || $(".mano") : $(".mano-rival") || refEl("h" + e.de);
        const hastaEl = e.a === yo ? $(".mano") : $(".mano-rival") || refEl("h" + e.a);
        const o = centro(desdeEl), d = centro(hastaEl);
        const m = document.createElement("div");
        m.className = "popup-carta"; m.innerHTML = cartaHTML(DB[e.carta] || {});
        m.style.left = innerWidth / 2 + "px"; m.style.top = innerHeight / 2 + "px";
        document.body.append(m);
        if (desdeEl?.classList?.contains("carta")) desdeEl.style.visibility = "hidden";
        await m.animate([{ transform: `translate(calc(-50% + ${o.x - innerWidth / 2}px), calc(-50% + ${o.y - innerHeight / 2}px)) scale(.4) rotate(-15deg)`, opacity: 0 },
          { transform: "translate(-50%,-50%) scale(1.15) rotate(3deg)", opacity: 1, offset: 0.3 },
          { transform: "translate(-50%,-50%) scale(1.1) rotate(-2deg)", opacity: 1, offset: 0.7 },
          { transform: `translate(calc(-50% + ${d.x - innerWidth / 2}px), calc(-50% + ${d.y - innerHeight / 2}px)) scale(.35) rotate(10deg)`, opacity: 0.4 }],
          { duration: 1500, easing: "ease-in-out" }).finished;
        m.remove();
        break;
      }
      case "poder": ev.__origen = "poder" + e.seat; break;
      case "roba": case "turno": case "hechizo": ev.__origen = null; break;
      case "ataque": {
        const de = refEl(e.de), a = refEl(e.a);
        if (!de && a) {
          // esbirro recien invocado que se dispara (no esta dibujado todavia): proyectil
          const desde = centro($(`.tablero[data-seat="${e.a[0] === "h" ? 1 - +e.a[1] : (V.j[0].tablero.some((m) => m.uid === e.a) ? 1 : 0)}"]`) || document.body);
          const hasta = centro(a), bala = document.createElement("div");
          bala.className = "proyectil"; bala.innerHTML = artHTML(DB[ev.find((x) => x.uid === e.de)?.carta]?.arte || "🧍");
          bala.style.left = desde.x + "px"; bala.style.top = desde.y + "px";
          $("#fx").append(bala);
          Sonido.ataque();
          await bala.animate([{ transform: "translate(-50%,-50%) scale(.6) rotate(0)" }, { transform: `translate(calc(-50% + ${hasta.x - desde.x}px), calc(-50% + ${hasta.y - desde.y}px)) scale(1.3) rotate(540deg)` }],
            { duration: 330, easing: "cubic-bezier(.5,0,.9,.6)" }).finished;
          bala.remove(); Sonido.golpe(1); particulas(hasta.x, hasta.y, "#ffd27a", 10, 50);
        }
        if (de && (a || ev.some((x) => x.e === "invoca" && x.uid === e.a))) {
          // si el objetivo recién entró (Tun Mujer), van hacia donde va a aparecer
          Sonido.ataque();
          const p1 = centro(de), p2 = a ? centro(a) : centro(de.closest(".tablero") || de);
          const dx = (p2.x - p1.x) * 0.82, dy = (p2.y - p1.y) * 0.82;
          de.style.zIndex = 30;
          await de.animate([{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px) scale(1.12)`, offset: 0.35 },
            { transform: `translate(${dx}px, ${dy}px) scale(1.1)` }], { duration: 300, easing: "cubic-bezier(.6,0,.9,.5)" }).finished;
          Sonido.golpe(e.n || 3);
          particulas(p2.x, p2.y, "#ffd27a", 10, 50);
          de.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0,0)" }], { duration: 260, easing: "ease-out" })
            .onfinish = () => (de.style.zIndex = "");
        }
        break;
      }
      case "dano": {
        const el = refEl(e.a);
        impacto(el, e.n);
        numero(el, "-" + e.n, "dano");
        if (!ev.some((x) => x.e === "ataque" || x.e === "fx")) Sonido.golpe(e.n);
        await esperar(e.n >= 5 ? 220 : 110); // pausa de impacto: los golpes fuertes "pesan"
        break;
      }
      case "fx": {
        if (e.fx === "piedra") await tirarPiedra(refEl(e.de) || $(`.tablero[data-seat="${V.j[0].tablero.some((m) => m.uid === e.de) ? 0 : 1}"]`), refEl(e.a));
        break;
      }
      case "escudo_roto": {
        const el = refEl(e.a);
        if (el) { const c = centro(el); particulas(c.x, c.y, "#ffd34f", 18, 60); Sonido.escudo(); el.classList.remove("escudo"); }
        await esperar(120);
        break;
      }
      case "cura": numero(refEl(e.a), "+" + e.n, "cura"); Sonido.cura(); await esperar(120); break;
      case "buff": numero(refEl(e.a), `+${e.ataque}/+${e.vida}`, "buff"); await esperar(150); break;
      case "destruido": {
        const el = refEl(e.a);
        if (el && e.fx === "devorar") {
          // se lo traga Tun Satánico (que acaba de entrar a la mesa: vamos hacia el centro de mi mesa)
          if (!ev.__gruno) { Sonido.demonio(); ev.__gruno = true; temblar($(".mesa"), true); }
          const destino = centro(refEl(e.por) || el.closest(".tablero") || el);
          const o = centro(el);
          particulas(o.x, o.y, "#7a0010", 14, 40);
          el.style.zIndex = 30;
          await el.animate([{ transform: "translate(0,0) scale(1) rotate(0)", filter: "none" },
            { transform: `translate(${destino.x - o.x}px, ${destino.y - o.y}px) scale(.15) rotate(${Math.random() < 0.5 ? -360 : 360}deg)`, filter: "brightness(.3) sepia(1) hue-rotate(-40deg) saturate(6)" }],
            { duration: 420, easing: "cubic-bezier(.6,0,.9,.4)" }).finished;
          el.style.visibility = "hidden";
          particulas(destino.x, destino.y, "#ff2a2a", 10, 50);
        } else if (el) { const c = centro(el); particulas(c.x, c.y, "#b44cff", 20, 70); }
        break;
      }
      case "muere": {
        const el = refEl(e.uid);
        if (el) {
          await esperar(250);
          Sonido.muere();
          const c = centro(el);
          particulas(c.x, c.y, "#8a6a45", 16, 55);
          await el.animate([{ transform: "scale(1)", filter: "grayscale(0)", opacity: 1 },
            { transform: "scale(.6) rotate(8deg)", filter: "grayscale(1) brightness(.5)", opacity: 0 }], { duration: 380, easing: "ease-in" }).finished;
          el.style.visibility = "hidden";
        }
        break;
      }
      case "fatiga": numero(refEl("h" + e.seat), "-" + e.n, "dano"); toast(`fatiga: ${e.n} de daño`); await esperar(300); break;
      case "quemada": if (e.seat === yo) toast(`mano llena: se quemó ${DB[e.carta]?.nombre || "una carta"}`); break;
      case "mana": numero(refEl("h" + e.seat), "+" + e.n + " maná", "buff"); break;
      case "roba": Sonido.roba(); break;
      case "poder": {
        const b = $(`[data-poder="${e.seat}"]`);
        Sonido.hechizo();
        if (b) { const c = centro(b); particulas(c.x, c.y, "#9ad0ff", 14, 50); b.animate([{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], 350); }
        await esperar(250);
        break;
      }
      case "mision": if (e.seat !== yo) await mostrarCarta(e.carta, 1000); else Sonido.hechizo(); break;
      case "mision_progreso": {
        const chip = $(`.heroe[data-ref="h${e.seat}"] .mision-chip`);
        if (chip) {
          chip.style.setProperty("--p", Math.min(1, e.progreso / e.meta));
          chip.querySelector("b").textContent = `${Math.min(e.progreso, e.meta)}/${e.meta}`;
          chip.animate([{ transform: "translateX(-50%) scale(1)" }, { transform: "translateX(-50%) scale(1.3)", filter: "brightness(1.6)" }, { transform: "translateX(-50%) scale(1)" }], 260);
          const c = centro(chip); particulas(c.x, c.y, "#ffd34f", 6, 30);
        }
        if (!ev.__tics || ev.__tics < 6) { ev.__tics = (ev.__tics || 0) + 1; Sonido.progreso(e.progreso / e.meta); }
        await esperar(70);
        break;
      }
      case "mision_completa": {
        const chip = $(`.heroe[data-ref="h${e.seat}"] .mision-chip`), el = chip || refEl("h" + e.seat);
        Sonido.logro();
        if (chip) {
          chip.classList.add("completa"); chip.querySelector("b").textContent = "✔";
          chip.style.zIndex = 70;
          chip.animate([{ transform: "translateX(-50%) scale(1)" }, { transform: "translateX(-50%) scale(2.6) rotate(-8deg)", filter: "brightness(2) drop-shadow(0 0 20px #ffd34f)", offset: 0.4 },
            { transform: "translateX(-50%) scale(2.3) rotate(4deg)", filter: "brightness(1.5) drop-shadow(0 0 30px #ffd34f)", offset: 0.7 }, { transform: "translateX(-50%) scale(1)" }], { duration: 1300, easing: "ease-in-out" });
        }
        if (el) { const c = centro(el); for (let k = 0; k < 3; k++) setTimeout(() => particulas(c.x, c.y, "#ffd34f", 22, 120), k * 180); onda(c.x, c.y, "#ffd34f"); }
        await banner(e.seat === yo ? "¡MISIÓN COMPLETA!" : `${V.j[e.seat].nombre} completó su misión`, 1400);
        const premio = (DB[e.carta]?.mision?.recompensa || []).find((r) => r.tipo === "dar_carta");
        if (premio) await mostrarCarta(premio.carta, 1300);
        break;
      }
      case "dispara": {
        const el = refEl(e.uid);
        ev.__origen = e.uid;
        if (!el) break;
        if (e.por !== "fin_turno") { // reacción rápida (Tun Puto, Tun Mujer)
          el.animate([{ filter: "none", transform: "scale(1)" }, { filter: "drop-shadow(0 0 12px #ffd34f) brightness(1.4)", transform: "scale(1.15)" }, { filter: "none", transform: "scale(1)" }], 280);
          await esperar(160);
        } else await activarCarta(el);
        break;
      }
      case "global": { const g = ev.find((x) => x.e === "grito" || x.e === "hechizo"); toast("efecto activo por el resto de la partida", 1800); break; }
    }
  }
}

// ---------- lo que pasa después de dibujar ----------
async function despues(ev, v, antes, nuevos) {
  const yo = yoDe(v);
  let monitos = 0, salidas = 0;
  for (const uid of nuevos) {
    const el = refEl(uid);
    if (!el) continue;
    const inv = ev.find((x) => x.e === "invoca" && x.uid === uid);
    const c = DB[inv?.carta] || {};
    if (c.sonido) Sonido.archivo(c.sonido);
    else if (c.tribu === "tun" && !c.token) Sonido.mono();
    else if (c.tribu === "tun" && monitos++ < 2) setTimeout(() => Sonido.monito(), monitos * 90);
    if (nuevos.especial?.has(uid)) { // ya hizo su entrada grande: solo brilla en su lugar
      el.animate([{ filter: "brightness(2.2) drop-shadow(0 0 20px #ffd34f)" }, { filter: "none" }], 700);
      continue;
    }
    const org = nuevos.origen?.get(uid);
    const oEl = org && (org.startsWith("poder") ? $(`[data-poder="${org.slice(5)}"]`) : refEl(org));
    if (oEl && oEl !== el) { // sale disparado de la carta que lo creó (choza, maestro, poder)
      const o = centro(oEl), d = centro(el), k = salidas++;
      el.animate([{ transform: `translate(${o.x - d.x}px, ${o.y - d.y}px) scale(.2)`, opacity: 0 }, { opacity: 1, offset: 0.25 },
        { transform: "translate(0,0) scale(1.12)", offset: 0.8 }, { transform: "translate(0,0) scale(1)" }],
        { duration: 480, delay: k * 90, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" });
      setTimeout(() => { const c = centro(el); particulas(c.x, c.y, "#d8c3a0", 8, 35); Sonido.jugar(); }, 400 + k * 90);
      continue;
    }
    Sonido.jugar();
    el.animate([{ transform: "translateY(-50px) scale(1.45)", opacity: 0 }, { transform: "translateY(4px) scale(.95)", opacity: 1, offset: 0.6 },
      { transform: "translateY(0) scale(1)" }], { duration: 380, easing: "cubic-bezier(.3,1.4,.6,1)" });
    setTimeout(() => { const c = centro(el); particulas(c.x, c.y + 30, "#d8c3a0", 12, 45); temblar($(`.tablero[data-seat="${el.dataset.seat}"]`)); }, 230);
  }
  if (antes?.j?.[yo]?.mano) {
    const viejas = new Set(antes.j[yo].mano.map((c) => c.uid));
    $$(".mano .carta").forEach((el, i) => {
      if (!viejas.has(el.dataset.uid)) el.animate([{ transform: "translate(60vw, -20px) rotate(25deg)", opacity: 0 }, { opacity: 1 }], { duration: 420, delay: i * 30, easing: "cubic-bezier(.2,.8,.3,1)", composite: "add" });
    });
  }
  const turno = ev.find((e) => e.e === "turno");
  if (turno && v.fase === "jugando") {
    Sonido.turno();
    await banner(turno.seat === v.yo ? "¡TU TURNO!" : `turno de ${v.j[turno.seat].nombre}`, turno.seat === v.yo ? 1100 : 800);
  }
  if (ev.some((e) => e.e === "fin")) {
    await esperar(500);
    if (v.ganador === v.yo) Sonido.victoria(); else Sonido.derrota();
    render(v);
  }
}

// ---------- reglas que el cliente necesita para resaltar ----------
const pideObjetivo = (c) => [...(c.grito || []), ...(c.efectos || [])].find((e) => (e.objetivo || "").startsWith("elegido"));
function objetivosCarta(v, s, c) {
  const ef = pideObjetivo(c);
  if (!ef) return new Set();
  const refs = [];
  for (const k of [0, 1]) {
    if (!(ef.objetivo === "elegido_esbirro" || ef.objetivo === "elegido_aliado" || ef.tipo === "buff" || ef.tipo === "destruir")) refs.push({ r: "h" + k, s: k, h: true });
    for (const m of v.j[k].tablero) refs.push({ r: m.uid, s: k, h: false });
  }
  return new Set(refs.filter((x) => {
    if (ef.objetivo === "elegido_enemigo") return x.s !== s;
    if (ef.objetivo === "elegido_aliado") return x.s === s && !x.h;
    return true;
  }).map((x) => x.r));
}
function objetivosAtaque(v, s) {
  const ene = v.j[1 - s].tablero, prov = ene.filter((m) => m.provocar);
  return new Set(prov.length ? prov.map((m) => m.uid) : ["h" + (1 - s), ...ene.map((m) => m.uid)]);
}
const puedeAtacar = (m) => !m.noAtaca && m.ataque > 0 && !m.dormido && m.ataques < (m.doble ? 2 : 1);
// la carta de la mano con su coste real (ej. Tun Cool baja según la mesa)
const cartaMano = (c) => (DB[c.id] ? { ...DB[c.id], coste: c.coste ?? DB[c.id].coste } : null);
function jugable(v, c) {
  const p = v.j[v.yo];
  if (!c || c.coste > p.mana) return false;
  if (c.tipo === "esbirro" && p.tablero.length >= 7) return false;
  if (c.tipo === "mision" && p.mision) return false;
  if (c.tipo === "hechizo" && pideObjetivo(c) && !objetivosCarta(v, v.yo, c).size) return false;
  return true;
}

// ================= dibujar mesa =================
function heroeHTML(v, s) {
  const p = v.j[s];
  const h = HEROES[p.heroe];
  const desc = v.conectados && !v.conectados[s] && v.fase === "jugando";
  const mi = p.mision;
  return `<div class="heroe ${desc ? "desconectado" : ""}" data-ref="h${s}" data-seat="${s}" data-heroe="${esc(p.heroe || "")}" style="--fondo:${colorDe(h?.id || p.nombre)}">
    <span class="heroe-arte">${h ? artHTML(h.arte) : esc((p.nombre || "?")[0].toUpperCase())}</span>
    ${mi ? `<div class="mision-chip ${mi.completa ? "completa" : ""}" data-carta="${esc(mi.id)}" style="--p:${mi.completa ? 1 : Math.min(1, mi.progreso / mi.meta)}">
      <span class="mision-arte">${artHTML(DB[mi.id]?.arte || "🏆")}</span><b>${mi.completa ? "✔" : `${mi.progreso}/${mi.meta}`}</b></div>` : ""}
    <div class="stat hp ${p.vida < p.vidaMax ? "herido" : ""}">${p.vida}</div></div>`;
}
function poderHTML(v, s) {
  const p = v.j[s];
  if (!p.poder) return "";
  const mio = s === v.yo && v.turno === s && v.fase === "jugando";
  const listo = mio && !p.poderUsado && p.poder.coste <= p.mana && !(p.tablero.length >= 7 && (p.poder.efectos || []).every((e) => e.tipo === "invocar"));
  return `<button class="poder ${listo ? "listo" : ""} ${p.poderUsado ? "usado" : ""}" data-poder="${s}" ${s === v.yo ? 'id="poder"' : ""}>
    <span>${artHTML(p.poder.arte || "⚡")}</span><div class="stat mana">${p.poder.coste}</div></button>`;
}
function esbirroHTML(m, s, v) {
  const c = DB[m.id] || {};
  const mio = v.yo === s && v.turno === s && v.fase === "jugando";
  const cls = [m.provocar && "provocar", m.escudo && "escudo", m.dormido && !m.carga && "dormido", mio && puedeAtacar(m) && "puede"].filter(Boolean).join(" ");
  return `<div class="esbirro ${cls}" data-ref="${m.uid}" data-seat="${s}" data-carta="${esc(m.id)}" style="--fondo:${colorDe(c.arquetipo || c.id)}">
    <div class="arte">${artHTML(c.arte)}</div><span class="zz">z z</span>
    <div class="stat atk ${m.ataque > c.ataque ? "subido" : ""}">${m.ataque}</div>
    <div class="stat hp ${m.vida < m.vidaMax ? "herido" : m.vidaMax > c.vida ? "subido" : ""}">${m.vida}</div></div>`;
}

function render(v) {
  V = v;
  if (preview) preview.style.display = "none";
  cancelarApuntado(false);
  if (v.fase === "esperando") return renderEspera(v);
  const yo = yoDe(v), riv = 1 - yo, P = v.j[yo], R = v.j[riv];
  const miTurno = v.fase === "jugando" && v.turno === v.yo;
  const mano = (P.mano || []);
  const n = mano.length;
  const poderListo = miTurno && P.poder && !P.poderUsado && P.poder.coste <= P.mana && !(P.tablero.length >= 7 && (P.poder.efectos || []).every((e) => e.tipo === "invocar"));
  const hayJugadas = miTurno && !v.pendiente && (mano.some((c) => jugable(v, cartaMano(c))) || P.tablero.some(puedeAtacar) || poderListo);
  const cristales = (q) => `<div class="cristales"><b>${q.mana}/${q.manaMax}</b>${Array.from({ length: 10 }, (_, i) =>
    `<i class="cristal ${i < q.mana ? "lleno" : i < q.manaMax ? "vacio" : "bloqueado"}"></i>`).join("")}</div>`;
  app.innerHTML = `<div class="mesa">
    <div class="mano-rival">${Array.from({ length: R.manoN }, (_, i) => `<div class="dorso" style="--o:${i - (R.manoN - 1) / 2}"></div>`).join("")}</div>
    <div class="zona rival">
      <div class="placa"><div class="nombre">${esc(R.nombre)}</div><div class="mazo" title="cartas en el mazo">${R.mazo}</div>
        ${v.conectados && !v.conectados[riv] ? '<div class="aviso">desconectado</div>' : ""}</div>
      ${heroeHTML(v, riv)}${poderHTML(v, riv)}
      ${cristales(R)}
    </div>
    <div class="campo">
      <div class="tablero" data-seat="${riv}">${R.tablero.map((m) => esbirroHTML(m, riv, v)).join("")}</div>
      <div class="medio">${(v.globales || []).map((g) => `<span class="global" data-carta="${esc(g)}">${artHTML(DB[g]?.arte || "🌐")}</span>`).join("")}<div class="reloj"></div><div class="linea"><div class="cuerda"></div></div><div class="reloj turno-txt">${v.yo < 0 ? "mirando" : ""}</div></div>
      <div class="tablero" data-seat="${yo}" id="mi-tablero">${P.tablero.map((m) => esbirroHTML(m, yo, v)).join("")}</div>
    </div>
    <div class="zona yo">
      <div class="placa"><div class="nombre">${esc(P.nombre)}</div><div class="mazo" title="cartas en el mazo">${P.mazo}</div></div>
      ${heroeHTML(v, yo)}${poderHTML(v, yo)}
      ${cristales(P)}
    </div>
    <div class="mano" style="--n:${Math.max(1, n)};--n1:${Math.max(1, n - 1)}">${mano.map((c, i) => {
      const off = i - (n - 1) / 2;
      const card = cartaMano(c) || { nombre: "?", coste: 0 };
      return cartaHTML(card, { uid: c.uid, clase: miTurno && jugable(v, card) ? "jugable" : "" })
        .replace('class="carta', `style="--rot:${off * Math.min(4, 20 / n)}deg;--baja:${Math.abs(off) * Math.abs(off) * (n > 6 ? 1.2 : 2.2)}px" class="carta`);
    }).join("")}</div>
    ${v.yo >= 0 ? `<button class="fin-turno ${miTurno && !hayJugadas ? "listo" : ""} ${miTurno ? "" : "rival"}" id="fin" ${miTurno ? "" : "disabled"}>${miTurno ? "TERMINAR<br>TURNO" : "TURNO<br>RIVAL"}</button>` : ""}
    <div class="esquina"><button class="mini-btn" id="log" title="historial">📜</button><button class="mini-btn" id="mudo" title="sonido">${Sonido.mudo ? "🔇" : "🔊"}</button>
      ${v.yo >= 0 && v.fase === "jugando" ? '<button class="mini-btn" id="rendir" title="rendirse">🏳️</button>' : ""}</div>
  </div>`;
  $("#fin") && ($("#fin").onclick = () => { if (miTurno) { enviar({ t: "fin" }); $("#fin").disabled = true; } });
  const bp = $("#poder");
  if (bp) bp.onclick = () => {
    if (!bp.classList.contains("listo")) { if (P.poder) toast(`${P.poder.nombre}: ${P.poder.texto || ""}`, 1800); return; }
    const validos = pideObjetivo(P.poder) ? objetivosCarta(v, v.yo, P.poder) : new Set();
    if (validos.size) { apuntando = { tipo: "poder", origen: centro(bp), validos, toque: true }; marcar(validos); toast("elegí un objetivo", 900); return; }
    bp.classList.remove("listo"); Sonido.hechizo(); enviar({ t: "poder" });
  };
  $("#mudo").onclick = () => { Sonido.toggle(); $("#mudo").textContent = Sonido.mudo ? "🔇" : "🔊"; };
  $("#log").onclick = mostrarLog;
  $("#rendir") && ($("#rendir").onclick = () => confirmar("¿Rendirse?", () => enviar({ t: "rendirse" })));
  actualizarReloj();
  pendiente(v);
  if (v.fase === "fin") renderFinal(v);
}

// ---------- elecciones: descubrir (como Hearthstone) y a quién lanzar cada Tun ----------
let descubrirKey = null;
function pendiente(v) {
  const pe = v.fase === "jugando" ? v.pendiente : null;
  const mio = pe && pe.seat === v.yo;
  if (!(mio && pe.tipo === "descubrir")) { $("#descubrir")?.remove(); descubrirKey = null; }
  $("#instruccion")?.remove();
  if (!pe) return;
  if (!mio) { // el rival está eligiendo
    const d = document.createElement("div");
    d.id = "instruccion"; d.className = "instruccion rival";
    d.textContent = pe.tipo === "descubrir" ? `${v.j[pe.seat].nombre} está descubriendo una carta...` : `${v.j[pe.seat].nombre} está apuntando...`;
    app.append(d);
    return;
  }
  if (pe.tipo === "descubrir") return mostrarDescubrir(pe.opciones || []);
  // disparar: el Tun brilla y los enemigos se marcan; un toque elige
  const tir = refEl(pe.tirador);
  const validos = new Set(["h" + (1 - v.yo), ...v.j[1 - v.yo].tablero.map((m) => m.uid)]);
  if (tir) tir.classList.add("tirador");
  apuntando = { tipo: "disparo", origen: tir ? centro(tir) : centro(refEl("h" + v.yo)), validos, toque: true };
  marcar(validos);
  const d = document.createElement("div");
  d.id = "instruccion"; d.className = "instruccion";
  d.innerHTML = `🎯 Elegí a quién lanzar a <b>${esc(DB[V.j[v.yo].tablero.find((m) => m.uid === pe.tirador)?.id]?.nombre || "este Tun")}</b>${pe.quedan > 1 ? ` <span>(quedan ${pe.quedan})</span>` : ""}`;
  app.append(d);
}
function mostrarDescubrir(ops) {
  const key = ops.join(",");
  if (descubrirKey === key && $("#descubrir")) return;
  $("#descubrir")?.remove();
  descubrirKey = key;
  const o = document.createElement("div");
  o.id = "descubrir"; o.className = "descubrir";
  o.innerHTML = `<div class="desc-titulo">DESCUBRE UNA CARTA</div>
    <div class="desc-cartas">${ops.map((id, i) => `<div class="desc-op" data-i="${i}"><div class="desc-brillo"></div>${cartaHTML(DB[id] || {})}</div>`).join("")}</div>
    <button class="mini-btn desc-ver" title="ver la mesa">👁 ver mesa</button>`;
  document.body.append(o);
  Sonido.descubrir();
  o.animate([{ opacity: 0 }, { opacity: 1 }], 300);
  $$(".desc-op", o).forEach((el, i) => {
    el.animate([{ transform: "translateY(60px) scale(.2) rotateY(180deg)", opacity: 0 }, { transform: "translateY(-10px) scale(1.08) rotateY(0)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }],
      { duration: 650, delay: 120 + i * 140, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" });
    setTimeout(() => { const c = centro(el); particulas(c.x, c.y, "#ffd34f", 16, 80); }, 450 + i * 140);
    el.onclick = () => {
      if (o.dataset.listo) return;
      o.dataset.listo = 1;
      Sonido.carta();
      const c = centro(el), mano = centro($(".mano") || document.body);
      particulas(c.x, c.y, "#ffd34f", 30, 120);
      $$(".desc-op", o).forEach((x) => x !== el && x.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.7)" }], { duration: 300, fill: "forwards" }));
      el.animate([{ transform: "none" }, { transform: "scale(1.15)", offset: 0.3 }, { transform: `translate(${mano.x - c.x}px, ${mano.y - c.y}px) scale(.3)`, opacity: 0.2 }],
        { duration: 650, easing: "cubic-bezier(.5,0,.8,.6)", fill: "forwards" }).onfinish = () => o.remove();
      enviar({ t: "elegir", i });
    };
  });
  const ver = $(".desc-ver", o);
  ver.onpointerdown = () => o.classList.add("oculto");
  ver.onpointerup = ver.onpointerleave = () => o.classList.remove("oculto");
}

function renderEspera(v) {
  const link = location.href;
  if (v.yo < 0) {
    app.innerHTML = `<div class="espera"><div><h2>Partida llena</h2><p>Ya hay dos jugadores aquí.</p>
      <button class="boton" onclick="location.href='/'">Crear otra</button></div></div>`;
    return;
  }
  app.innerHTML = `<div class="espera"><div style="max-width:420px">
    <h2>Esperando rival<span class="puntos"></span></h2>
    <div>Mandale este link:</div>
    <div class="link-caja">${esc(link)}</div>
    <button class="boton" id="copiar">Copiar link</button>
    <button class="boton sec" id="wa">Mandar por WhatsApp</button></div></div>`;
  $("#copiar").onclick = async () => { try { await navigator.clipboard.writeText(link); toast("copiado"); } catch { toast("copialo a mano"); } };
  $("#wa").onclick = () => open("https://wa.me/?text=" + encodeURIComponent("te reto a puto cartas: " + link), "_blank");
}

function renderFinal(v) {
  const gane = v.ganador === v.yo, empate = v.ganador === "empate";
  const pedi = v.yo >= 0 && v.revancha?.[v.yo], rivalPidio = v.yo >= 0 && v.revancha?.[1 - v.yo];
  const m = document.createElement("div");
  m.className = "modal final";
  m.innerHTML = `<div class="modal-caja">
    <h1 class="${gane ? "gano" : "perdio"}">${empate ? "EMPATE" : v.yo < 0 ? `GANÓ ${esc(v.j[v.ganador].nombre)}` : gane ? "VICTORIA" : "DERROTA"}</h1>
    ${v.yo >= 0 ? `<button class="boton" id="rev" ${pedi ? "disabled" : ""}>${pedi ? "esperando al rival..." : rivalPidio ? "¡Aceptar revancha!" : "Revancha"}</button>` : ""}
    <button class="boton sec" onclick="location.href='/'">Salir</button></div>`;
  app.append(m);
  $("#rev") && ($("#rev").onclick = () => { enviar({ t: "revancha" }); $("#rev").disabled = true; $("#rev").textContent = "esperando al rival..."; });
  if (gane) for (let i = 0; i < 6; i++) setTimeout(() => particulas(innerWidth * Math.random(), innerHeight * 0.3, ["#ffd34f", "#4ade80", "#ff4d6d", "#60a5fa"][i % 4], 24, 120), i * 160);
}

function mostrarLog() {
  const d = document.createElement("div");
  d.className = "log";
  d.innerHTML = (V.log || []).slice().reverse().map((l) => `<div>${esc(l)}</div>`).join("") || "nada todavía";
  document.body.append(d);
  setTimeout(() => addEventListener("pointerdown", () => d.remove(), { once: true }), 0);
}

function confirmar(txt, si) {
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="modal-caja"><h2 style="font-family:var(--f-tit)">${esc(txt)}</h2>
    <button class="boton" id="si">Sí</button><button class="boton sec" id="no">No</button></div>`;
  document.body.append(m);
  $("#si", m).onclick = () => { m.remove(); si(); };
  $("#no", m).onclick = () => m.remove();
}

function actualizarReloj() {
  if (!V || V.fase !== "jugando") return;
  const resta = Math.max(0, (V.finTurno - (Date.now() + desfase)) / 1000);
  const cuerda = $(".cuerda"), reloj = $(".reloj");
  if (!cuerda) return;
  const quema = resta < 20;
  cuerda.style.transform = `scaleX(${quema ? resta / 20 : 1})`;
  cuerda.style.opacity = quema ? 1 : 0.25;
  reloj.textContent = quema ? Math.ceil(resta) + "s" : "";
  if (quema && V.turno === V.yo && Math.ceil(resta) <= 5 && resta > 0 && Math.abs(resta - Math.round(resta)) < 0.13) Sonido.tic();
}

// ================= interacción: arrastrar, apuntar, ampliar =================
const flecha = $("#flecha"), linea = $("#flecha-linea");
function dibujarFlecha(o, p) {
  flecha.style.display = "block";
  const cx = (o.x + p.x) / 2, cy = Math.min(o.y, p.y) - Math.abs(o.x - p.x) * 0.25 - 40;
  linea.setAttribute("d", `M${o.x},${o.y} Q${cx},${cy} ${p.x},${p.y}`);
}
function cancelarApuntado(redibujar = true) {
  flecha.style.display = "none";
  $$(".objetivo").forEach((e) => e.classList.remove("objetivo"));
  $$(".seleccionado").forEach((e) => e.classList.remove("seleccionado"));
  if (apuntando?.fantasma) apuntando.fantasma.remove();
  const habia = apuntando;
  apuntando = null;
  if (redibujar && habia && V) render(V);
}
function marcar(validos) { validos.forEach((r) => refEl(r)?.classList.add("objetivo")); }
const bajo = (x, y) => document.elementFromPoint(x, y)?.closest("[data-ref]")?.dataset.ref;

function zoom(idCarta, uid) {
  const enMano = uid && V?.j[V.yo]?.mano?.find((x) => x.uid === uid);
  const c = enMano ? cartaMano(enMano) : DB[idCarta];
  if (!c) return;
  const puede = uid && V && V.yo >= 0 && V.turno === V.yo && V.fase === "jugando" && jugable(V, c);
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="modal-caja">${cartaHTML(c, { clase: "grande" })}
    ${puede ? '<button class="boton" id="jugar" style="width:min(56vw,260px)">Jugar</button>' : ""}</div>`;
  document.body.append(m);
  m.onpointerdown = (e) => { if (e.target === m) m.remove(); };
  $("#jugar", m) && ($("#jugar", m).onclick = () => { m.remove(); intentarJugar(uid, null, centro(refEl("h" + V.yo))); });
}

function intentarJugar(uid, pos, origen, fantasma) {
  const c = DB[V.j[V.yo].mano.find((x) => x.uid === uid)?.id];
  if (!c) return;
  const validos = pideObjetivo(c) ? objetivosCarta(V, V.yo, c) : new Set();
  if (validos.size) {
    apuntando = { tipo: "carta", uid, pos, origen, validos, fantasma, toque: true };
    marcar(validos);
    dibujarFlecha(origen, origen);
    toast("elegí un objetivo", 900);
    return;
  }
  if (fantasma) fantasma.remove();
  Sonido.carta();
  $(`.mano [data-uid="${uid}"]`)?.style.setProperty("opacity", ".25");
  enviar({ t: "jugar", uid, pos });
}

function posicionEn(x) {
  const centros = $$("#mi-tablero .esbirro").map((e) => centro(e).x);
  return centros.filter((cx) => cx < x).length;
}

let gesto = null;
app.addEventListener("pointerdown", (e) => {
  if (!V || V.fase !== "jugando" || $(".modal")) return;
  const miTurno = V.turno === V.yo && V.yo >= 0;

  // si estamos apuntando con toque: este toque elige el objetivo
  if (apuntando?.toque) {
    const ref = e.target.closest("[data-ref]")?.dataset.ref;
    if (ref && apuntando.validos.has(ref)) return resolverApuntado(ref);
    return cancelarApuntado();
  }
  const cartaEl = e.target.closest(".mano .carta");
  const esbEl = e.target.closest(".esbirro, .heroe");
  gesto = { x: e.clientX, y: e.clientY, t: Date.now(), movio: false, cartaEl, esbEl, largo: null };
  // mantener presionado = ver carta en grande
  gesto.largo = setTimeout(() => {
    if (gesto && !gesto.movio && !apuntando) {
      const el = gesto.cartaEl || gesto.esbEl;
      if (el?.dataset.carta) { zoom(el.dataset.carta, null); gesto = null; }
    }
  }, 450);

  if (esbEl && miTurno && esbEl.dataset.seat == V.yo && esbEl.classList.contains("esbirro")) {
    const m = V.j[V.yo].tablero.find((x) => x.uid === esbEl.dataset.ref);
    if (m && puedeAtacar(m)) {
      const validos = objetivosAtaque(V, V.yo);
      apuntando = { tipo: "ataque", de: m.uid, origen: centro(esbEl), validos };
      esbEl.classList.add("seleccionado");
      marcar(validos);
    }
  }
});

addEventListener("pointermove", (e) => {
  if (!gesto && !apuntando) return;
  if (gesto && !gesto.movio && Math.hypot(e.clientX - gesto.x, e.clientY - gesto.y) > 9) {
    gesto.movio = true;
    clearTimeout(gesto.largo);
    // empezar a arrastrar una carta de la mano
    const el = gesto.cartaEl;
    if (el && el.classList.contains("jugable") && !apuntando) {
      const c = DB[el.dataset.carta];
      if (c.tipo !== "esbirro" && pideObjetivo(c)) {
        apuntando = { tipo: "carta", uid: el.dataset.uid, origen: centro(el), validos: objetivosCarta(V, V.yo, c) };
        el.style.transform = "translateY(-30px) scale(1.1)";
        marcar(apuntando.validos);
      } else {
        const f = el.cloneNode(true);
        f.classList.add("fantasma");
        f.removeAttribute("style");
        document.body.append(f);
        el.style.opacity = ".2";
        gesto.arrastre = { f, el, c };
        $("#mi-tablero").classList.add("zona-soltar");
        Sonido.carta();
      }
    }
  }
  if (gesto?.arrastre) {
    const { f } = gesto.arrastre, r = f.getBoundingClientRect();
    f.style.left = e.clientX - r.width / 2 + "px";
    f.style.top = e.clientY - r.height * 0.6 + "px";
  }
  if (apuntando && !apuntando.toque) {
    dibujarFlecha(apuntando.origen, { x: e.clientX, y: e.clientY });
    const ref = bajo(e.clientX, e.clientY);
    $$(".objetivo").forEach((x) => (x.style.transform = x.dataset.ref === ref ? "scale(1.08)" : ""));
  }
});

addEventListener("pointerup", (e) => {
  const g = gesto;
  gesto = null;
  if (g) clearTimeout(g.largo);
  $("#mi-tablero")?.classList.remove("zona-soltar");
  if (!V) return;

  // soltar una carta arrastrada
  if (g?.arrastre) {
    const { f, el, c } = g.arrastre;
    const manoTop = $(".mano").getBoundingClientRect().top;
    if (e.clientY < manoTop - 10) {
      const pos = c.tipo !== "esbirro" ? null : posicionEn(e.clientX);
      if (c.tipo === "esbirro" && pideObjetivo(c) && objetivosCarta(V, V.yo, c).size) {
        f.style.transition = "transform .15s"; f.style.transform = "scale(.7)";
        return intentarJugar(el.dataset.uid, pos, { x: e.clientX, y: e.clientY }, f);
      }
      f.remove();
      return intentarJugar(el.dataset.uid, pos);
    }
    // volver a la mano
    const r = el.getBoundingClientRect(), rf = f.getBoundingClientRect();
    f.animate([{ transform: "translate(0,0)" }, { transform: `translate(${r.left - rf.left}px, ${r.top - rf.top}px)` }], { duration: 180 }).onfinish = () => { f.remove(); el.style.opacity = ""; };
    return;
  }

  // apuntando con flecha (ataque o hechizo arrastrado)
  if (apuntando && !apuntando.toque) {
    const ref = bajo(e.clientX, e.clientY);
    if (ref && apuntando.validos.has(ref)) return resolverApuntado(ref);
    if (g && !g.movio) {
      // toque simple: queda seleccionado esperando el segundo toque
      apuntando.toque = true;
      dibujarFlecha(apuntando.origen, apuntando.origen);
      flecha.style.display = "none";
      return;
    }
    return cancelarApuntado();
  }

  // toque simple sobre una carta de la mano = verla grande (con botón jugar)
  if (g && !g.movio && g.cartaEl && Date.now() - g.t < 450) zoom(g.cartaEl.dataset.carta, g.cartaEl.dataset.uid);
});

// ---------- vista previa al pasar el mouse (PC) ----------
const conMouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
const preview = $("#preview");
function cartaDePoder(p, h) {
  return { id: "poder", nombre: p.nombre, tipo: "hechizo", coste: p.coste, arte: p.arte || "⚡", texto: p.texto || "", clase: h?.clase };
}
function mostrarPreview(el) {
  if (!V) return;
  let carta = null, extra = "";
  if (el.classList.contains("esbirro")) {
    carta = DB[el.dataset.carta];
    const m = V.j[+el.dataset.seat]?.tablero.find((x) => x.uid === el.dataset.ref);
    if (m && carta && (m.ataque !== carta.ataque || m.vida !== carta.vida)) extra = `ahora: ${m.ataque}/${m.vida}`;
  } else if (el.classList.contains("poder")) {
    const p = V.j[+el.dataset.poder];
    if (p?.poder) { carta = cartaDePoder(p.poder, HEROES[p.heroe]); extra = p.poderUsado ? "ya usado este turno" : "poder de héroe (1 vez por turno)"; }
  } else if (el.classList.contains("mision-chip")) {
    carta = DB[el.dataset.carta];
    const mi = V.j.map((p) => p.mision).find((x) => x?.id === el.dataset.carta);
    if (mi) extra = mi.completa ? "¡completada!" : `progreso: ${mi.progreso}/${mi.meta}`;
  } else if (el.classList.contains("global")) {
    carta = DB[el.dataset.carta]; extra = "activo por el resto de la partida";
  } else if (el.classList.contains("heroe")) {
    const p = V.j[+el.dataset.seat], h = HEROES[p?.heroe];
    if (h) { carta = { id: h.id, nombre: h.nombre, tipo: "esbirro", coste: "", ataque: "", vida: p.vida, arte: h.arte, texto: `Poder: ${h.poder?.nombre || "ninguno"}. ${h.poder?.texto || ""}`, clase: h.clase }; extra = p.nombre; }
  }
  if (!carta) return;
  preview.innerHTML = cartaHTML(carta) + (extra ? `<div class="ahora">${esc(extra)}</div>` : "");
  preview.style.display = "block";
  const r = el.getBoundingClientRect(), pw = 236, ph = preview.offsetHeight;
  const x = r.right + 18 + pw < innerWidth ? r.right + 18 : r.left - pw - 18;
  preview.style.left = Math.max(6, x) + "px";
  preview.style.top = Math.min(innerHeight - ph - 6, Math.max(6, r.top + r.height / 2 - ph / 2)) + "px";
}
if (conMouse) {
  app.addEventListener("pointerover", (e) => {
    const el = e.target.closest(".esbirro, .poder, .mision-chip, .global, .heroe");
    if (!el || apuntando || gesto?.movio) return;
    mostrarPreview(el);
  });
  app.addEventListener("pointerout", (e) => {
    const el = e.target.closest(".esbirro, .poder, .mision-chip, .global, .heroe");
    if (el && !el.contains(e.relatedTarget)) preview.style.display = "none";
  });
  addEventListener("pointerdown", () => (preview.style.display = "none"));
}

function resolverApuntado(ref) {
  const a = apuntando;
  apuntando = null;
  flecha.style.display = "none";
  $$(".objetivo").forEach((x) => { x.classList.remove("objetivo"); x.style.transform = ""; });
  if (a.fantasma) a.fantasma.remove();
  if (a.tipo === "ataque") enviar({ t: "atacar", de: a.de, a: ref });
  else if (a.tipo === "disparo") { Sonido.ataque(); $("#instruccion")?.remove(); enviar({ t: "elegir", a: ref }); }
  else if (a.tipo === "poder") { Sonido.hechizo(); enviar({ t: "poder", objetivo: ref }); }
  else { Sonido.carta(); $(`.mano [data-uid="${a.uid}"]`)?.style.setProperty("opacity", ".25"); enviar({ t: "jugar", uid: a.uid, pos: a.pos, objetivo: ref }); }
}
addEventListener("pointercancel", () => { gesto = null; cancelarApuntado(); });
