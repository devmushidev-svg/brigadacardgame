// Prueba de estrés: miles de partidas con jugadas al azar para cazar errores de reglas.
import { readFileSync } from "node:fs";
import * as M from "../src/motor.js";

const db = Object.fromEntries(JSON.parse(readFileSync(new URL("../src/cartas.json", import.meta.url))).cartas.map((c) => [c.id, c]));
let r = 12345;
const rand = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rand() * a.length)];

function accionesValidas(e, s) {
  const p = e.j[s], acc = [{ t: "fin" }];
  for (const c of p.mano) {
    const carta = db[c.id];
    if (carta.coste > p.mana) continue;
    if (carta.tipo !== "hechizo" && p.tablero.length >= M.CONFIG.MAX_TABLERO) continue;
    if (M.necesitaObjetivo(carta)) {
      const refs = ["h0", "h1", ...e.j[0].tablero.map((m) => m.uid), ...e.j[1].tablero.map((m) => m.uid)];
      for (const o of refs) acc.push({ t: "jugar", uid: c.uid, objetivo: o, pos: Math.floor(rand() * 8) });
    } else acc.push({ t: "jugar", uid: c.uid, pos: Math.floor(rand() * 8) });
  }
  for (const m of p.tablero) if (M.puedeAtacar(m)) for (const a of M.objetivosAtaque(e, s)) acc.push({ t: "atacar", de: m.uid, a });
  return acc;
}

let terminadas = 0, turnosTot = 0, rechazadas = 0, maxTurnos = 0;
const ganados = [0, 0, 0];
for (let g = 0; g < 3000; g++) {
  const e = M.crearPartida(db, g * 7919 + 1);
  e.j[0].nombre = "A"; e.j[1].nombre = "B";
  M.empezar(e, db, 0);
  let pasos = 0;
  while (e.fase === "jugando" && pasos++ < 5000) {
    const s = e.turno;
    const acc = accionesValidas(e, s);
    // preferir jugar/atacar antes que terminar, para que las partidas avancen
    const a = acc.length > 1 && rand() < 0.85 ? pick(acc.slice(1)) : acc[0];
    const res = M.aplicar(e, s, a, db, 0);
    if (res.error) rechazadas++;
    // invariantes
    for (const p of e.j) {
      if (p.tablero.length > M.CONFIG.MAX_TABLERO) throw new Error("tablero excedido");
      if (p.mano.length > M.CONFIG.MAX_MANO) throw new Error("mano excedida");
      if (p.mana < 0 || p.mana > M.CONFIG.MAX_MANA) throw new Error("mana fuera de rango " + p.mana);
      for (const m of p.tablero) if (m.vida <= 0) throw new Error("muerto en tablero");
    }
    JSON.stringify(e); // debe ser serializable siempre
  }
  if (e.fase !== "fin") throw new Error("partida no termino");
  terminadas++; turnosTot += e.numTurno; maxTurnos = Math.max(maxTurnos, e.numTurno);
  ganados[e.ganador === "empate" ? 2 : e.ganador]++;
}

// errores esperados: atacar fuera de turno, sin mana, etc.
const e = M.crearPartida(db, 99); e.j[0].nombre = "A"; e.j[1].nombre = "B"; M.empezar(e, db, 0);
const noTurno = 1 - e.turno;
console.assert(M.aplicar(e, noTurno, { t: "fin" }, db, 0).error === "no es tu turno");
console.assert(M.aplicar(e, e.turno, { t: "jugar", uid: "nada" }, db, 0).error);
// el de turno recibió 1 de maná; el segundo jugador tiene la moneda
console.assert(e.j[noTurno].mano.some((c) => c.id === "moneda"), "segundo jugador sin moneda");
// tiempo agotado pasa el turno
const t0 = e.turno; M.tiempoAgotado(e, db, e.finTurno + 1); console.assert(e.turno !== t0, "timeout no paso turno");

console.log(`ok: ${terminadas} partidas, promedio ${(turnosTot / terminadas).toFixed(1)} turnos (max ${maxTurnos}), gana A/B/empate ${ganados.join("/")}, acciones rechazadas ${rechazadas}`);
