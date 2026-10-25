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
// --- mision: invoca 15 Tun (con el poder y Choza de Monos) -> Tun Maestro a la mano ---
{
  const e = nueva(5); const s = e.turno;
  preparar(e, s, ["tun_awarded"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  assert.equal(e.j[s].mision.meta, 15);
  let res;
  for (let k = 0; k < 15; k++) {
    if (e.j[s].tablero.length >= 7) e.j[s].tablero = []; // mesa llena: los que no entran no cuentan
    e.j[s].poderUsado = false; e.j[s].mana = 10;
    res = M.aplicar(e, s, { t: "poder" }, db, 0);
    assert.ok(!res.error, res.error);
  }
  assert.equal(e.j[s].mision.progreso, 15);
  assert.ok(e.j[s].mision.completa && res.ev.some((x) => x.e === "mision_completa"));
  assert.ok(e.j[s].mano.some((c) => c.id === "tun_maestro"), "Tun Maestro en la mano");
}
// --- mesa llena: el Tun que no entra no cuenta ---
{
  const e = nueva(6); const s = e.turno;
  preparar(e, s, ["tun_awarded"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  e.j[s].tablero = Array.from({ length: 7 }, (_, k) => ({ uid: "z" + k, id: "mae", tribu: null, ataque: 1, vida: 2, vidaMax: 2, ataques: 0 }));
  assert.equal(M.puedeUsarPoder(e, s), false, "sin espacio no se puede usar el poder");
}
// --- Tun Maestro: invoca 5 y los dispara ---
{
  const e = nueva(7); const s = e.turno, r = 1 - s;
  e.j[r].tablero = []; e.j[s].tablero = [];
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
  preparar(e, s, ["panama"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  e.j[s].tablero = []; // Panamá muere: el efecto sigue
  M.aplicar(e, s, { t: "fin" }, db, 0); // el rival roba al empezar
  assert.equal(tuns(e, r), 1, "el rival recibe su Tun");
  M.aplicar(e, r, { t: "fin" }, db, 0);
  assert.equal(tuns(e, s), 1, "y yo el mio");
}
// --- mazo completo aunque haya pocas cartas diseñadas ---
for (let k = 0; k < 20; k++) {
  const e = nueva(300 + k);
  for (const p of e.j) assert.equal(p.mazo.length + p.mano.filter((c) => c.id !== "moneda" && c.id !== "tun_awarded").length, 20, "mazo de 20");
}
// --- Tun Puto: cada Tun que muere pega 1 a un enemigo ---
{
  const e = nueva(9); const s = e.turno, r = 1 - s;
  e.j[s].tablero = []; e.j[r].tablero = [];
  preparar(e, s, ["tun_puto"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  e.j[s].mana = 10; M.aplicar(e, s, { t: "poder" }, db, 0);
  // el rival tiene un 3/3: el Tun lo ataca y muere
  e.j[r].tablero = [{ uid: "rv", id: "mae", tribu: null, ataque: 3, vida: 3, vidaMax: 3, ataques: 0 }];
  const tun = e.j[s].tablero.find((m) => m.id === "tun");
  tun.dormido = false;
  const antes = e.j[r].vida + e.j[r].tablero[0].vida;
  const res = M.aplicar(e, s, { t: "atacar", de: tun.uid, a: "rv" }, db, 0);
  assert.ok(!res.error, res.error);
  assert.ok(res.ev.some((x) => x.e === "dispara"), "Tun Puto se activa");
  assert.ok(res.ev.some((x) => x.e === "fx" && x.fx === "piedra"), "Tun Puto tira piedra");
  assert.equal(e.j[r].vida + (e.j[r].tablero[0]?.vida ?? 0), antes - 2, "1 del golpe del Tun + 1 de Tun Puto");
}
// --- Tun Satánico: se come a los otros Tun y gana +2/+2 por cada uno ---
{
  const e = nueva(10); const s = e.turno;
  e.j[s].tablero = [];
  preparar(e, s, ["tun_brawl", "tun_satanico"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  for (let k = 0; k < 2; k++) { e.j[s].poderUsado = false; e.j[s].mana = 10; M.aplicar(e, s, { t: "poder" }, db, 0); }
  e.j[s].mana = 10;
  assert.ok(!M.aplicar(e, s, { t: "jugar", uid: "t1" }, db, 0).error);
  const sat = e.j[s].tablero.find((m) => m.id === "tun_satanico");
  assert.equal(e.j[s].tablero.length, 1, "solo queda Tun Satanico");
  assert.equal(sat.ataque, 3 + 6); assert.equal(sat.vida, 3 + 6);
}
// --- Choza de Monos: 2 Tun al final del turno ---
{
  const e = nueva(11); const s = e.turno;
  e.j[s].tablero = [];
  preparar(e, s, ["choza_monos"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  M.aplicar(e, s, { t: "fin" }, db, 0);
  assert.equal(tuns(e, s), 2);
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
