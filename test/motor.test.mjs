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
// Mauro Sosa: roba una mujer de la mano rival (y no toca lo demás)
{
  const e = nueva(11); const s = e.turno, r = 1 - s;
  db.prueba_mujer = { id: "prueba_mujer", nombre: "Mujer", tipo: "esbirro", coste: 1, ataque: 1, vida: 1, genero: "mujer", token: true };
  e.j[r].mano = [{ uid: "x1", id: "tun_brawl" }, { uid: "x2", id: "prueba_mujer" }];
  preparar(e, s, ["mauro_sosa"]);
  const res = M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  assert.ok(!res.error, res.error);
  assert.ok(e.j[s].mano.some((c) => c.uid === "x2"), "me robé la mujer");
  assert.deepEqual(e.j[r].mano.map((c) => c.uid), ["x1"], "al rival le queda lo demás");
  const res2 = M.aplicar(e, s, { t: "fin" }, db, 0);
  delete db.prueba_mujer;
}
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

// --- Tun IA: descubrir (3 opciones distintas, solo el que elige las ve) ---
{
  const e = nueva(21); const s = e.turno, r = 1 - s;
  e.j[s].tablero = [];
  preparar(e, s, ["tun_ia"]);
  assert.ok(!M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0).error);
  const ops = e.pendiente.opciones;
  assert.equal(new Set(ops).size, ops.length); assert.ok(ops.length === 3 && ops.every((id) => db[id].tribu === "tun" && !db[id].token));
  assert.ok(M.vista(e, s, db).pendiente.opciones && !M.vista(e, r, db).pendiente.opciones, "el rival no ve las opciones");
  assert.ok(M.aplicar(e, s, { t: "atacar", de: "x", a: "h0" }, db, 0).error, "no se puede hacer otra cosa antes de elegir");
  const antes = e.j[s].mano.length;
  assert.ok(!M.aplicar(e, s, { t: "elegir", i: 1 }, db, 0).error);
  assert.equal(e.j[s].mano.length, antes + 1); assert.equal(e.j[s].mano.at(-1).id, ops[1]); assert.equal(e.pendiente, null);
  // si se pasa el turno sin elegir, se elige al azar
  e.turno = s; preparar(e, s, ["tun_ia"]); e.j[s].tablero = [];
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  assert.ok(!M.aplicar(e, s, { t: "fin" }, db, 0).error); assert.equal(e.pendiente, null);
}
// --- Tun Cool: 1 menos por cada Tun en la mesa (de los dos lados) ---
{
  const e = nueva(22); const s = e.turno, r = 1 - s;
  preparar(e, s, ["tun_cool"], 4);
  e.j[s].tablero = []; e.j[r].tablero = [];
  assert.equal(M.costeDe(e, s, db.tun_cool), 10);
  for (let k = 0; k < 4; k++) { e.j[s].poderUsado = false; e.j[s].mana = 4; M.aplicar(e, s, { t: "poder" }, db, 0); }
  e.j[r].tablero.push({ uid: "z9", id: "tun", tribu: "tun", ataque: 1, vida: 1, vidaMax: 1, ataques: 0 });
  assert.equal(M.costeDe(e, s, db.tun_cool), 5);
  e.j[s].mana = 5;
  assert.ok(!M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0).error); assert.equal(e.j[s].mana, 0);
}
// --- Tun Mujer: tus Tun la atacan y cada golpe hace 1 a un enemigo ---
{
  const e = nueva(23); const s = e.turno, r = 1 - s;
  preparar(e, s, ["tun_mujer"]);
  e.j[r].tablero = [];
  e.j[s].tablero = [0, 1, 2].map((k) => ({ uid: "q" + k, id: "tun", tribu: "tun", ataque: 1, vida: 1, vidaMax: 1, ataques: 0 }));
  const vidaRival = e.j[r].vida;
  const res = M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  assert.ok(!res.error, res.error);
  const mujer = e.j[s].tablero.find((m) => m.id === "tun_mujer");
  assert.equal(mujer.vida, 5, "3 Tun le pegaron 1 cada uno");
  assert.equal(tuns(e, s), 1, "los Tun murieron contra ella (2 de ataque)");
  assert.equal(e.j[r].vida, vidaRival - 6, "3 golpes = 2 de daño cada uno al rival");
}
// --- Tun Maestro: 5 Tun al azar, el jugador elige a quién lanza cada uno ---
{
  const e = nueva(24); const s = e.turno, r = 1 - s;
  preparar(e, s, ["tun_maestro"]);
  e.j[s].tablero = []; e.j[r].tablero = [];
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  assert.equal(e.j[s].tablero.length, 6); assert.equal(e.pendiente.tipo, "disparar");
  let n = 0;
  while (e.pendiente && n++ < 10) assert.ok(!M.aplicar(e, s, { t: "elegir", a: "h" + r }, db, 0).error);
  assert.ok(e.j[r].vida < 30 - 4 || e.fase === "fin", "los 5 le pegaron a la cara");
}

