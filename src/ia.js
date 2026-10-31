// IA del bot: prueba cada jugada posible en una copia de la partida y elige
// la que deja la mesa mejor. No sabe nada de cartas específicas, así que
// funciona con cualquier carta nueva que se agregue a cartas.json.
import * as M from "./motor.js";

const copiar = (e) => JSON.parse(JSON.stringify(e));

function valorEsbirro(m) {
  if (m.vida <= 0) return 0;
  let v = m.ataque * 1.2 + m.vida;
  if (m.provocar) v += 1.5;
  if (m.escudo) v += m.ataque * 0.8 + 1;
  if (m.doble) v += m.ataque;
  if (m.noAtaca) v -= m.ataque * 1.2;
  return v;
}

export function evaluar(e, s) {
  if (e.fase === "fin") return e.ganador === s ? 1e6 : e.ganador === "empate" ? -5e5 : -1e6;
  const yo = e.j[s], el = e.j[1 - s];
  // pegarle a la cara vale más cuando el rival ya está bajo
  const pesoCara = el.vida <= 10 ? 1.6 : el.vida <= 18 ? 1.0 : 0.7;
  const pesoMiVida = yo.vida <= 10 ? 1.6 : 0.8;
  let p = -el.vida * pesoCara + yo.vida * pesoMiVida;
  for (const m of yo.tablero) p += valorEsbirro(m);
  for (const m of el.tablero) p -= valorEsbirro(m) * 1.15;
  p += yo.mano.length * 1.4 - el.mano.length * 0.4;
  // armas y armadura
  for (const [q, signo] of [[yo, 1], [el, -1]]) p += signo * ((q.arma ? q.arma.ataque * q.arma.durabilidad * 0.6 : 0) + (q.armadura || 0) * 0.8);
  // misiones: tenerla activa y avanzarla vale; completarla vale mucho
  for (const [q, signo] of [[yo, 1], [el, -0.6]]) {
    if (q.mision) p += signo * (q.mision.completa ? 12 : 5 + (q.mision.progreso / q.mision.meta) * 10);
  }
  // si el rival tiene suficiente ataque en mesa para matarme, es muy malo
  const ataqueRival = el.tablero.reduce((t, m) => t + (m.noAtaca ? 0 : m.ataque * (m.doble ? 2 : 1)), 0);
  const muro = yo.tablero.some((m) => m.provocar);
  if (!muro && ataqueRival >= yo.vida) p -= 400;
  return p;
}

export function jugadas(e, s, db) {
  const p = e.j[s], out = [];
  // si hay que elegir (descubrir o a quién disparar), solo valen esas opciones
  if (e.pendiente) {
    if (e.pendiente.seat !== s) return [];
    return M.opcionesPendiente(e).map((o) => (e.pendiente.tipo === "descubrir" ? { t: "elegir", i: o } : { t: "elegir", a: o }));
  }
  const refs = ["h0", "h1", ...e.j[0].tablero.map((m) => m.uid), ...e.j[1].tablero.map((m) => m.uid)];
  for (const c of p.mano) {
    const carta = db[c.id];
    if (!carta || M.costeCarta(e, s, c, db) > p.mana) continue;
    if (carta.tipo === "esbirro" && !M.cabeEsbirro(e, s, carta)) continue;
    if (carta.tipo === "mision" && p.mision) continue;
    if (M.necesitaObjetivo(carta) && M.hayObjetivos(e, s, carta)) {
      for (const r of refs) if (M.objetivoValido(e, s, carta, r)) out.push({ t: "jugar", uid: c.uid, objetivo: r });
    } else if (!(carta.tipo === "hechizo" && M.necesitaObjetivo(carta))) {
      out.push({ t: "jugar", uid: c.uid });
    }
  }
  for (const m of p.tablero) if (M.puedeAtacar(m)) for (const a of M.objetivosAtaque(e, s, m)) out.push({ t: "atacar", de: m.uid, a });
  if (M.puedeLanzarVC(e, s)) out.push({ t: "vc" });
  if (M.puedeAtacarHeroe(e, s)) for (const a of M.objetivosAtaque(e, s)) out.push({ t: "atacar", de: "h" + s, a });
  if (M.puedeUsarPoder(e, s)) {
    if (M.necesitaObjetivo(p.poder)) { for (const r of refs) if (M.objetivoValido(e, s, p.poder, r)) out.push({ t: "poder", objetivo: r }); }
    else out.push({ t: "poder" });
  }
  return out;
}

function probar(e, s, a, db) {
  const c = copiar(e);
  const r = M.aplicar(c, s, a, db, 0);
  return r.error ? null : c;
}

// Devuelve la próxima acción del bot (o terminar turno).
export function decidir(e, s, db) {
  // mulligan: cambia las cartas caras (más de 3 de maná) para tener jugadas los primeros turnos
  if (e.fase === "mulligan") return { t: "mulligan", cambiar: e.j[s].mano.filter((c) => db[c.id]?.tipo !== "mision" && db[c.id]?.coste > 3).map((c) => c.uid) };
  const base = evaluar(e, s);
  let mejor = null, mejorP = base + 0.05;
  for (const a of jugadas(e, s, db)) {
    const c = probar(e, s, a, db);
    if (!c) continue;
    let p = evaluar(c, s);
    // jugadas que no cambian la mesa pero dan maná (La Moneda): valen lo que permitan jugar después
    if (a.t === "jugar" && c.j[s].mana > e.j[s].mana - M.costeCarta(e, s, e.j[s].mano.find((x) => x.uid === a.uid), db)) {
      let sig = p;
      for (const b of jugadas(c, s, db)) {
        const d = probar(c, s, b, db);
        if (d) sig = Math.max(sig, evaluar(d, s));
      }
      p = sig - 0.5;
    }
    if (p > mejorP) { mejorP = p; mejor = a; }
  }
  if (!mejor && e.pendiente) return jugadas(e, s, db)[0] || { t: "fin" };
  return mejor || { t: "fin" };
}
