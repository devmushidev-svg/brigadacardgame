// Partida completa contra el bot desde el navegador (celular).
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:8787";
const OUT = process.argv[2] || ".";
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(e.message));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

await p.goto(BASE);
await p.fill("#nombre", "Mario");
await p.screenshot({ path: `${OUT}/bot_01_lobby.png` });
await p.click("#bot");
await p.waitForSelector(".mesa", { timeout: 10000 });
const rival = await p.$eval(".barra .nombre", (e) => e.textContent);

let usosPoder = 0, misTurnos = 0, turnosBot = 0, capturaBot = false;
const t0 = Date.now();
while (Date.now() - t0 < 600000) {
  if (await p.$(".final")) break;
  const miTurno = await p.$(".fin-turno:not([disabled])");
  if (!miTurno) {
    if (!capturaBot && (await p.$$("#mi-tablero .esbirro")).length >= 1 && misTurnos >= 3) { await espera(1800); await p.screenshot({ path: `${OUT}/bot_02_turno_bot.png` }); capturaBot = true; }
    await espera(400); continue;
  }
  misTurnos++;
  await espera(1300);
  for (let k = 0; k < 4; k++) {
    const c = await p.$(".mano .carta.jugable"); if (!c) break;
    const b = await c.boundingBox(), t = await (await p.$("#mi-tablero")).boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + 20); await p.mouse.down();
    await p.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 }); await p.mouse.up();
    await espera(300);
    const o = await p.$(".objetivo"); if (o) await o.click({ force: true });
    await espera(1400);
  }
  for (let k = 0; k < 5; k++) {
    const e = await p.$("#mi-tablero .esbirro.puede"); if (!e) break;
    const b = await e.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await espera(40);
    const objs = await p.$$(".objetivo"); if (!objs.length) { await p.mouse.up(); break; }
    const o = await objs[objs.length - 1].boundingBox(); // a veces cara, a veces esbirro
    await p.mouse.move(o.x + o.width / 2, o.y + o.height / 2, { steps: 8 }); await p.mouse.up();
    await espera(1500);
  }
  if (await p.$("#poder.listo")) { await p.click("#poder", { force: true }); await espera(1200); usosPoder++; }
  if (misTurnos === 4) await p.screenshot({ path: `${OUT}/bot_06_poder.png` });
  await p.click(".fin-turno", { force: true });
  turnosBot++;
  if (misTurnos === 6) await p.screenshot({ path: `${OUT}/bot_03_mitad.png` });
}
await espera(1500);
await p.screenshot({ path: `${OUT}/bot_04_final.png` });
const fin = await p.$eval(".final h1", (e) => e.textContent).catch(() => "sin final");
// revancha contra el bot arranca sola
await p.click("#rev", { force: true });
await espera(2500);
const revancha = !(await p.$(".final")) && !!(await p.$(".mesa"));
const mision = await p.$eval(".mision-chip", (e) => e.textContent).catch(() => "sin chip");
console.log(JSON.stringify({ rival, misTurnos, usosPoder, mision, fin, revancha, errores }));
await browser.close();
