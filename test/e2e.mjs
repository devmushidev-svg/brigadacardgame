// Prueba de punta a punta: dos navegadores (celular y PC) juegan una partida real.
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:8787";
const OUT = process.argv[2] || ".";
const browser = await chromium.launch();
const cel = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
const pc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const A = await cel.newPage(), B = await pc.newPage();
const errores = [];
for (const [n, p] of [["cel", A], ["pc", B]]) {
  p.on("pageerror", (e) => errores.push(`${n}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !m.text().includes("fonts") && errores.push(`${n} console: ${m.text()}`));
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

await A.goto(BASE);
await A.fill("#nombre", "Mario");
await A.screenshot({ path: `${OUT}/01_lobby.png` });
await A.click("#crear");
await A.waitForURL(/\/p\//);
await A.waitForSelector(".espera");
await A.screenshot({ path: `${OUT}/02_espera.png` });
const link = A.url();

await B.goto(link);
await B.fill("#nombre", "Karka");
await B.click("#ok");
await Promise.all([A.waitForSelector(".mesa"), B.waitForSelector(".mesa")]);
await espera(2500); // banners de turno
await A.screenshot({ path: `${OUT}/03_mesa_cel.png` });
await B.screenshot({ path: `${OUT}/04_mesa_pc.png` });

async function deQuien() {
  return await A.evaluate(() => (window.__V = null, document.querySelector(".fin-turno:not([disabled])") ? "A" : "B"));
}

// juega varios turnos: arrastra cartas jugables al tablero, ataca con lo que pueda, termina turno
async function jugarTurno(page, etiqueta, turno) {
  await page.waitForSelector(".fin-turno:not([disabled])", { timeout: 15000 });
  await espera(1300);
  for (let k = 0; k < 4; k++) {
    const carta = await page.$(".mano .carta.jugable");
    if (!carta) break;
    const b = await carta.boundingBox();
    const tab = await (await page.$("#mi-tablero")).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y - 40, { steps: 4 });
    await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2, { steps: 8 });
    if (turno === 3 && k === 0) await page.screenshot({ path: `${OUT}/05_arrastrando_${etiqueta}.png` });
    await page.mouse.up();
    await espera(300);
    // si pidió objetivo, elegir el primero marcado
    const obj = await page.$(".objetivo");
    if (obj) { await obj.click(); }
    await espera(1400);
  }
  // atacar con flecha
  for (let k = 0; k < 4; k++) {
    const esb = await page.$("#mi-tablero .esbirro.puede");
    if (!esb) break;
    const b = await esb.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await espera(50);
    const obj = await page.$(".objetivo");
    if (!obj) { await page.mouse.up(); break; }
    const o = await obj.boundingBox();
    await page.mouse.move(o.x + o.width / 2, o.y + o.height / 2, { steps: 10 });
    if (turno >= 5 && k === 0) await page.screenshot({ path: `${OUT}/06_flecha_${etiqueta}.png` });
    await page.mouse.up();
    await espera(1500);
  }
  if (await page.$("#poder.listo")) { await page.click("#poder", { force: true }); await espera(1200); }
  await page.click(".fin-turno", { force: true });
  await espera(400);
}

let turnos = 0;
while (turnos < 60) {
  const finA = await A.$(".final"), finB = await B.$(".final");
  if (finA || finB) break;
  const quien = (await A.$(".fin-turno:not([disabled])")) ? A : (await B.$(".fin-turno:not([disabled])")) ? B : null;
  if (!quien) { await espera(500); continue; }
  turnos++;
  await jugarTurno(quien, quien === A ? "cel" : "pc", turnos);
  if (turnos === 8) { await A.screenshot({ path: `${OUT}/07_mitad_cel.png` }); await B.screenshot({ path: `${OUT}/08_mitad_pc.png` }); }
}
await espera(1500);
await A.screenshot({ path: `${OUT}/09_final_cel.png` });
await B.screenshot({ path: `${OUT}/10_final_pc.png` });
const fin = await A.$eval(".final h1", (e) => e.textContent).catch(() => "sin final");
const finB = await B.$eval(".final h1", (e) => e.textContent).catch(() => "sin final");

// revancha
await A.click("#rev", { force: true }); await espera(300); await B.click("#rev", { force: true });
await A.waitForSelector(".mesa:not(:has(.final))", { timeout: 8000 }).catch(() => {});
await espera(1500);
const revancha = !(await A.$(".final")) && !!(await A.$(".mesa"));

// recarga: el jugador conserva su asiento
await B.reload();
await B.waitForSelector(".mesa", { timeout: 8000 });
const conservaAsiento = !!(await B.$(".fin-turno"));

// tercero en discordia: espectador
const C = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await C.goto(link);
await C.fill("#nombre", "Tun"); await C.click("#ok");
await C.waitForSelector(".mesa", { timeout: 8000 });
const espectador = (await C.$eval(".turno-txt", (e) => e.textContent)) === "mirando";

console.log(JSON.stringify({ turnos, fin, finB, revancha, conservaAsiento, espectador, errores }, null, 1));
await browser.close();
