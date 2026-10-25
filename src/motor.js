// Motor del juego: reglas tipo Hearthstone (nivel de poder absurdo a propósito).
// Todo el estado es JSON plano para poder guardarlo en el Durable Object.
// El servidor es la única autoridad: el cliente solo manda intenciones.
// Las mecánicas están documentadas en MECANICAS.md.

export const CONFIG = {
  VIDA_HEROE: 30,
  MAX_MANA: 10,
  MAX_TABLERO: 7,
  MAX_MANO: 10,
  TAM_MAZO: 20,
  CARTAS_DE_CLASE: 12, // cuántas cartas del mazo salen de la clase del héroe
  COPIAS_MAX: 2,
  TIEMPO_TURNO: 75, // segundos
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
const maxCopias = (c) => (c.rareza === "legendaria" ? 1 : CONFIG.COPIAS_MAX);

function armarMazo(estado, db, clase) {
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

export function empezar(estado, db, ahora, heroes = {}) {
  const ev = [];
  estado.fase = "jugando";
  const lista = Object.values(heroes);
  for (const p of estado.j) {
    const h = heroes[p.heroe] || lista[0] || null;
    p.heroe = h ? h.id : null;
    p.poder = h?.poder ? copia(h.poder) : null;
    p.mazo = armarMazo(estado, db, p.heroe);
  }
  const primero = azar(estado) < 0.5 ? 0 : 1;
  estado.turno = primero;
  // la misión de la clase siempre empieza en la mano
  for (const s of [primero, otro(primero)]) {
    const mision = Object.values(db).find((c) => c.tipo === "mision" && c.clase && c.clase === estado.j[s].heroe);
    if (mision) darCarta(estado, s, mision.id, ev);
  }
  for (let k = 0; k < 3; k++) robar(estado, primero, ev, db);
  for (let k = 0; k < 4; k++) robar(estado, otro(primero), ev, db);
  if (db.moneda) darCarta(estado, otro(primero), "moneda", ev);
  registrar(estado, `${estado.j[primero].nombre} empieza`);
  inicioTurno(estado, primero, ev, db, ahora);
  return ev;
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
  darCarta(estado, s, p.mazo.shift(), ev);
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

function invocar(estado, s, id, ev, db, pos) {
  const p = estado.j[s];
  const c = db[id];
  if (!c || p.tablero.length >= CONFIG.MAX_TABLERO) return null;
  const claves = new Set(c.claves || []);
  const m = {
    uid: nuevoUid(estado),
    id,
    tribu: c.tribu || null,
    ataque: c.ataque,
    vida: c.vida,
    vidaMax: c.vida,
    provocar: claves.has("provocar"),
    carga: claves.has("carga"),
    escudo: claves.has("escudo"),
    noAtaca: claves.has("no_ataca"),
    doble: claves.has("doble"),
    dormido: !claves.has("carga"),
    ataques: 0,
  };
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
  const tribuOk = (m) => !efecto.filtro?.tribu || m.tribu === efecto.filtro.tribu;
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
    case "aliado_azar": return yo.length ? [elegir(estado, yo)] : [];
    case "aliados": return yo;
    case "todos_enemigos": return ["h" + otro(s), ...ene];
    case "enemigo_azar": return [elegir(estado, ["h" + otro(s), ...ene])];
    case "yo": return fuente ? [fuente] : [];
    default: return [];
  }
}

function aplicarEfectos(estado, s, efectos, elegido, ev, db, fuente, ctx = {}) {
  for (const ef of efectos || []) {
    const n = ef.cantidad ?? 1;
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
      estado.globales.push({ disparador: ef.disparador, efectos: ef.efectos, origen: ef.origen || null });
      ev.push({ e: "global", seat: s });
      continue;
    }
    if (ef.tipo === "invocar") {
      const lado = ef.lado === "enemigo" ? otro(s) : ef.lado === "quien_roba" && ctx.quien != null ? ctx.quien : s;
      const nuevos = [];
      for (let k = 0; k < n; k++) {
        const m = invocar(estado, lado, ef.carta, ev, db);
        if (m) nuevos.push(m.uid);
      }
      // "disparar": cada invocado se lanza contra un enemigo al azar
      if (ef.disparar) {
        for (const uid of nuevos) {
          if (estado.fase !== "jugando" || !buscar(estado, uid)) continue;
          const ene = ["h" + otro(lado), ...estado.j[otro(lado)].tablero.map((m) => m.uid)];
          chocar(estado, uid, elegir(estado, ene), ev);
          resolverMuertes(estado, ev, db);
        }
      }
      continue;
    }
    for (const ref of objetivos(estado, s, ef, elegido, fuente)) {
      const t = buscar(estado, ref);
      if (!t) continue;
      if (ef.tipo === "dano") danar(estado, ref, n, ev, { fx: ef.fx, de: fuente });
      else if (ef.tipo === "curar") curar(estado, ref, n, ev);
      else if (ef.tipo === "destruir" && t.tipo === "esbirro") { t.obj.vida = 0; ev.push({ e: "destruido", a: ref }); }
      else if (ef.tipo === "buff" && t.tipo === "esbirro") {
        t.obj.ataque += ef.ataque || 0;
        t.obj.vida += ef.vida || 0;
        t.obj.vidaMax += ef.vida || 0;
        if (ef.provocar) t.obj.provocar = true;
        if (ef.escudo) t.obj.escudo = true;
        if (ef.carga) { t.obj.carga = true; t.obj.dormido = false; }
        ev.push({ e: "buff", a: ref, ataque: ef.ataque || 0, vida: ef.vida || 0 });
      }
    }
  }
}

function resolverMuertes(estado, ev, db) {
  for (let vuelta = 0; vuelta < 30; vuelta++) {
    const muertos = [];
    for (const s of [0, 1]) {
      const p = estado.j[s];
      for (const m of p.tablero) if (m.vida <= 0) muertos.push({ s, m });
      p.tablero = p.tablero.filter((m) => m.vida > 0);
    }
    if (!muertos.length) break;
    for (const { s, m } of muertos) {
      ev.push({ e: "muere", uid: m.uid, seat: s });
      const c = db[m.id];
      if (c && c.aliento) aplicarEfectos(estado, s, c.aliento, null, ev, db, null);
    }
    // "cada vez que muere un <tribu>": se activa en los esbirros vivos de los dos lados
    for (const { m } of muertos) {
      if (!m.tribu) continue;
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

export function objetivosAtaque(estado, s) {
  const ene = estado.j[otro(s)].tablero;
  const prov = ene.filter((m) => m.provocar);
  if (prov.length) return prov.map((m) => m.uid);
  return ["h" + otro(s), ...ene.map((m) => m.uid)];
}

export function puedeUsarPoder(estado, s) {
  const p = estado.j[s];
  if (!p.poder || p.poderUsado || p.poder.coste > p.mana) return false;
  if (necesitaObjetivo(p.poder) && !hayObjetivos(estado, s, p.poder)) return false;
  // poderes que solo invocan necesitan espacio en la mesa
  if ((p.poder.efectos || []).every((e) => e.tipo === "invocar" && e.lado !== "enemigo") && p.tablero.length >= CONFIG.MAX_TABLERO) return false;
  return true;
}

// ---------- acciones ----------
export function aplicar(estado, s, accion, db, ahora) {
  const ev = [];
  if (estado.fase !== "jugando") return { error: "la partida no esta en juego" };
  if (accion.t === "rendirse") {
    estado.j[s].vida = 0;
    registrar(estado, `${estado.j[s].nombre} se rindio`);
    resolverMuertes(estado, ev, db);
    return { ev };
  }
  if (estado.turno !== s) return { error: "no es tu turno" };
  const p = estado.j[s];

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
    if (carta.coste > p.mana) return { error: "no te alcanza el mana" };
    if (carta.tipo === "esbirro" && p.tablero.length >= CONFIG.MAX_TABLERO) return { error: "tablero lleno" };
    if (carta.tipo === "mision" && p.mision) return { error: "ya tenes una mision activa" };
    const pide = necesitaObjetivo(carta);
    if (pide && hayObjetivos(estado, s, carta)) {
      if (!accion.objetivo || !objetivoValido(estado, s, carta, accion.objetivo)) return { error: "objetivo invalido" };
    } else if (carta.tipo === "hechizo" && pide) {
      return { error: "no hay objetivos para este hechizo" };
    }
    p.mana -= carta.coste;
    p.mano.splice(i, 1);
    registrar(estado, `${p.nombre} jugo ${carta.nombre}`);
    if (carta.tipo === "mision") {
      p.mision = { id: carta.id, nombre: carta.nombre, ...copia(carta.mision), progreso: 0, completa: false };
      ev.push({ e: "mision", seat: s, carta: carta.id });
    } else if (carta.tipo === "hechizo") {
      ev.push({ e: "hechizo", seat: s, carta: carta.id, objetivo: accion.objetivo || null });
      aplicarEfectos(estado, s, carta.efectos, accion.objetivo, ev, db, null);
    } else {
      const m = invocar(estado, s, carta.id, ev, db, accion.pos);
      if (m && carta.grito) {
        ev.push({ e: "grito", uid: m.uid, objetivo: accion.objetivo || null });
        aplicarEfectos(estado, s, carta.grito, accion.objetivo, ev, db, m.uid);
      }
      avanzarMision(estado, s, "jugar_tribu", carta.tribu || null, ev, db);
    }
    resolverMuertes(estado, ev, db);
    return { ev };
  }

  if (accion.t === "atacar") {
    const m = p.tablero.find((x) => x.uid === accion.de);
    if (!m) return { error: "ese esbirro no es tuyo" };
    if (!puedeAtacar(m)) return { error: m.dormido ? "acaba de entrar, espera un turno" : "no puede atacar" };
    if (!objetivosAtaque(estado, s).includes(accion.a)) return { error: "tenes que atacar a los de provocar" };
    m.ataques++;
    chocar(estado, m.uid, accion.a, ev);
    resolverMuertes(estado, ev, db);
    return { ev };
  }
  return { error: "accion desconocida" };
}

// Fin de turno por tiempo
export function tiempoAgotado(estado, db, ahora) {
  if (estado.fase !== "jugando" || ahora < estado.finTurno) return null;
  const s = estado.turno;
  registrar(estado, `a ${estado.j[s].nombre} se le acabo el tiempo`);
  const ev = [];
  finTurno(estado, s, ev, db);
  if (estado.fase === "jugando") inicioTurno(estado, otro(s), ev, db, ahora);
  return ev;
}

// ---------- lo que ve cada jugador ----------
export function vista(estado, yo) {
  return {
    fase: estado.fase,
    turno: estado.turno,
    numTurno: estado.numTurno,
    ganador: estado.ganador,
    finTurno: estado.finTurno,
    yo,
    log: estado.log.slice(-12),
    globales: estado.globales.map((g) => g.origen).filter(Boolean),
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
      mano: s === yo ? p.mano : undefined,
      tablero: p.tablero,
    })),
  };
}
