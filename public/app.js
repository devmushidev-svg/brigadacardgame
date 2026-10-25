// Cliente de Puto Cartas: lobby, mesa, arrastrar/apuntar, animaciones y sonido.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $("#app");
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let DB = {};

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
  const esH = c.tipo === "hechizo";
  return `<div class="carta ${esH ? "hechizo" : ""} ${clase}" ${uid ? `data-uid="${uid}"` : ""} data-carta="${esc(c.id)}">
    <div class="arte" style="--fondo:${colorDe(c.arquetipo || c.id)}">${artHTML(c.arte)}</div>
    <div class="titulo">${esc(c.nombre)}</div>
    <div class="texto">${esc(c.texto || "")}</div>
    ${c.arquetipo ? `<div class="arq">${esc(c.arquetipo)}</div>` : ""}
    <div class="stat mana">${c.coste}</div>
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
    const lista = await (await fetch("/api/cartas")).json();
    DB = Object.fromEntries(lista.map((c) => [c.id, c]));
  } catch { toast("no cargaron las cartas"); }
}

function pantallaLobby() {
  app.innerHTML = `<div class="lobby"><div class="lobby-caja">
    <h1 class="logo">PUTO<small>CARTAS</small></h1>
    <input id="nombre" maxlength="20" placeholder="tu nombre" value="${esc(localStorage.getItem("nombre") || "")}">
    <button class="boton" id="crear">Crear partida</button>
    <button class="boton sec" id="ver">Ver cartas</button>
    <div class="ayuda">Creás la partida y le pasás el link a tu rival.</div>
  </div></div>`;
  $("#crear").onclick = async () => {
    const n = $("#nombre").value.trim();
    if (!n) { $("#nombre").focus(); toast("poné tu nombre"); return; }
    localStorage.setItem("nombre", n);
    const { id } = await (await fetch("/api/crear", { method: "POST" })).json();
    location.href = "/p/" + id;
  };
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
    ws.send(JSON.stringify({ t: "hola", token: localStorage.getItem("tok_" + PID), nombre: localStorage.getItem("nombre") }));
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
    switch (e.e) {
      case "hechizo":
        Sonido.hechizo();
        if (e.seat !== yo) await mostrarCarta(e.carta, 1000); else await esperar(150);
        break;
      case "invoca":
        nuevos.add(e.uid);
        if (e.seat !== yo && !DB[e.carta]?.token) await mostrarCarta(e.carta, 850);
        break;
      case "ataque": {
        const de = refEl(e.de), a = refEl(e.a);
        if (de && a) {
          Sonido.ataque();
          const p1 = centro(de), p2 = centro(a);
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
        numero(el, "-" + e.n, "dano");
        temblar(el, e.a[0] === "h" && e.n >= 5);
        if (e.a[0] === "h" && e.n >= 5) temblar($(".mesa"), true);
        if (!ev.some((x) => x.e === "ataque")) Sonido.golpe(e.n);
        await esperar(90);
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
      case "destruido": { const el = refEl(e.a); if (el) { const c = centro(el); particulas(c.x, c.y, "#b44cff", 20, 70); } break; }
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
    }
  }
}

// ---------- lo que pasa después de dibujar ----------
async function despues(ev, v, antes, nuevos) {
  const yo = yoDe(v);
  for (const uid of nuevos) {
    const el = refEl(uid);
    if (!el) continue;
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
function jugable(v, c) {
  const p = v.j[v.yo];
  if (!c || c.coste > p.mana) return false;
  if (c.tipo !== "hechizo" && p.tablero.length >= 7) return false;
  if (c.tipo === "hechizo" && pideObjetivo(c) && !objetivosCarta(v, v.yo, c).size) return false;
  return true;
}

// ================= dibujar mesa =================
function heroeHTML(v, s) {
  const p = v.j[s];
  const desc = v.conectados && !v.conectados[s] && v.fase === "jugando";
  return `<div class="heroe ${desc ? "desconectado" : ""}" data-ref="h${s}" data-seat="${s}" style="background:${colorDe(p.nombre)}">
    ${esc((p.nombre || "?")[0].toUpperCase())}
    <div class="stat hp ${p.vida < p.vidaMax ? "herido" : ""}">${p.vida}</div></div>`;
}
function esbirroHTML(m, s, v) {
  const c = DB[m.id] || {};
  const mio = v.yo === s && v.turno === s && v.fase === "jugando";
  const cls = [m.provocar && "provocar", m.escudo && "escudo", m.dormido && !m.carga && "dormido", mio && puedeAtacar(m) && "puede"].filter(Boolean).join(" ");
  return `<div class="esbirro ${cls}" data-ref="${m.uid}" data-seat="${s}" data-carta="${esc(m.id)}" style="--fondo:${colorDe(c.arquetipo || c.id)}">
    <div class="arte">${artHTML(c.arte)}</div>
    <div class="stat atk ${m.ataque > c.ataque ? "subido" : ""}">${m.ataque}</div>
    <div class="stat hp ${m.vida < m.vidaMax ? "herido" : m.vidaMax > c.vida ? "subido" : ""}">${m.vida}</div></div>`;
}

function render(v) {
  V = v;
  cancelarApuntado(false);
  if (v.fase === "esperando") return renderEspera(v);
  const yo = yoDe(v), riv = 1 - yo, P = v.j[yo], R = v.j[riv];
  const miTurno = v.fase === "jugando" && v.turno === v.yo;
  const mano = (P.mano || []);
  const n = mano.length;
  const hayJugadas = miTurno && (mano.some((c) => jugable(v, DB[c.id])) || P.tablero.some(puedeAtacar));
  app.innerHTML = `<div class="mesa">
    <div class="barra">${heroeHTML(v, riv)}
      <div class="info"><div class="nombre">${esc(R.nombre)}</div>
        <div class="chips"><span class="chip">💧 ${R.mana}/${R.manaMax}</span><span class="chip">🂠 ${R.mazo}</span>
        ${v.conectados && !v.conectados[riv] ? '<span class="chip">desconectado</span>' : ""}</div></div>
      <div class="dorsos">${"<div class='dorso'></div>".repeat(R.manoN)}</div></div>
    <div class="tablero" data-seat="${riv}">${R.tablero.map((m) => esbirroHTML(m, riv, v)).join("")}</div>
    <div class="medio"><div class="reloj"></div><div class="linea"><div class="cuerda"></div></div><div class="reloj turno-txt">${miTurno ? "tu turno" : v.yo < 0 ? "mirando" : ""}</div></div>
    <div class="tablero" data-seat="${yo}" id="mi-tablero">${P.tablero.map((m) => esbirroHTML(m, yo, v)).join("")}</div>
    <div class="barra yo">${heroeHTML(v, yo)}
      <div class="info"><div class="nombre">${esc(P.nombre)}</div>
        <div class="cristales">${Array.from({ length: P.manaMax }, (_, i) => `<div class="cristal ${i < P.mana ? "lleno" : ""}"></div>`).join("")}</div>
        <div class="chips"><span class="chip">💧 ${P.mana}/${P.manaMax}</span><span class="chip">🂠 ${P.mazo}</span></div></div>
      ${v.yo >= 0 ? `<button class="fin-turno ${miTurno && !hayJugadas ? "listo" : ""}" id="fin" ${miTurno ? "" : "disabled"}>${miTurno ? "Terminar turno" : "Turno rival"}</button>` : ""}</div>
    <div class="mano">${mano.map((c, i) => {
      const off = i - (n - 1) / 2;
      const card = DB[c.id] || { nombre: "?", coste: 0 };
      return cartaHTML(card, { uid: c.uid, clase: miTurno && jugable(v, card) ? "jugable" : "" })
        .replace('class="carta', `style="transform: translateY(${Math.abs(off) * Math.abs(off) * 2.2}px) rotate(${off * 4}deg)" class="carta`);
    }).join("")}</div>
    <div class="esquina"><button class="mini-btn" id="log">📜</button><button class="mini-btn" id="mudo">${Sonido.mudo ? "🔇" : "🔊"}</button>
      ${v.yo >= 0 && v.fase === "jugando" ? '<button class="mini-btn" id="rendir">🏳️</button>' : ""}</div>
  </div>`;
  $("#fin") && ($("#fin").onclick = () => { if (miTurno) { enviar({ t: "fin" }); $("#fin").disabled = true; } });
  $("#mudo").onclick = () => { Sonido.toggle(); $("#mudo").textContent = Sonido.mudo ? "🔇" : "🔊"; };
  $("#log").onclick = mostrarLog;
  $("#rendir") && ($("#rendir").onclick = () => confirmar("¿Rendirse?", () => enviar({ t: "rendirse" })));
  actualizarReloj();
  if (v.fase === "fin") renderFinal(v);
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
  const c = DB[idCarta];
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
      if (c.tipo === "hechizo" && pideObjetivo(c)) {
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
      const pos = c.tipo === "hechizo" ? null : posicionEn(e.clientX);
      if (c.tipo !== "hechizo" && pideObjetivo(c) && objetivosCarta(V, V.yo, c).size) {
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

function resolverApuntado(ref) {
  const a = apuntando;
  apuntando = null;
  flecha.style.display = "none";
  $$(".objetivo").forEach((x) => { x.classList.remove("objetivo"); x.style.transform = ""; });
  if (a.fantasma) a.fantasma.remove();
  if (a.tipo === "ataque") enviar({ t: "atacar", de: a.de, a: ref });
  else { Sonido.carta(); $(`.mano [data-uid="${a.uid}"]`)?.style.setProperty("opacity", ".25"); enviar({ t: "jugar", uid: a.uid, pos: a.pos, objetivo: ref }); }
}
addEventListener("pointercancel", () => { gesto = null; cancelarApuntado(); });
