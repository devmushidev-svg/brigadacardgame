// El bot contra un jugador al azar y contra sí mismo: no debe romper reglas y debe ganar casi siempre al azar.
import { readFileSync } from "node:fs";
import * as M from "../src/motor.js";
import { decidir, jugadas } from "../src/ia.js";

const db = Object.fromEntries(JSON.parse(readFileSync(new URL("../src/cartas.json", import.meta.url))).cartas.map((c) => [c.id, c]));
let r = 777;
const rand = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296);

function partida(semilla, tipos) {
  const e = M.crearPartida(db, semilla);
  e.j[0].nombre = "A"; e.j[1].nombre = "B";
  M.empezar(e, db, 0);
  let pasos = 0;
  while (e.fase === "jugando" && pasos++ < 4000) {
    const s = e.turno;
    let a;
    if (tipos[s] === "ia") a = decidir(e, s, db);
    else { const op = jugadas(e, s, db); a = op.length && rand() < 0.8 ? op[Math.floor(rand() * op.length)] : { t: "fin" }; }
    const res = M.aplicar(e, s, a, db, 0);
    if (res.error) throw new Error(`${tipos[s]} hizo una jugada invalida: ${JSON.stringify(a)} -> ${res.error}`);
  }
  if (e.fase !== "fin") throw new Error("no termino");
  return e;
}

let ganaIA = 0, N = 300, turnos = 0;
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const iaEs = g % 2;
  const e = partida(g * 31 + 5, iaEs === 0 ? ["ia", "azar"] : ["azar", "ia"]);
  if (e.ganador === iaEs) ganaIA++;
  turnos += e.numTurno;
}
let terminaIA = 0;
for (let g = 0; g < 100; g++) { partida(g * 97 + 3, ["ia", "ia"]); terminaIA++; }
const ms = (Date.now() - t0) / (N + 100);
console.log(`bot vs azar: gana ${ganaIA}/${N} (${Math.round((100 * ganaIA) / N)}%), ${(turnos / N).toFixed(1)} turnos promedio; bot vs bot: ${terminaIA}/100 terminadas; ${ms.toFixed(0)} ms por partida`);
if (ganaIA / N < 0.85) throw new Error("el bot es demasiado malo");
