// Motor del juego: reglas tipo Hearthstone (nivel de poder absurdo a propósito).
// Todo el estado es JSON plano para poder guardarlo en el Durable Object.
// El servidor es la única autoridad: el cliente solo manda intenciones.
// Las mecánicas están documentadas en MECANICAS.md.

export const CONFIG = {
  VIDA_HEROE: 50,
  MAX_MANA: 10,
  MAX_TABLERO: 7,
  MAX_MANO: 10,
  TAM_MAZO: 30,
  CARTAS_DE_CLASE: 22, // cuántas cartas del mazo salen de la clase del héroe
  COPIAS_MAX: 2,
  TIEMPO_TURNO: 75, // segundos
  TIEMPO_MULLIGAN: 40, // segundos para elegir qué cartas cambiar al empezar
};

// ---------- azar reproducible (se guarda en el estado) ----------
function azar(estado) {
  let t = (estado.rng = (estado.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const elegir = (estado, lista) => lista[Math.floor(azar(estado) * lista.length)];
function barajar(estado, lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar(estado) * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// ---------- utilidades ----------
const otro = (s) => 1 - s;
const nuevoUid = (estado) => "m" + estado.sigId++;
const copia = (x) => JSON.parse(JSON.stringify(x));
const efectosQuePiden = (c) => [...(c.grito || []), ...(c.efectos || [])];
export const necesitaObjetivo = (carta) => efectosQuePiden(carta).some((e) => (e.objetivo || "").startsWith("elegido"));
// coste real de una carta en la mano (ej. Tun Cool: 1 menos por cada Tun en la mesa, de los dos lados)
export function costeDe(estado, s, c) {
  if (!c) return 99;
  let coste = c.coste;
  const d = c.descuento;
  if (d?.por === "tribu_en_mesa") {
    const lados = d.lados === "propio" ? [s] : [0, 1];
    for (const k of lados) coste -= estado.j[k].tablero.filter((m) => m.tribu === d.tribu && m.vida > 0).length;
  }
  if (d?.por === "tribu_muertos") coste -= estado.muertosTribu?.[d.tribu] || 0;
  return Math.max(0, coste);
}
// si un esbirro entra en la mesa: hay lugar, o se fusiona con uno igual (Cruit Sangre)
export function cabeEsbirro(estado, s, c) {
  const p = estado.j[s];
  return p.tablero.length < CONFIG.MAX_TABLERO || (!!c?.fusionar && p.tablero.some((x) => x.id === c.id && x.vida > 0));
}
// coste de una carta concreta de la mano: el de la carta menos lo que le rebajaron (ej. Tun Astrónomo)
export function costeCarta(estado, s, c, db) {
  return c ? Math.max(0, costeDe(estado, s, db[c.id]) - (c.rebaja || 0)) : 99;
}
// cartas que pueden salir al azar o en un descubrir
const pozo = (db, filtro) => Object.values(db).filter((c) => !c.token && c.tipo === "esbirro" && cumpleFiltro(c, filtro));
const maxCopias = (c) => (c.rareza === "legendaria" ? 1 : CONFIG.COPIAS_MAX);

// mazo armado por el jugador: héroe válido, 20 cartas de su clase o neutrales, 2 copias (1 si es legendaria)
export function validarMazo(db, heroes, mazo) {
  if (!mazo || typeof mazo !== "object" || !Array.isArray(mazo.cartas)) return null;
  const h = heroes[mazo.heroe];
  if (!h || mazo.cartas.length !== CONFIG.TAM_MAZO) return null;
  const copias = {};
  for (const id of mazo.cartas) {
    const c = db[id];
    if (!c || c.token || c.tipo === "mision" || (c.clase && c.clase !== h.id)) return null;
    copias[id] = (copias[id] || 0) + 1;
    if (copias[id] > maxCopias(c)) return null;
  }
  return { heroe: h.id, cartas: mazo.cartas.slice() };
}

function armarMazo(estado, db, clase, elegido, fijo = false) {
  if (elegido) return fijo ? elegido.slice() : barajar(estado, elegido.slice());
  const mazo = [];
  const copias = {};
  const meter = (c) => {
    if ((copias[c.id] || 0) >= maxCopias(c)) return false;
    copias[c.id] = (copias[c.id] || 0) + 1;
    mazo.push(c.id);
    return true;
  };
  const deClase = Object.values(db).filter((c) => !c.token && c.clase && c.clase === clase && c.tipo !== "mision");
  const neutrales = Object.values(db).filter((c) => !c.token && !c.clase);
  let intentos = 0;
  const topeClase = neutrales.length ? CONFIG.CARTAS_DE_CLASE : CONFIG.TAM_MAZO;
  while (deClase.length && mazo.length < topeClase && intentos++ < 500) meter(elegir(estado, deClase));
  intentos = 0;
  while (neutrales.length && mazo.length < CONFIG.TAM_MAZO && intentos++ < 1000) meter(elegir(estado, neutrales));
  // si todavía hay pocas cartas diseñadas, se repiten las no legendarias para completar el mazo
  const noLeg = (l) => l.filter((c) => c.rareza !== "legendaria");
  const repetibles = noLeg(deClase).length ? noLeg(deClase) : noLeg(neutrales);
  while (repetibles.length && mazo.length < CONFIG.TAM_MAZO) mazo.push(elegir(estado, repetibles).id);
  return barajar(estado, mazo);
}

// ---------- crear partida ----------
export function crearPartida(db, semilla) {
  return {
    fase: "esperando",
    turno: 0,
    numTurno: 0,
    ganador: null,
    sigId: 1,
    rng: semilla >>> 0,
    finTurno: 0,
    log: [],
    globales: [], // efectos "por el resto de la partida" (ej. Panamá)
    j: [0, 1].map(() => ({
      nombre: null,
      heroe: null,
      poder: null,
      poderUsado: false,
      mision: null,
      vida: CONFIG.VIDA_HEROE,
      vidaMax: CONFIG.VIDA_HEROE,
      mana: 0,
      manaMax: 0,
      mazo: [],
      mano: [],
      tablero: [],
      fatiga: 0,
    })),
  };
}

// mulligan: como Hearthstone, antes del primer turno cada uno puede cambiar cartas de su mano inicial
export function empezar(estado, db, ahora, heroes = {}, mulligan = true) {
  const ev = [];
  estado.fase = "jugando";
  const lista = Object.values(heroes);
  for (const p of estado.j) {
    const h = heroes[p.heroe] || (lista.length ? elegir(estado, lista) : null); // sin mazo elegido: héroe al azar
    p.heroe = h ? h.id : null;
    p.poder = h?.poder ? copia(h.poder) : null;
    // sin mazo armado se usa el mazo meta del héroe (si tiene), si no uno al azar
    p.mazo = armarMazo(estado, db, p.heroe, p.mazoElegido?.heroe === p.heroe ? p.mazoElegido.cartas : h?.mazoMeta || null, !!p.mazoElegido?.fijo);
  }
  const primero = estado.tutorial ? 0 : azar(estado) < 0.5 ? 0 : 1;
  estado.turno = primero;
  // la misión de la clase siempre empieza en la mano (en el tutorial no, para que sea corto)
  for (const s of estado.tutorial ? [] : [primero, otro(primero)]) {
    const mision = Object.values(db).find((c) => c.tipo === "mision" && c.clase && c.clase === estado.j[s].heroe);
    if (mision) darCarta(estado, s, mision.id, ev);
  }
  for (let k = 0; k < 3; k++) robar(estado, primero, ev, db);
  for (let k = 0; k < 4; k++) robar(estado, otro(primero), ev, db);
  registrar(estado, `${estado.j[primero].nombre} empieza`);
  if (!mulligan) {
    comenzarJuego(estado, db, ahora, ev);
    return ev;
  }
  estado.fase = "mulligan";
  estado.mulligan = [false, false]; // quién ya eligió
  estado.finTurno = ahora + CONFIG.TIEMPO_MULLIGAN * 1000;
  return ev;
}

// ---------- tutorial: partida guiada contra el bot, con mazos en orden fijo ----------
// El jugador (asiento 0) empieza con Tun; el bot tiene un mazo flojo de Cruit y poca vida.
export const TUTORIAL = {
  jugador: { heroe: "tun", mazo: ["tun_tung_sahur", "tun_brawl", "platano", "comida", "tunita", "tun_puto", "novia_tun", "tun_amor",
    "choza_monos", "comida", "tun_brawl", "tun_tung_sahur", "platano", "tunita", "tun_puto"] },
  rival: { heroe: "cruit", vida: 12, mazo: ["lechero", "tun_brawl", "cruit_tostadora", "elliot", "mauro_sosa", "tun_brawl", "lechero",
    "elliot", "mauro_sosa", "cruit_tostadora", "tun_brawl", "lechero", "elliot", "mauro_sosa", "cruit_tostadora"] },
};
export function empezarTutorial(estado, db, ahora, heroes) {
  estado.tutorial = true;
  for (const [s, t] of [[0, TUTORIAL.jugador], [1, TUTORIAL.rival]]) {
    estado.j[s].heroe = t.heroe;
    estado.j[s].mazoElegido = { heroe: t.heroe, cartas: t.mazo, fijo: true };
  }
  const ev = empezar(estado, db, ahora, heroes, false);
  estado.j[1].vida = TUTORIAL.rival.vida;
  return ev;
}

// después del mulligan: el segundo recibe La Moneda y arranca el primer turno
function comenzarJuego(estado, db, ahora, ev) {
  estado.fase = "jugando";
  estado.mulligan = null;
  const primero = estado.turno;
  if (db.moneda) darCarta(estado, otro(primero), "moneda", ev);
  inicioTurno(estado, primero, ev, db, ahora);
}

// cambia las cartas elegidas por otras del mazo (la misión no se cambia) y las devuelve al mazo
function hacerMulligan(estado, s, cambiar, db, ev) {
  const p = estado.j[s];
  const devueltas = [];
  for (const c of p.mano) {
    if (!cambiar.includes(c.uid) || db[c.id]?.tipo === "mision" || !p.mazo.length) continue;
    devueltas.push(c.id);
    c.id = p.mazo.shift();
    c.uid = "c" + estado.sigId++;
  }
  p.mazo.push(...devueltas);
  barajar(estado, p.mazo);
  estado.mulligan[s] = true;
  if (devueltas.length) ev.push({ e: "mulligan", seat: s, n: devueltas.length });
  registrar(estado, `${p.nombre} cambio ${devueltas.length} carta${devueltas.length === 1 ? "" : "s"}`);
}

function registrar(estado, texto) {
  estado.log.push(texto);
  if (estado.log.length > 30) estado.log.shift();
}

// filtro: { genero: "mujer" }, { etiqueta: ... } o { tribu: "tun" } (sobre la carta de la base)
function cumpleFiltro(c, f) {
  if (!c) return false;
  if (f?.etiqueta && !(c.etiquetas || []).includes(f.etiqueta)) return false;
  if (f?.genero && c.genero !== f.genero) return false;
  if (f?.tribu && c.tribu !== f.tribu) return false;
  return true;
}

function darCarta(estado, s, id, ev) {
  const p = estado.j[s];
  if (p.mano.length >= CONFIG.MAX_MANO) {
    ev.push({ e: "quemada", seat: s, carta: id });
    return false;
  }
  p.mano.push({ uid: "c" + estado.sigId++, id });
  ev.push({ e: "roba", seat: s });
  return true;
}

function robar(estado, s, ev, db) {
  const p = estado.j[s];
  if (!p.mazo.length) {
    p.fatiga++;
    ev.push({ e: "fatiga", seat: s, n: p.fatiga });
    danarHeroe(estado, s, p.fatiga, ev);
    return;
  }
  const id = p.mazo.shift();
  // cartas que se lanzan solas al robarlas (ej. la Caca de Estreñido Cruit): no van a la mano y se roba otra
  if (db[id]?.al_robarse) {
    ev.push({ e: "se_lanza", seat: s, carta: id });
    aplicarEfectos(estado, s, db[id].al_robarse, null, ev, db, null);
    if (estado.j[s].vida > 0) robar(estado, s, ev, db);
    return;
  }
  darCarta(estado, s, id, ev);
  // efectos globales que se disparan al robar (ej. Panamá)
  for (const g of estado.globales) {
    if (g.disparador === "al_robar") aplicarEfectos(estado, s, g.efectos, null, ev, db, null, { quien: s });
  }
}

function inicioTurno(estado, s, ev, db, ahora) {
  const p = estado.j[s];
  estado.turno = s;
  estado.numTurno++;
  p.manaMax = Math.min(CONFIG.MAX_MANA, p.manaMax + 1);
  p.mana = p.manaMax;
  p.poderUsado = false;
  for (const m of p.tablero) {
    m.dormido = false;
    m.soloEsbirros = false;
    m.ataques = 0;
  }
  ev.push({ e: "turno", seat: s });
  robar(estado, s, ev, db);
  estado.finTurno = ahora + CONFIG.TIEMPO_TURNO * 1000;
  resolverMuertes(estado, ev, db);
}

function finTurno(estado, s, ev, db) {
  // efectos "al final de tu turno"
  for (const m of [...estado.j[s].tablero]) {
    const c = db[m.id];
    if (c?.fin_turno && m.vida > 0) {
      ev.push({ e: "dispara", uid: m.uid, por: "fin_turno" });
      aplicarEfectos(estado, s, c.fin_turno, null, ev, db, m.uid);
      resolverMuertes(estado, ev, db);
      if (estado.fase !== "jugando") return;
    }
  }
}

// ---------- referencias a objetivos ----------
// "h0"/"h1" = héroes, "mX" = esbirros
function buscar(estado, ref) {
  if (ref === "h0" || ref === "h1") return { tipo: "heroe", seat: +ref[1], obj: estado.j[+ref[1]] };
  for (const s of [0, 1]) {
    const m = estado.j[s].tablero.find((x) => x.uid === ref);
    if (m) return { tipo: "esbirro", seat: s, obj: m };
  }
  return null;
}

function danarHeroe(estado, s, n, ev) {
  if (n <= 0) return;
  estado.j[s].vida -= n;
  ev.push({ e: "dano", a: "h" + s, n });
}

// extra: { fx, de } para que el cliente sepa cómo dibujar el golpe (ej. una piedra desde Tun Puto)
function danar(estado, ref, n, ev, extra = {}) {
  const t = buscar(estado, ref);
  if (!t || n <= 0) return;
  if (extra.fx) ev.push({ e: "fx", fx: extra.fx, de: extra.de || null, a: ref });
  if (t.tipo === "heroe") return danarHeroe(estado, t.seat, n, ev);
  if (t.obj.escudo) {
    t.obj.escudo = false;
    ev.push({ e: "escudo_roto", a: ref });
    return;
  }
  t.obj.vida -= n;
  ev.push({ e: "dano", a: ref, n });
  if (t.obj.alRecibirDano) (estado.golpes ||= []).push({ uid: ref, id: t.obj.id, seat: t.seat });
}

function curar(estado, ref, n, ev) {
  const t = buscar(estado, ref);
  if (!t) return;
  const antes = t.obj.vida;
  t.obj.vida = Math.min(t.obj.vidaMax, t.obj.vida + n);
  if (t.obj.vida > antes) ev.push({ e: "cura", a: ref, n: t.obj.vida - antes });
}

// choque entre dos personajes (ataque normal o esbirro "disparado")
function chocar(estado, de, a, ev) {
  const atk = buscar(estado, de), def = buscar(estado, a);
  if (!atk || !def) return;
  ev.push({ e: "ataque", de, a });
  const devuelve = def.tipo === "esbirro" ? def.obj.ataque : 0;
  danar(estado, a, atk.obj.ataque, ev);
  if (devuelve) danar(estado, de, devuelve, ev);
}

// un esbirro nuevo a partir de su carta (sin mejoras de tribu)
function esbirroDe(estado, c) {
  const claves = new Set(c.claves || []);
  return {
    uid: nuevoUid(estado),
    id: c.id,
    tribu: c.tribu || null,
    ataque: c.ataque,
    vida: c.vida,
    vidaMax: c.vida,
    provocar: claves.has("provocar"),
    carga: claves.has("carga"),
    escudo: claves.has("escudo"),
    noAtaca: claves.has("no_ataca"),
    doble: claves.has("doble"),
    dormido: !claves.has("carga") && !claves.has("acometida"),
    soloEsbirros: claves.has("acometida") && !claves.has("carga"), // acometida: el turno que entra solo ataca esbirros
    ataques: 0,
    alRecibirDano: !!c.al_recibir_dano,
    ...(c.etiquetas ? { etiquetas: c.etiquetas } : {}),
  };
}

function invocar(estado, s, id, ev, db, pos) {
  const p = estado.j[s];
  const c = db[id];
  // "fusionar": si ya tenés uno igual, se suma a ese en vez de ocupar otro lugar (Cruit Sangre)
  const igual = c?.fusionar && p.tablero.find((x) => x.id === id && x.vida > 0);
  if (igual) {
    igual.ataque += c.ataque; igual.vida += c.vida; igual.vidaMax += c.vida;
    igual.apilado = (igual.apilado || 1) + 1;
    ev.push({ e: "fusiona", seat: s, uid: igual.uid, carta: id, ataque: c.ataque, vida: c.vida, n: igual.apilado });
    avanzarMision(estado, s, "invocar_tribu", igual.tribu, ev, db);
    return igual;
  }
  if (!c || p.tablero.length >= CONFIG.MAX_TABLERO) return null;
  const m = esbirroDe(estado, c);
  // "tus Tun tienen +1 de ataque por el resto de la partida"
  const mej = c.tribu && p.mejoras?.[c.tribu];
  if (mej) { m.ataque += mej.ataque || 0; m.vida += mej.vida || 0; m.vidaMax += mej.vida || 0; }
  const i = pos == null ? p.tablero.length : Math.max(0, Math.min(pos, p.tablero.length));
  p.tablero.splice(i, 0, m);
  ev.push({ e: "invoca", seat: s, uid: m.uid, carta: id, pos: i });
  avanzarMision(estado, s, "invocar_tribu", m.tribu, ev, db);
  return m;
}

// ---------- misiones ----------
function avanzarMision(estado, s, tipo, tribu, ev, db) {
  const mi = estado.j[s].mision;
  if (!mi || mi.completa || mi.contar !== tipo || (mi.tribu && mi.tribu !== tribu)) return;
  mi.progreso++;
  ev.push({ e: "mision_progreso", seat: s, progreso: mi.progreso, meta: mi.meta });
  if (mi.progreso >= mi.meta) {
    mi.completa = true;
    registrar(estado, `${estado.j[s].nombre} completo ${mi.nombre}`);
    ev.push({ e: "mision_completa", seat: s, carta: mi.id });
    aplicarEfectos(estado, s, mi.recompensa, null, ev, db, null);
  }
}

// ---------- efectos ----------
// objetivo: elegido | elegido_enemigo | elegido_esbirro | elegido_aliado | heroe_enemigo | heroe_propio |
//           esbirro_enemigo_azar | esbirros_enemigos | todos_esbirros | aliado_azar | aliados | todos_enemigos |
//           enemigo_azar | yo
// filtro: { tribu } limita los esbirros afectados
function objetivos(estado, s, efecto, elegido, fuente) {
  // "excluir": { "etiqueta": "programa" } deja afuera a esos esbirros (a Cruit Excel no se le puede dar Leche)
  const tribuOk = (m) => (!efecto.filtro?.tribu || m.tribu === efecto.filtro.tribu) && !(efecto.excluir?.etiqueta && (m.etiquetas || []).includes(efecto.excluir.etiqueta));
  const yo = estado.j[s].tablero.filter((m) => m.uid !== fuente && tribuOk(m)).map((m) => m.uid);
  const ene = estado.j[otro(s)].tablero.filter(tribuOk).map((m) => m.uid);
  switch (efecto.objetivo) {
    case "elegido":
    case "elegido_enemigo":
    case "elegido_esbirro":
    case "elegido_aliado":
      return elegido ? [elegido] : [];
    case "heroe_enemigo": return ["h" + otro(s)];
    case "heroe_propio": return ["h" + s];
    case "esbirro_enemigo_azar": return ene.length ? [elegir(estado, ene)] : [];
    case "esbirros_enemigos": return ene;
    case "todos_esbirros": return [...yo, ...ene];
    case "otros_esbirros": return [...yo, ...ene].filter((u) => u !== fuente);
    case "aliado_azar": return yo.length ? [elegir(estado, yo)] : [];
    case "aliados": return yo;
    case "todos_enemigos": return ["h" + otro(s), ...ene];
    case "enemigo_azar": return [elegir(estado, ["h" + otro(s), ...ene])];
    case "enemigo_menos_vida": { // el personaje enemigo (héroe o esbirro) con menos vida; si empatan, al azar
      const cand = [{ r: "h" + otro(s), v: estado.j[otro(s)].vida }, ...estado.j[otro(s)].tablero.filter((m) => m.vida > 0 && tribuOk(m)).map((m) => ({ r: m.uid, v: m.vida }))];
      const min = Math.min(...cand.map((x) => x.v));
      return [elegir(estado, cand.filter((x) => x.v === min)).r];
    }
    case "aliado_herido_azar": { // tu héroe o uno de tus esbirros (incluido él mismo) que esté herido
      const p = estado.j[s];
      const heridos = [...(p.vida < p.vidaMax ? ["h" + s] : []), ...p.tablero.filter((m) => m.vida > 0 && m.vida < m.vidaMax && tribuOk(m)).map((m) => m.uid)];
      return heridos.length ? [elegir(estado, heridos)] : [];
    }
    case "yo": return fuente ? [fuente] : [];
    default: return [];
  }
}

// cantidad real de un efecto: "bonus" la sube (ej. Tunita: +1 por cada Tun que jugaste esta partida)
// cuántas veces vale un "por cada": cartas de una tribu o con una etiqueta jugadas esta partida
export function contarPorCada(estado, s, pc) {
  if (!pc) return 1;
  if (pc.por === "tribu_jugados") return estado.j[s].jugadosTribu?.[pc.tribu] || 0;
  if (pc.por === "etiqueta_jugados") return estado.j[s].jugadosEtiqueta?.[pc.etiqueta] || 0;
  return 1;
}
export function cantidadDe(estado, s, ef) {
  let n = ef.cantidad ?? 1;
  if (ef.bonus?.por === "tribu_jugados") n += estado.j[s].jugadosTribu?.[ef.bonus.tribu] || 0;
  return n;
}

function aplicarEfectos(estado, s, efectos, elegido, ev, db, fuente, ctx = {}) {
  for (const ef of efectos || []) {
    const n = cantidadDe(estado, s, ef);
    if (ef.tipo === "robar") { for (let k = 0; k < n; k++) robar(estado, s, ev, db); continue; }
    if (ef.tipo === "mana") { const p = estado.j[s]; p.mana = Math.min(CONFIG.MAX_MANA, p.mana + n); ev.push({ e: "mana", seat: s, n }); continue; }
    if (ef.tipo === "robar_mano") {
      // roba de la mano rival cartas que cumplan el filtro (etiqueta o tribu)
      const rival = estado.j[1 - s], yo = estado.j[s];
      for (let k = 0; k < n; k++) {
        const ok = rival.mano.filter((c) => cumpleFiltro(db[c.id], ef.filtro));
        if (!ok.length || yo.mano.length >= CONFIG.MAX_MANO) break;
        const c = elegir(estado, ok);
        rival.mano.splice(rival.mano.indexOf(c), 1);
        yo.mano.push(c);
        ev.push({ e: "robo", de: 1 - s, a: s, uid: c.uid, carta: c.id });
      }
      continue;
    }
    if (ef.tipo === "descubrir") {
      // como Hearthstone: 3 opciones distintas, el jugador se queda con una
      // "todas": true también ofrece fichas y hechizos (Escuela Alumnos: tareas universitarias)
      const base = ef.todas ? Object.values(db).filter((c) => c.tipo !== "mision" && cumpleFiltro(c, ef.filtro)) : pozo(db, ef.filtro);
      const tandas = [];
      for (let k = 0; k < n; k++) {
        const lista = base.map((c) => c.id), ops = [];
        while (ops.length < 3 && lista.length) ops.push(lista.splice(Math.floor(azar(estado) * lista.length), 1)[0]);
        if (ops.length) tandas.push(ops);
      }
      if (!tandas.length) continue;
      if (estado.pendiente) { for (const ops of tandas) darCarta(estado, s, elegir(estado, ops), ev); continue; } // ya hay otra elección abierta
      estado.pendiente = { seat: s, tipo: "descubrir", opciones: tandas.shift(), siguientes: tandas };
      ev.push({ e: "elegir", seat: s, tipo: "descubrir" });
      continue;
    }
    if (ef.tipo === "repetir_jugados") {
      // Coco Supremo: repite los gritos y últimos alientos de las cartas del filtro que jugaste esta partida
      const ids = (estado.j[s].jugados || []).filter((id) => db[id] && cumpleFiltro(db[id], ef.filtro) &&
        ![...(db[id].grito || []), ...(db[id].aliento || [])].some((x) => x.tipo === "repetir_jugados"));
      // para el combo: los que crecen por cada cosa (Cruit Excel) van al final, y los que pegan según su ataque (Cruit Baño) al último
      const orden = (id) => { const efs = [...(db[id].grito || []), ...(db[id].aliento || [])]; return efs.some((x) => x.tipo === "repartir") ? 2 : efs.some((x) => x.porCada) ? 1 : 0; };
      ids.sort((a, b) => orden(a) - orden(b));
      // "contar_leches": además, una Leche sobre sí mismo por cada Leche que usaste en tus esbirros (antes de Excel y Baño)
      const leche = ef.contar_leches && db[ef.contar_leches];
      const f0 = fuente && buscar(estado, fuente) ? fuente : null;
      if (leche && f0) {
        for (let k = 0; k < Math.min(30, estado.j[s].lechesAliados || 0) && estado.fase === "jugando"; k++) {
          ev.push({ e: "repite", seat: s, carta: leche.id });
          aplicarEfectos(estado, s, leche.efectos, f0, ev, db, null, ctx);
        }
      }
      for (const id of ids.slice(0, 30)) {
        if (estado.fase !== "jugando") break;
        const c = db[id];
        ev.push({ e: "repite", seat: s, carta: id });
        // como Shudderwock: los efectos salen de Coco Supremo, así que "gana +3/+3" (Cruit Excel) lo buffea a él
        const f = fuente && buscar(estado, fuente) ? fuente : null;
        if (c.grito) aplicarEfectos(estado, s, c.grito, null, ev, db, f, ctx);
        if (c.aliento) aplicarEfectos(estado, s, c.aliento, null, ev, db, f, ctx);
        resolverMuertes(estado, ev, db);
      }
      continue;
    }
    if (ef.tipo === "barajar") {
      // mete copias de una carta en el mazo (del rival con lado "enemigo"), en lugares al azar
      const lado = ef.lado === "enemigo" ? otro(s) : s, mazo = estado.j[lado].mazo;
      for (let k = 0; k < n; k++) mazo.splice(Math.floor(azar(estado) * (mazo.length + 1)), 0, ef.carta);
      ev.push({ e: "baraja", seat: lado, carta: ef.carta, n });
      continue;
    }
    if (ef.tipo === "grito_extra") {
      // Cruit Rage: el próximo grito de batalla de un esbirro del filtro que juegues se activa N veces
      estado.j[s].gritoExtra = { tribu: ef.filtro?.tribu || null, veces: n };
      ev.push({ e: "global", seat: s });
      continue;
    }
    if (ef.tipo === "rebajar") {
      // una carta de tu mano (del filtro) al azar cuesta N menos (Tun Astrónomo)
      const ok = estado.j[s].mano.filter((c) => db[c.id] && cumpleFiltro(db[c.id], ef.filtro) && costeCarta(estado, s, c, db) > 0);
      if (!ok.length) continue;
      const c = elegir(estado, ok);
      c.rebaja = (c.rebaja || 0) + n;
      ev.push({ e: "rebaja", seat: s, uid: c.uid, n });
      continue;
    }
    if (ef.tipo === "repartir") {
      // daño repartido al azar de a 1 punto entre los enemigos vivos; "cantidad": "ataque" usa el ataque de quien lo lanza (Cruit Baño)
      const total = ef.cantidad === "ataque" ? buscar(estado, fuente)?.obj.ataque || 0 : n;
      const r = otro(s);
      for (let k = 0; k < total && estado.j[r].vida > 0; k++) {
        const vivos = ["h" + r, ...estado.j[r].tablero.filter((m) => m.vida > 0).map((m) => m.uid)];
        danar(estado, elegir(estado, vivos), 1, ev, { fx: ef.fx, de: fuente });
      }
      continue;
    }
    if (ef.tipo === "robar_vida") {
      // daño que se suma a la vida de tu héroe; cada Cruit Vampiro en tu mesa suma +1 (aumenta_robo_vida)
      const extra = estado.j[s].tablero.filter((m) => m.vida > 0).reduce((t, m) => t + (db[m.id]?.aumenta_robo_vida || 0), 0);
      for (const ref of objetivos(estado, s, ef, elegido, fuente)) {
        const t = buscar(estado, ref);
        if (!t) continue;
        const antes = t.tipo === "heroe" ? t.obj.vida : t.obj.vida, escudo = t.tipo === "esbirro" && t.obj.escudo;
        ev.push({ e: "fx", fx: "sangre", de: ref, a: "h" + s });
        const veces = ef.porApilado ? buscar(estado, fuente)?.obj.apilado || 1 : 1; // Cruit Sangre fusionada roba por cada una
        danar(estado, ref, n * veces + extra, ev);
        const quitado = escudo ? 0 : Math.max(0, antes - t.obj.vida);
        if (quitado) {
          // robar vida SUMA: puede pasar de 30 (sube la vida máxima)
          const h = estado.j[s];
          h.vida += quitado; h.vidaMax = Math.max(h.vidaMax, h.vida);
          ev.push({ e: "cura", a: "h" + s, n: quitado });
        }
      }
      continue;
    }
    if (ef.tipo === "moneda") {
      // Chance: tira una moneda; cara o cruz aplican efectos distintos
      const cara = azar(estado) < 0.5;
      ev.push({ e: "moneda", seat: s, resultado: cara ? "cara" : "cruz", de: fuente });
      aplicarEfectos(estado, s, cara ? ef.cara : ef.cruz, elegido, ev, db, fuente, ctx);
      continue;
    }
    if (ef.tipo === "pelea") {
      // como Pelea de Hearthstone: todos los esbirros hacen parkour y solo uno al azar sobrevive
      const todos = [0, 1].flatMap((k) => estado.j[k].tablero).filter((m) => m.vida > 0);
      if (todos.length > 1) {
        const sobrevive = elegir(estado, todos);
        ev.push({ e: "pelea", sobrevive: sobrevive.uid });
        for (const m of todos) if (m !== sobrevive) { m.vida = 0; ev.push({ e: "destruido", a: m.uid }); }
      }
      continue;
    }
    if (ef.tipo === "activar") {
      // Leche: si el esbirro es de la tribu del filtro (Cruit), repite su grito y su último aliento.
      // Un esbirro que ya se está activando no se vuelve a activar (si no, dos Cruit Vaca se activarían sin fin)
      const activos = (estado._activando ||= []);
      if (fuente) activos.push(fuente);
      for (const ref of objetivos(estado, s, ef, elegido, fuente)) {
        const t = buscar(estado, ref);
        if (!t || t.tipo !== "esbirro" || (ef.filtro?.tribu && t.obj.tribu !== ef.filtro.tribu) || activos.includes(ref)) continue;
        const c = db[t.obj.id];
        if (!c?.grito && !c?.aliento) continue;
        activos.push(ref);
        ev.push({ e: "dispara", uid: ref, por: "leche" });
        if (c.grito) aplicarEfectos(estado, t.seat, c.grito, null, ev, db, ref);
        if (c.aliento) aplicarEfectos(estado, t.seat, c.aliento, null, ev, db, ref);
        activos.splice(activos.lastIndexOf(ref), 1);
      }
      if (fuente) activos.splice(activos.lastIndexOf(fuente), 1);
      if (!activos.length) delete estado._activando;
      continue;
    }
    if (ef.tipo === "transformar") {
      // convierte esbirros en otra carta (ej. Porque Me Monean: todos los del rival en Tun 1/1)
      const c = db[ef.carta];
      for (const ref of objetivos(estado, s, ef, elegido, fuente)) {
        const t = buscar(estado, ref);
        if (!c || !t || t.tipo !== "esbirro") continue;
        const lista = estado.j[t.seat].tablero, i = lista.indexOf(t.obj);
        const nuevo = { ...esbirroDe(estado, c), dormido: t.obj.dormido };
        lista[i] = nuevo;
        ev.push({ e: "transforma", de: ref, uid: nuevo.uid, carta: c.id, seat: t.seat, pos: i });
      }
      continue;
    }
    if (ef.tipo === "invocar_por_muertos") {
      // Funeral de Tun: un zombie por cada Tun muerto en la partida; cada uno que no cabe
      // le da +1 de ataque o +1 de vida (al azar) a uno de tus Tun al azar
      const total = estado.muertosTribu?.[ef.tribu] || 0, base = db[ef.carta];
      for (let k = 0; k < total && base; k++) {
        if (invocar(estado, s, ef.carta, ev, db)) continue;
        const mios = estado.j[s].tablero.filter((m) => m.tribu === ef.tribu && m.vida > 0);
        if (!mios.length) break;
        const m = elegir(estado, mios), atk = azar(estado) < 0.5;
        if (atk) m.ataque += 1; else { m.vida += 1; m.vidaMax += 1; }
        ev.push({ e: "buff", a: m.uid, ataque: atk ? 1 : 0, vida: atk ? 0 : 1 });
      }
      continue;
    }
    if (ef.tipo === "mejora_tribu") {
      // por el resto de la partida: los de esa tribu (en mesa, en mano y los que vengan) ganan stats
      const p = estado.j[s], mej = ((p.mejoras ||= {})[ef.tribu] ||= { ataque: 0, vida: 0 });
      mej.ataque += ef.ataque || 0; mej.vida += ef.vida || 0;
      for (const m of p.tablero) if (m.tribu === ef.tribu && m.vida > 0) {
        m.ataque += ef.ataque || 0; m.vida += ef.vida || 0; m.vidaMax += ef.vida || 0;
        ev.push({ e: "buff", a: m.uid, ataque: ef.ataque || 0, vida: ef.vida || 0 });
      }
      ev.push({ e: "mejora", seat: s, tribu: ef.tribu, ataque: mej.ataque, vida: mej.vida });
      continue;
    }
    if (ef.tipo === "atraer_ataques") {
      // tus otros esbirros (del filtro) atacan a esta carta, uno por uno
      for (const m of [...estado.j[s].tablero]) {
        const f = fuente && buscar(estado, fuente);
        if (!f || f.obj.vida <= 0) break;
        if (m.uid === fuente || m.vida <= 0 || m.ataque <= 0 || (ef.filtro?.tribu && m.tribu !== ef.filtro.tribu)) continue;
        chocar(estado, m.uid, fuente, ev);
      }
      continue;
    }
    if (ef.tipo === "dar_azar") {
      // N cartas distintas al azar de las que cumplen el filtro (ej. Unislop: 3 tareas universitarias)
      const lista = Object.values(db).filter((c) => cumpleFiltro(c, ef.filtro)).map((c) => c.id);
      for (let k = 0; k < n && lista.length; k++) darCarta(estado, s, lista.splice(Math.floor(azar(estado) * lista.length), 1)[0], ev);
      continue;
    }
    if (ef.tipo === "dar_carta") { for (let k = 0; k < n; k++) darCarta(estado, s, ef.carta, ev); continue; }
    if (ef.tipo === "devorar") {
      // destruye a tus otros esbirros (de la tribu del filtro) y gana stats por cada uno
      const comidos = estado.j[s].tablero.filter((m) => m.uid !== fuente && m.vida > 0 && (!ef.filtro?.tribu || m.tribu === ef.filtro.tribu));
      for (const m of comidos) { m.vida = 0; ev.push({ e: "destruido", a: m.uid, por: fuente, fx: ef.fx || null }); }
      const f = fuente && buscar(estado, fuente);
      if (f && comidos.length) {
        const a = (ef.ataque || 0) * comidos.length, v = (ef.vida || 0) * comidos.length;
        f.obj.ataque += a; f.obj.vida += v; f.obj.vidaMax += v;
        ev.push({ e: "buff", a: fuente, ataque: a, vida: v });
      }
      continue;
    }
    if (ef.tipo === "global") {
      estado.globales.push({ disparador: ef.disparador, tribu: ef.tribu || null, efectos: ef.efectos, origen: ef.origen || null, seat: s });
      ev.push({ e: "global", seat: s });
      continue;
    }
    if (ef.tipo === "invocar") {
      const lado = ef.lado === "enemigo" ? otro(s) : ef.lado === "quien_roba" && ctx.quien != null ? ctx.quien : s;
      const nuevos = [];
      const opciones = ef.azar ? pozo(db, ef.azar) : null;
      for (let k = 0; k < n; k++) {
        const id = opciones ? opciones.length && elegir(estado, opciones).id : ef.carta;
        const m = id && invocar(estado, lado, id, ev, db);
        if (m) nuevos.push(m.uid);
      }
      // "disparar": "elegir" = el jugador elige a quién se lanza cada uno; true = enemigo al azar
      if (ef.disparar === "elegir" && nuevos.length) {
        if (estado.pendiente?.tipo === "disparar" && estado.pendiente.seat === lado) estado.pendiente.cola.push(...nuevos);
        else if (!estado.pendiente) { estado.pendiente = { seat: lado, tipo: "disparar", cola: nuevos }; ev.push({ e: "elegir", seat: lado, tipo: "disparar" }); }
      } else if (ef.disparar) {
        for (const uid of nuevos) {
          if (estado.fase !== "jugando" || !buscar(estado, uid)) continue;
          const ene = ["h" + otro(lado), ...estado.j[otro(lado)].tablero.map((m) => m.uid)];
          chocar(estado, uid, elegir(estado, ene), ev);
          resolverMuertes(estado, ev, db);
        }
      }
      continue;
    }
    const refs = objetivos(estado, s, ef, elegido, fuente);
    const fxGrupo = ef.fx === "vomito"; // el vómito es uno solo que salpica a todos
    if (fxGrupo && refs.length) ev.push({ e: "fx", fx: ef.fx, de: fuente, seat: s, a: refs });
    for (const ref of refs) {
      const t = buscar(estado, ref);
      if (!t) continue;
      if (ef.tipo === "dano") danar(estado, ref, n, ev, { fx: fxGrupo ? null : ef.fx, de: fuente });
      else if (ef.tipo === "curar") { if (ef.fx) ev.push({ e: "fx", fx: ef.fx, de: fuente, a: ref }); curar(estado, ref, n, ev); }
      else if (ef.tipo === "destruir" && t.tipo === "esbirro") { t.obj.vida = 0; ev.push({ e: "destruido", a: ref }); }
      else if (ef.tipo === "buff" && t.tipo === "esbirro") {
        const k = contarPorCada(estado, s, ef.porCada); // ej. Cruit Excel: +3/+3 por cada tarea
        if (!k && ef.porCada) continue;
        t.obj.ataque += (ef.ataque || 0) * k;
        t.obj.vida += (ef.vida || 0) * k;
        t.obj.vidaMax += (ef.vida || 0) * k;
        if (ef.provocar) t.obj.provocar = true;
        if (ef.escudo) t.obj.escudo = true;
        if (ef.carga) { t.obj.carga = true; t.obj.dormido = false; }
        ev.push({ e: "buff", a: ref, ataque: (ef.ataque || 0) * k, vida: (ef.vida || 0) * k });
      }
    }
  }
}

function resolverMuertes(estado, ev, db) {
  for (let vuelta = 0; vuelta < 40; vuelta++) {
    // "cada vez que este esbirro recibe daño" (se activa aunque muera por ese golpe)
    const golpes = estado.golpes || [];
    estado.golpes = [];
    for (const g of golpes) {
      const c = db[g.id];
      if (!c?.al_recibir_dano || estado.fase !== "jugando") continue;
      ev.push({ e: "dispara", uid: g.uid, por: "dano" });
      aplicarEfectos(estado, g.seat, c.al_recibir_dano, null, ev, db, g.uid);
    }
    const muertos = [];
    for (const s of [0, 1]) {
      const p = estado.j[s];
      for (const m of p.tablero) if (m.vida <= 0) muertos.push({ s, m });
      p.tablero = p.tablero.filter((m) => m.vida > 0);
    }
    if (!muertos.length) { if (!estado.golpes.length) break; continue; }
    for (const { s, m } of muertos) {
      ev.push({ e: "muere", uid: m.uid, seat: s });
      if (m.tribu) (estado.muertosTribu ||= {})[m.tribu] = (estado.muertosTribu[m.tribu] || 0) + 1;
      const c = db[m.id];
      if (c && c.aliento) aplicarEfectos(estado, s, c.aliento, null, ev, db, null);
    }
    // "cada vez que muere un <tribu>": se activa en los esbirros vivos de los dos lados
    for (const { s, m } of muertos) {
      if (!m.tribu) continue;
      // efectos por el resto de la partida: "cada vez que muere uno de tus <tribu>" (Tun Iguana)
      for (const g of estado.globales) {
        if (g.disparador === "muere_tribu" && g.seat === s && g.tribu === m.tribu && estado.fase === "jugando") aplicarEfectos(estado, s, g.efectos, null, ev, db, null);
      }
      for (const s2 of [0, 1]) {
        for (const v of [...estado.j[s2].tablero]) {
          const cm = db[v.id]?.cuando_muere;
          if (v.vida > 0 && cm && cm.tribu === m.tribu) {
            ev.push({ e: "dispara", uid: v.uid, por: "muere" });
            aplicarEfectos(estado, s2, cm.efectos, null, ev, db, v.uid);
          }
        }
      }
    }
  }
  estado.golpes = [];
  const muerto0 = estado.j[0].vida <= 0, muerto1 = estado.j[1].vida <= 0;
  if ((muerto0 || muerto1) && estado.fase === "jugando") {
    estado.fase = "fin";
    estado.ganador = muerto0 && muerto1 ? "empate" : muerto0 ? 1 : 0;
    ev.push({ e: "fin", ganador: estado.ganador });
    registrar(estado, estado.ganador === "empate" ? "empate" : `gana ${estado.j[estado.ganador].nombre}`);
  }
}

// ---------- validación de objetivos elegidos ----------
export function objetivoValido(estado, s, carta, ref) {
  const ef = efectosQuePiden(carta).find((e) => (e.objetivo || "").startsWith("elegido"));
  if (!ef) return true;
  const t = buscar(estado, ref);
  if (!t) return false;
  if (ef.filtro?.tribu && (t.tipo !== "esbirro" || t.obj.tribu !== ef.filtro.tribu)) return false;
  if (ef.excluir?.etiqueta && t.tipo === "esbirro" && (t.obj.etiquetas || []).includes(ef.excluir.etiqueta)) return false;
  if (ef.objetivo === "elegido_enemigo") return t.seat !== s;
  if (ef.objetivo === "elegido_aliado") return t.seat === s && t.tipo === "esbirro";
  if (ef.objetivo === "elegido_esbirro") return t.tipo === "esbirro";
  if (ef.tipo === "buff" || ef.tipo === "destruir") return t.tipo === "esbirro";
  return true;
}

export function hayObjetivos(estado, s, carta) {
  const refs = ["h0", "h1", ...estado.j[0].tablero.map((m) => m.uid), ...estado.j[1].tablero.map((m) => m.uid)];
  return refs.some((r) => objetivoValido(estado, s, carta, r));
}

export function puedeAtacar(m) {
  return !m.noAtaca && m.ataque > 0 && !m.dormido && m.ataques < (m.doble ? 2 : 1);
}

export function objetivosAtaque(estado, s, atacante = null) {
  const ene = estado.j[otro(s)].tablero;
  const prov = ene.filter((m) => m.provocar);
  if (prov.length) return prov.map((m) => m.uid);
  return [...(atacante?.soloEsbirros ? [] : ["h" + otro(s)]), ...ene.map((m) => m.uid)];
}

export function puedeUsarPoder(estado, s) {
  const p = estado.j[s];
  if (!p.poder || p.poderUsado || p.poder.coste > p.mana) return false;
  if (necesitaObjetivo(p.poder) && !hayObjetivos(estado, s, p.poder)) return false;
  // poderes que solo invocan necesitan espacio en la mesa
  if ((p.poder.efectos || []).every((e) => e.tipo === "invocar" && e.lado !== "enemigo") && p.tablero.length >= CONFIG.MAX_TABLERO) return false;
  return true;
}

// ---------- elecciones pendientes (descubrir, disparar eligiendo) ----------
export function opcionesPendiente(estado) {
  const pe = estado.pendiente;
  if (!pe) return [];
  if (pe.tipo === "descubrir") return pe.opciones.map((_, i) => i);
  return ["h" + otro(pe.seat), ...estado.j[otro(pe.seat)].tablero.map((m) => m.uid)];
}
function resolverPendiente(estado, eleccion, ev, db) {
  const pe = estado.pendiente;
  if (pe.tipo === "descubrir") {
    estado.pendiente = null;
    const id = pe.opciones[eleccion];
    if (darCarta(estado, pe.seat, id, ev)) ev.push({ e: "descubierta", seat: pe.seat });
    if (pe.siguientes?.length) { // "descubre dos": se abre la siguiente elección
      estado.pendiente = { seat: pe.seat, tipo: "descubrir", opciones: pe.siguientes.shift(), siguientes: pe.siguientes };
      ev.push({ e: "elegir", seat: pe.seat, tipo: "descubrir" });
    }
    return;
  }
  const uid = pe.cola.shift();
  if (buscar(estado, uid)) { chocar(estado, uid, eleccion, ev); resolverMuertes(estado, ev, db); }
  // los que murieron en el camino ya no disparan
  pe.cola = pe.cola.filter((u) => buscar(estado, u));
  if (!pe.cola.length || estado.fase !== "jugando") estado.pendiente = null;
}
function resolverAlAzar(estado, ev, db) {
  for (let k = 0; k < 20 && estado.pendiente && estado.fase === "jugando"; k++) resolverPendiente(estado, elegir(estado, opcionesPendiente(estado)), ev, db);
  estado.pendiente = null;
}

// ---------- acciones ----------
export function aplicar(estado, s, accion, db, ahora) {
  const ev = [];
  if (estado.fase === "mulligan") {
    if (accion.t !== "mulligan") return { error: "primero elegí qué cartas cambiar" };
    if (estado.mulligan[s]) return { error: "ya elegiste" };
    hacerMulligan(estado, s, Array.isArray(accion.cambiar) ? accion.cambiar : [], db, ev);
    if (estado.mulligan[0] && estado.mulligan[1]) comenzarJuego(estado, db, ahora, ev);
    return { ev };
  }
  if (estado.fase !== "jugando") return { error: "la partida no esta en juego" };
  if (accion.t === "rendirse") {
    estado.j[s].vida = 0;
    registrar(estado, `${estado.j[s].nombre} se rindio`);
    resolverMuertes(estado, ev, db);
    return { ev };
  }
  if (estado.turno !== s) return { error: "no es tu turno" };
  const p = estado.j[s];

  if (accion.t === "elegir") {
    const pe = estado.pendiente;
    if (!pe || pe.seat !== s) return { error: "no hay nada que elegir" };
    const ok = opcionesPendiente(estado);
    const valor = pe.tipo === "descubrir" ? +accion.i : accion.a;
    if (!ok.includes(valor)) return { error: "eleccion invalida" };
    resolverPendiente(estado, valor, ev, db);
    resolverMuertes(estado, ev, db);
    return { ev };
  }
  if (estado.pendiente) {
    if (accion.t !== "fin") return { error: estado.pendiente.tipo === "descubrir" ? "primero elegi una carta" : "primero elegi a quien disparar" };
    resolverAlAzar(estado, ev, db);
    if (estado.fase !== "jugando") return { ev };
  }

  if (accion.t === "fin") {
    registrar(estado, `${p.nombre} termino su turno`);
    finTurno(estado, s, ev, db);
    if (estado.fase === "jugando") inicioTurno(estado, otro(s), ev, db, ahora);
    return { ev };
  }

  if (accion.t === "poder") {
    if (!p.poder) return { error: "tu heroe no tiene poder" };
    if (p.poderUsado) return { error: "ya usaste tu poder este turno" };
    if (p.poder.coste > p.mana) return { error: "no te alcanza el mana" };
    if (!puedeUsarPoder(estado, s)) return { error: "no se puede usar ahora" };
    if (necesitaObjetivo(p.poder) && (!accion.objetivo || !objetivoValido(estado, s, p.poder, accion.objetivo))) return { error: "objetivo invalido" };
    p.mana -= p.poder.coste;
    p.poderUsado = true;
    registrar(estado, `${p.nombre} uso ${p.poder.nombre}`);
    ev.push({ e: "poder", seat: s, objetivo: accion.objetivo || null });
    aplicarEfectos(estado, s, p.poder.efectos, accion.objetivo, ev, db, null);
    resolverMuertes(estado, ev, db);
    return { ev };
  }

  if (accion.t === "jugar") {
    const i = p.mano.findIndex((c) => c.uid === accion.uid);
    if (i < 0) return { error: "esa carta no esta en tu mano" };
    const carta = db[p.mano[i].id];
    if (!carta) return { error: "carta desconocida" };
    const coste = costeCarta(estado, s, p.mano[i], db);
    if (coste > p.mana) return { error: "no te alcanza el mana" };
    if (carta.tipo === "esbirro" && !cabeEsbirro(estado, s, carta)) return { error: "tablero lleno" };
    if (carta.tipo === "mision" && p.mision) return { error: "ya tenes una mision activa" };
    const pide = necesitaObjetivo(carta);
    if (pide && hayObjetivos(estado, s, carta)) {
      if (!accion.objetivo || !objetivoValido(estado, s, carta, accion.objetivo)) return { error: "objetivo invalido" };
    } else if (carta.tipo === "hechizo" && pide) {
      return { error: "no hay objetivos para este hechizo" };
    }
    p.mana -= coste;
    p.mano.splice(i, 1);
    for (const et of carta.etiquetas || []) (p.jugadosEtiqueta ||= {})[et] = (p.jugadosEtiqueta[et] || 0) + 1;
    (p.jugados ||= []).push(carta.id); // historial de cartas jugadas (Coco Supremo)
    registrar(estado, `${p.nombre} jugo ${carta.nombre}`);
    if (carta.tipo === "mision") {
      p.mision = { id: carta.id, nombre: carta.nombre, ...copia(carta.mision), progreso: 0, completa: false };
      ev.push({ e: "mision", seat: s, carta: carta.id });
    } else if (carta.tipo === "hechizo") {
      ev.push({ e: "hechizo", seat: s, carta: carta.id, objetivo: accion.objetivo || null });
      // Unislop: por el resto de la partida tus Tareas se lanzan dos veces (una vez más por cada efecto así)
      const veces = (carta.etiquetas || []).includes("tarea") ? 1 + estado.globales.filter((g) => g.disparador === "tareas_dobles" && g.seat === s).length : 1;
      for (let k = 0; k < veces && estado.fase === "jugando"; k++) {
        if (k) ev.push({ e: "repite", seat: s, carta: carta.id });
        aplicarEfectos(estado, s, carta.efectos, accion.objetivo, ev, db, null);
        resolverMuertes(estado, ev, db);
      }
      // Leches usadas en tus esbirros (las cuenta Coco Supremo)
      if (carta.id === "leche" && p.tablero.some((m) => m.uid === accion.objetivo)) p.lechesAliados = (p.lechesAliados || 0) + 1;
    } else {
      const m = invocar(estado, s, carta.id, ev, db, accion.pos);
      if (m && carta.grito) {
        // Cruit Rage: este grito se activa varias veces
        const extra = p.gritoExtra && (!p.gritoExtra.tribu || p.gritoExtra.tribu === carta.tribu) ? p.gritoExtra : null;
        if (extra) delete p.gritoExtra;
        for (let k = 0; k < (extra ? extra.veces : 1) && estado.fase === "jugando" && buscar(estado, m.uid); k++) {
          ev.push(k ? { e: "dispara", uid: m.uid, por: "rage" } : { e: "grito", uid: m.uid, objetivo: accion.objetivo || null });
          aplicarEfectos(estado, s, carta.grito, accion.objetivo, ev, db, m.uid);
          if (extra) resolverMuertes(estado, ev, db);
        }
      }
      if (carta.tribu) (p.jugadosTribu ||= {})[carta.tribu] = (p.jugadosTribu[carta.tribu] || 0) + 1;
      avanzarMision(estado, s, "jugar_tribu", carta.tribu || null, ev, db);
    }
    resolverMuertes(estado, ev, db);
    return { ev };
  }

  if (accion.t === "atacar") {
    const m = p.tablero.find((x) => x.uid === accion.de);
    if (!m) return { error: "ese esbirro no es tuyo" };
    if (!puedeAtacar(m)) return { error: m.dormido ? "acaba de entrar, espera un turno" : "no puede atacar" };
    if (!objetivosAtaque(estado, s, m).includes(accion.a)) return { error: m.soloEsbirros && accion.a[0] === "h" ? "con acometida solo puede atacar esbirros este turno" : "tenes que atacar a los de provocar" };
    m.ataques++;
    // "cada vez que ataca" (Tun Astrónomo)
    const alAtacar = db[m.id]?.al_atacar;
    if (alAtacar) {
      ev.push({ e: "dispara", uid: m.uid, por: "ataque" });
      aplicarEfectos(estado, s, alAtacar, null, ev, db, m.uid);
    }
    // "cuando uno de tus <tribu> ataca": se buffea antes del golpe (ej. Tun Amor)
    for (const v of [...p.tablero]) {
      const ca = db[v.id]?.cuando_ataca_aliado;
      if (!ca || v.vida <= 0 || (ca.tribu && m.tribu !== ca.tribu)) continue;
      ev.push({ e: "dispara", uid: v.uid, por: "ataque" });
      m.ataque += ca.ataque || 0; m.vida += ca.vida || 0; m.vidaMax += ca.vida || 0;
      ev.push({ e: "buff", a: m.uid, ataque: ca.ataque || 0, vida: ca.vida || 0 });
    }
    chocar(estado, m.uid, accion.a, ev);
    resolverMuertes(estado, ev, db);
    return { ev };
  }
  return { error: "accion desconocida" };
}

// Fin de turno por tiempo
export function tiempoAgotado(estado, db, ahora) {
  if (estado.fase === "mulligan" && ahora >= estado.finTurno) { // el que no eligió se queda con su mano
    const ev = [];
    for (const s of [0, 1]) if (!estado.mulligan[s]) hacerMulligan(estado, s, [], db, ev);
    comenzarJuego(estado, db, ahora, ev);
    return ev;
  }
  if (estado.fase !== "jugando" || ahora < estado.finTurno) return null;
  const s = estado.turno;
  registrar(estado, `a ${estado.j[s].nombre} se le acabo el tiempo`);
  const ev = [];
  if (estado.pendiente) resolverAlAzar(estado, ev, db);
  if (estado.fase === "jugando") finTurno(estado, s, ev, db);
  if (estado.fase === "jugando") inicioTurno(estado, otro(s), ev, db, ahora);
  return ev;
}

// ---------- lo que ve cada jugador ----------
export function vista(estado, yo, db0 = {}) {
  return {
    fase: estado.fase,
    turno: estado.turno,
    numTurno: estado.numTurno,
    ganador: estado.ganador,
    finTurno: estado.finTurno,
    yo,
    log: estado.log.slice(-12),
    globales: estado.globales.map((g) => g.origen).filter(Boolean),
    muertosTribu: estado.muertosTribu || {},
    mulligan: estado.mulligan || null,
    tutorial: !!estado.tutorial,
    pendiente: estado.pendiente
      ? { seat: estado.pendiente.seat, tipo: estado.pendiente.tipo,
          opciones: estado.pendiente.seat === yo && estado.pendiente.tipo === "descubrir" ? estado.pendiente.opciones : undefined,
          tirador: estado.pendiente.tipo === "disparar" ? estado.pendiente.cola[0] : undefined,
          quedan: estado.pendiente.tipo === "disparar" ? estado.pendiente.cola.length : undefined }
      : null,
    j: estado.j.map((p, s) => ({
      nombre: p.nombre,
      heroe: p.heroe,
      poder: p.poder,
      poderUsado: p.poderUsado,
      mision: p.mision,
      vida: p.vida,
      vidaMax: p.vidaMax,
      mana: p.mana,
      manaMax: p.manaMax,
      mazo: p.mazo.length,
      manoN: p.mano.length,
      mano: s === yo ? p.mano.map((c) => {
        const d = db0[c.id], mej = d?.tipo === "esbirro" && d.tribu && p.mejoras?.[d.tribu];
        const ef = d && [...(d.efectos || []), ...(d.grito || [])].find((x) => x.bonus);
        const pc = d && [...(d.efectos || []), ...(d.grito || [])].find((x) => x.porCada)?.porCada;
        return { ...c, coste: d ? costeCarta(estado, s, c, db0) : undefined, ...(mej ? { ataque: d.ataque + mej.ataque, vida: d.vida + mej.vida } : {}),
          ...(ef ? { cantidad: cantidadDe(estado, s, ef) } : {}), ...(pc ? { veces: contarPorCada(estado, s, pc) } : {}) };
      }) : undefined,
      mejoras: p.mejoras || null,
      gritoExtra: p.gritoExtra || null,
      tablero: p.tablero,
    })),
  };
}
