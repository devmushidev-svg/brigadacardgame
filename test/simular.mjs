// Juega miles de partidas con movimientos al azar para cazar errores del motor.
import fs from "node:fs";
import * as M from "../src/motor.js";
const datos = JSON.parse(fs.readFileSync(new URL("../src/cartas.json", import.meta.url)));
const DB = Object.fromEntries(datos.cartas.map((c) => [c.id, c]));
let r = 12345; const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
let partidas = 0, turnos = 0, errores = 0, acciones = 0, gana = [0, 0, 0];
for (let g = 0; g < 3000; g++) {
  const e = M.crearPartida(DB, g * 7919 + 1);
  e.j[0].nombre = "A"; e.j[1].nombre = "B";
  M.empezar(e, DB, 0);
  let pasos = 0;
  while (e.fase === "jugando" && pasos++ < 3000) {
    const s = e.turno, p = e.j[s];
    const ops = [];
    for (const c of p.mano) {
      const carta = DB[c.id];
      if (carta.coste > p.mana) continue;
      const refs = ["h0", "h1", ...e.j[0].tablero.map((m) => m.uid), ...e.j[1].tablero.map((m) => m.uid)];
      ops.push({ t: "jugar", uid: c.uid, pos: Math.floor(rnd() * 8), objetivo: M.necesitaObjetivo(carta) ? pick(refs) : undefined });
    }
    for (const m of p.tablero) if (M.puedeAtacar(m)) for (const a of M.objetivosAtaque(e, s)) ops.push({ t: "atacar", de: m.uid, a });
    ops.push({ t: "fin" });
    const a = rnd() < 0.85 ? pick(ops) : { t: "fin" };
    const antes = JSON.stringify(e);
    const res = M.aplicar(e, s, a, DB, 0);
    acciones++;
    if (res.error) { if (JSON.stringify(e) !== antes) { errores++; console.log("ESTADO CAMBIO CON ERROR", a, res.error); } continue; }
    if (a.t === "fin") turnos++;
    // invariantes
    for (const q of e.j) {
      if (q.tablero.length > M.CONFIG.MAX_TABLERO) { errores++; console.log("tablero > 7"); }
      if (q.mano.length > M.CONFIG.MAX_MANO) { errores++; console.log("mano > 10"); }
      if (q.mana < 0) { errores++; console.log("mana negativo"); }
      if (e.fase === "jugando" && q.tablero.some((m) => m.vida <= 0)) { errores++; console.log("esbirro muerto en tablero"); }
    }
    JSON.parse(JSON.stringify(e)); // serializable
  }
  if (e.fase !== "fin") { errores++; console.log("partida no termino"); }
  gana[e.ganador === "empate" ? 2 : e.ganador]++;
  partidas++;
}
console.log({ partidas, turnos, acciones, errores, gana_j0: gana[0], gana_j1: gana[1], empates: gana[2] });
