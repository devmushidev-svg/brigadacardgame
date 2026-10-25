// Pruebas del motor: cada mecánica por separado + miles de partidas al azar.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as M from "../src/motor.js";
import { jugadas } from "../src/ia.js";

const JS = JSON.parse(readFileSync(new URL("../src/cartas.json", import.meta.url)));
const db = Object.fromEntries(JS.cartas.map((c) => [c.id, c]));
const heroes = Object.fromEntries(JS.heroes.map((h) => [h.id, h]));

function nueva(semilla = 1) {
  const e = M.crearPartida(db, semilla);
  e.j[0].nombre = "A"; e.j[1].nombre = "B";
  M.empezar(e, db, 0, heroes);
  return e;
}
// prepara una mesa controlada: turno del jugador s con mucho maná y la mano indicada
function preparar(e, s, mano, mana = 10) {
  e.turno = s;
  e.j[s].mana = e.j[s].manaMax = mana;
  e.j[s].mano = mano.map((id, i) => ({ uid: "t" + i, id }));
}
const tuns = (e, s) => e.j[s].tablero.filter((m) => m.tribu === "tun").length;

// --- héroe y poder ---
{
  const e = nueva(3);
  assert.equal(e.j[0].heroe, "tun");
  assert.ok(e.j[0].mano.some((c) => c.id === "tun_awarded") && e.j[1].mano.some((c) => c.id === "tun_awarded"), "la mision empieza en la mano");
  const s = e.turno;
  e.j[s].mana = 1;
  assert.ok(!M.aplicar(e, s, { t: "poder" }, db, 0).error);
  assert.equal(e.j[s].tablero.at(-1).id, "tun");
  assert.equal(M.aplicar(e, s, { t: "poder" }, db, 0).error, "ya usaste tu poder este turno");
  M.aplicar(e, s, { t: "fin" }, db, 0); M.aplicar(e, 1 - s, { t: "fin" }, db, 0);
  assert.equal(e.j[s].poderUsado, false, "el poder se recarga cada turno");
}
// --- legendarias: maximo 1 copia en el mazo ---
for (let k = 0; k < 50; k++) {
  const e = nueva(100 + k);
  for (const p of e.j) {
    const todo = [...p.mazo, ...p.mano.map((c) => c.id)];
    assert.ok(todo.filter((id) => id === "panama").length <= 1, "panama repetida");
    assert.ok(!todo.includes("tun_maestro"), "la recompensa no va en el mazo");
  }
}
// --- mision: invoca 15 Tun -> Tun Maestro a la mano ---
{
  const e = nueva(5); const s = e.turno;
  preparar(e, s, ["tun_awarded", ...Array(6).fill("junta_tuns")]);
  const jugar = (uid) => { e.j[s].mana = 10; const r = M.aplicar(e, s, { t: "jugar", uid }, db, 0); assert.ok(!r.error, r.error); return r; };
  jugar("t0");
  assert.equal(e.j[s].mision.meta, 15);
  jugar("t1"); jugar("t2");
  assert.equal(e.j[s].mision.progreso, 6);
  jugar("t3"); // mesa llena: los que no entran no cuentan
  assert.equal(tuns(e, s), 7);
  assert.equal(e.j[s].mision.progreso, 7);
  e.j[s].tablero = []; jugar("t4"); jugar("t5");  // 13
  assert.equal(e.j[s].mision.progreso, 13);
  assert.ok(!e.j[s].mision.completa);
  e.j[s].tablero = []; const res = jugar("t6");   // 16 -> se completa en el 15
  assert.ok(e.j[s].mision.completa, "mision completa");
  assert.ok(res.ev.some((x) => x.e === "mision_completa"));
  assert.ok(e.j[s].mano.some((c) => c.id === "tun_maestro"), "Tun Maestro en la mano");
}
// --- el poder de héroe también cuenta para la mision ---
{
  const e = nueva(6); const s = e.turno;
  preparar(e, s, ["tun_awarded"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  M.aplicar(e, s, { t: "poder" }, db, 0);
  assert.equal(e.j[s].mision.progreso, 1);
}
// --- Tun Maestro: invoca 5 y los dispara ---
{
  const e = nueva(7); const s = e.turno, r = 1 - s;
  e.j[r].tablero = [];
  preparar(e, s, ["tun_maestro"]);
  const vidaAntes = e.j[r].vida;
  const res = M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  assert.ok(!res.error);
  assert.equal(res.ev.filter((x) => x.e === "invoca" && x.carta === "tun").length, 5);
  assert.equal(res.ev.filter((x) => x.e === "ataque").length, 5, "cada Tun se dispara");
  assert.equal(e.j[r].vida, vidaAntes - 5, "sin esbirros enemigos, los 5 le pegan a la cara");
}
// --- Panamá: cada robo invoca un Tun para quien roba, aunque Panamá muera ---
{
  const e = nueva(8); const s = e.turno, r = 1 - s;
  e.j[s].tablero = []; e.j[r].tablero = [];
  preparar(e, s, ["panama", "cafe"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  e.j[s].tablero = e.j[s].tablero.filter((m) => m.id !== "panama"); // muere
  M.aplicar(e, s, { t: "jugar", uid: "t1" }, db, 0); // cafe: roba 2
  assert.equal(tuns(e, s), 2, "2 robos = 2 Tun");
  M.aplicar(e, s, { t: "fin" }, db, 0); // el rival roba al empezar
  assert.equal(tuns(e, r), 1, "el rival tambien recibe su Tun");
}
// --- buff solo a la tribu y fin de turno ---
{
  const e = nueva(9); const s = e.turno;
  e.j[s].tablero = [];
  preparar(e, s, ["mae", "tun_bebe", "tun_motivador", "tun_infinito"]);
  for (const u of ["t0", "t1", "t2"]) M.aplicar(e, s, { t: "jugar", uid: u }, db, 0);
  const mae = e.j[s].tablero.find((m) => m.id === "mae"), bebe = e.j[s].tablero.find((m) => m.id === "tun_bebe");
  assert.equal(mae.ataque, 1, "el buff no toca a los que no son Tun");
  assert.equal(bebe.ataque, 2);
  e.j[s].tablero = e.j[s].tablero.slice(0, 2);
  e.j[s].mana = 10;
  assert.ok(!M.aplicar(e, s, { t: "jugar", uid: "t3" }, db, 0).error);
  const antes = e.j[s].tablero.length;
  M.aplicar(e, s, { t: "fin" }, db, 0);
  assert.equal(e.j[s].tablero.length, antes + 2, "Tun Infinito invoca 2 al final del turno");
}

// --- estrés: miles de partidas con jugadas al azar ---
let r = 12345;
const rand = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296);
let terminadas = 0, turnosTot = 0, maxTurnos = 0, misiones = 0;
const ganados = [0, 0, 0];
for (let g = 0; g < 2000; g++) {
  const e = nueva(g * 7919 + 1);
  let pasos = 0;
  while (e.fase === "jugando" && pasos++ < 6000) {
    const s = e.turno;
    const op = jugadas(e, s, db);
    const a = op.length && rand() < 0.85 ? op[Math.floor(rand() * op.length)] : { t: "fin" };
    const res = M.aplicar(e, s, a, db, 0);
    if (res.error) throw new Error(`jugada valida rechazada: ${JSON.stringify(a)} -> ${res.error}`);
    for (const p of e.j) {
      assert.ok(p.tablero.length <= M.CONFIG.MAX_TABLERO, "tablero excedido");
      assert.ok(p.mano.length <= M.CONFIG.MAX_MANO, "mano excedida");
      assert.ok(p.mana >= 0 && p.mana <= M.CONFIG.MAX_MANA, "mana fuera de rango");
      for (const m of p.tablero) assert.ok(m.vida > 0, "muerto en tablero");
    }
  }
  assert.equal(e.fase, "fin", "partida no termino");
  JSON.stringify(e);
  terminadas++; turnosTot += e.numTurno; maxTurnos = Math.max(maxTurnos, e.numTurno);
  misiones += e.j.filter((p) => p.mision?.completa).length;
  ganados[e.ganador === "empate" ? 2 : e.ganador]++;
}
console.log(`ok: mecanicas + ${terminadas} partidas al azar, ${(turnosTot / terminadas).toFixed(1)} turnos promedio (max ${maxTurnos}), A/B/empate ${ganados.join("/")}, misiones completadas ${misiones}`);