// --- Novia de Tun: al morir, tus Tun tienen +1 de ataque (los de ahora, los de la mano y los que vengan) ---
{
  const e = nueva(31); const s = e.turno, r = 1 - s;
  e.j[s].tablero = []; e.j[r].tablero = [];
  preparar(e, s, ["novia_tun", "tun_brawl"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  M.aplicar(e, s, { t: "poder" }, db, 0);
  const novia = e.j[s].tablero.find((m) => m.id === "novia_tun");
  e.j[r].tablero = [{ uid: "rv", id: "x", tribu: null, ataque: 9, vida: 9, vidaMax: 9, ataques: 0 }];
  novia.dormido = false;
  M.aplicar(e, s, { t: "atacar", de: novia.uid, a: "rv" }, db, 0);
  assert.ok(!e.j[s].tablero.some((m) => m.id === "novia_tun"), "la novia murio");
  assert.equal(e.j[s].tablero.find((m) => m.id === "tun").ataque, 2, "el Tun que ya estaba gana +1");
  assert.equal(M.vista(e, s, db).j[s].mano.find((c) => c.id === "tun_brawl").ataque, 3, "en la mano tambien se ve");
  M.aplicar(e, s, { t: "jugar", uid: "t1" }, db, 0);
  assert.equal(e.j[s].tablero.find((m) => m.id === "tun_brawl").ataque, 3, "los nuevos salen con +1");
}
// --- Tun Mastermind: 1 menos por Tun muerto, acometida, +1 de ataque a tus Tun ---
{
  const e = nueva(32); const s = e.turno, r = 1 - s;
  e.j[s].tablero = []; e.j[r].tablero = [];
  preparar(e, s, ["tun_mastermind"]);
  assert.equal(M.costeDe(e, s, db.tun_mastermind), 25);
  e.muertosTribu = { tun: 18 };
  assert.equal(M.costeDe(e, s, db.tun_mastermind), 7);
  e.j[s].mana = 7;
  e.j[r].tablero = [{ uid: "rv", id: "x", tribu: null, ataque: 1, vida: 9, vidaMax: 9, ataques: 0 }];
  assert.ok(!M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0).error);
  const mm = e.j[s].tablero.find((m) => m.id === "tun_mastermind");
  assert.equal(mm.ataque, 7, "se da +1 a si mismo (es Tun)");
  assert.ok(M.aplicar(e, s, { t: "atacar", de: mm.uid, a: "h" + r }, db, 0).error, "acometida: no a la cara");
  assert.ok(!M.aplicar(e, s, { t: "atacar", de: mm.uid, a: "rv" }, db, 0).error, "acometida: si a esbirros");
}
// --- Comida y Plátano ---
{
  const e = nueva(33); const s = e.turno;
  e.j[s].tablero = [];
  preparar(e, s, ["comida", "platano"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  assert.equal(tuns(e, s), 4);
  const t = e.j[s].tablero[0].uid;
  assert.ok(!M.aplicar(e, s, { t: "jugar", uid: "t1", objetivo: t }, db, 0).error);
  assert.ok(e.j[s].tablero[0].provocar && e.j[s].tablero[0].ataque === 3);
}

// --- Tuna y Tunita ---
{
  const e = nueva(34); const s = e.turno, r = 1 - s;
  e.j[s].tablero = []; e.j[r].tablero = [];
  preparar(e, s, ["tun_brawl", "tun_puto", "tuna", "tunita"]);
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  M.aplicar(e, s, { t: "jugar", uid: "t1" }, db, 0);
  M.aplicar(e, s, { t: "jugar", uid: "t2" }, db, 0);
  assert.deepEqual(e.j[s].tablero.map((m) => m.vida), [4, 6], "Tuna: +1 de vida a tus Tun");
  assert.equal(M.vista(e, s, db).j[s].mano.find((c) => c.id === "tunita").cantidad, 3, "1 + 2 Tun jugados");
  e.j[r].tablero = [{ uid: "rv", id: "x", tribu: null, ataque: 1, vida: 9, vidaMax: 9, ataques: 0 }];
  assert.ok(!M.aplicar(e, s, { t: "jugar", uid: "t3", objetivo: "rv" }, db, 0).error);
  assert.equal(e.j[r].tablero[0].vida, 6);
}

// --- Funeral de Tun: zombies por cada Tun muerto; los que no caben buffean ---
{
  const e = nueva(35); const s = e.turno;
  e.j[s].tablero = [];
  preparar(e, s, ["funeral_tun"]);
  e.muertosTribu = { tun: 10 };
  M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0);
  assert.equal(e.j[s].tablero.length, 7);
  const st = e.j[s].tablero.reduce((t, m) => t + m.ataque + m.vida, 0);
  assert.equal(st, 17, "7 zombies 1/1 (14) + 3 que no caben dan +1 cada uno");
}

// --- Porque Me Monean: todos los esbirros del rival pasan a Tun 1/1 ---
{
  const e = nueva(36); const s = e.turno, r = 1 - s;
  e.j[s].tablero = [];
  preparar(e, s, ["porque_me_monean"]);
  e.j[r].tablero = [{ uid: "a1", id: "tun_cool", tribu: "tun", ataque: 6, vida: 7, vidaMax: 7, ataques: 0, provocar: true },
                    { uid: "a2", id: "mauro_sosa", tribu: null, ataque: 2, vida: 3, vidaMax: 3, ataques: 0 }];
  assert.ok(!M.aplicar(e, s, { t: "jugar", uid: "t0" }, db, 0).error);
  assert.deepEqual(e.j[r].tablero.map((m) => [m.id, m.ataque, m.vida, !!m.provocar]), [["tun", 1, 1, false], ["tun", 1, 1, false]]);
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
