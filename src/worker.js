// Worker de Cloudflare: sirve la página, crea partidas y conecta cada partida
// con su Durable Object (una "sala" que guarda el estado y los websockets).
import { DurableObject } from "cloudflare:workers";
import cartasJson from "./cartas.json";
import * as M from "./motor.js";
import { decidir } from "./ia.js";

const DB = Object.fromEntries(cartasJson.cartas.map((c) => [c.id, c]));
const HEROES = Object.fromEntries((cartasJson.heroes || []).map((h) => [h.id, h]));
const ID_OK = /^[a-z0-9]{6,12}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/crear" && req.method === "POST") {
      const id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => (b % 36).toString(36)).join("");
      return Response.json({ id });
    }
    if (url.pathname === "/api/cartas") {
      return Response.json({ cartas: cartasJson.cartas, heroes: cartasJson.heroes || [] }, { headers: { "cache-control": "no-cache" } });
    }
    const ws = url.pathname.match(/^\/ws\/([a-z0-9]+)$/);
    if (ws) {
      if (!ID_OK.test(ws[1])) return new Response("partida invalida", { status: 400 });
      if (req.headers.get("Upgrade") !== "websocket") return new Response("se esperaba websocket", { status: 426 });
      const sala = env.PARTIDAS.get(env.PARTIDAS.idFromName(ws[1]));
      return sala.fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const limpiarNombre = (n) => String(n || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 20) || null;

export class Partida extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.estado = null;
    this.tokens = [null, null];
    this.revancha = [false, false];
    this.bot = null; // asiento del bot, si la partida es contra la máquina
    this.botCorriendo = false;
    ctx.blockConcurrencyWhile(async () => {
      this.bot = (await ctx.storage.get("bot")) ?? null;
      this.estado = (await ctx.storage.get("estado")) || null;
      this.tokens = (await ctx.storage.get("tokens")) || [null, null];
      this.revancha = (await ctx.storage.get("revancha")) || [false, false];
    });
  }

  async fetch() {
    const [cliente, servidor] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment({ seat: -1 });
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async guardar() {
    await this.ctx.storage.put({ estado: this.estado, tokens: this.tokens, revancha: this.revancha, bot: this.bot });
  }

  async programarAlarma() {
    if (this.estado?.fase === "jugando") await this.ctx.storage.setAlarm(this.estado.finTurno + 250);
    else await this.ctx.storage.setAlarm(Date.now() + 24 * 3600 * 1000); // limpieza de salas viejas
  }

  conectados() {
    const c = [false, false];
    for (const ws of this.ctx.getWebSockets()) {
      const s = ws.deserializeAttachment()?.seat;
      if (s === 0 || s === 1) c[s] = true;
    }
    if (this.bot !== null) c[this.bot] = true;
    return c;
  }

  difundir(ev = []) {
    const conectados = this.conectados();
    for (const ws of this.ctx.getWebSockets()) {
      const s = ws.deserializeAttachment()?.seat ?? -1;
      const v = M.vista(this.estado, s, DB);
      v.conectados = conectados;
      v.revancha = this.revancha;
      v.ahora = Date.now();
      try { ws.send(JSON.stringify({ t: "estado", ev, v })); } catch {}
    }
    if (this.bot !== null && this.estado.fase === "jugando" && this.estado.turno === this.bot) this.turnoBot();
  }

  // El bot juega su turno acción por acción, con pausas para que se vea.
  async turnoBot() {
    if (this.botCorriendo) return;
    this.botCorriendo = true;
    try {
      await dormir(1300);
      for (let k = 0; k < 30; k++) {
        if (this.estado.fase !== "jugando" || this.estado.turno !== this.bot) return;
        let a = k === 29 ? { t: "fin" } : decidir(this.estado, this.bot, DB);
        let res = M.aplicar(this.estado, this.bot, a, DB, Date.now());
        if (res.error) { a = { t: "fin" }; res = M.aplicar(this.estado, this.bot, a, DB, Date.now()); }
        await this.guardar();
        await this.programarAlarma();
        this.botCorriendo = a.t !== "fin"; // al pasar el turno, difundir no debe re-entrar
        this.difundir(res.ev || []);
        if (a.t === "fin") return;
        this.botCorriendo = true;
        await dormir(a.t === "atacar" ? 1150 : 1450);
      }
    } finally {
      this.botCorriendo = false;
    }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 2000) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!this.estado) {
      this.estado = M.crearPartida(DB, crypto.getRandomValues(new Uint32Array(1))[0]);
    }
    const yo = ws.deserializeAttachment()?.seat ?? -1;

    if (msg.t === "hola") {
      let seat = this.tokens.findIndex((t) => t && t !== "BOT" && t === msg.token);
      const nombre = limpiarNombre(msg.nombre);
      // partida contra el bot: el primero en entrar lo pide, el bot ocupa el otro asiento
      if (msg.bot && this.estado.fase === "esperando" && !this.tokens[0] && !this.tokens[1] && nombre) {
        this.bot = 1;
        this.tokens[1] = "BOT";
        this.estado.j[1].nombre = "Bot";
      }
      if (seat < 0 && nombre && this.estado.fase === "esperando") {
        seat = this.tokens.findIndex((t) => !t);
        if (seat >= 0) {
          this.tokens[seat] = crypto.randomUUID();
          this.estado.j[seat].nombre = nombre;
        }
      }
      // mazo armado por el jugador (si no es válido, se arma uno al azar)
      if (seat >= 0 && this.estado.fase === "esperando") {
        const mazo = M.validarMazo(DB, HEROES, msg.mazo);
        this.estado.j[seat].mazoElegido = mazo;
        this.estado.j[seat].heroe = mazo ? mazo.heroe : null;
      }
      ws.serializeAttachment({ seat });
      if (seat >= 0) ws.send(JSON.stringify({ t: "token", token: this.tokens[seat], seat }));
      let ev = [];
      if (this.estado.fase === "esperando" && this.tokens[0] && this.tokens[1]) ev = M.empezar(this.estado, DB, Date.now(), HEROES);
      await this.guardar();
      await this.programarAlarma();
      this.difundir(ev);
      return;
    }

    if (yo < 0) return; // espectador

    if (msg.t === "revancha") {
      if (this.estado.fase !== "fin") return;
      this.revancha[yo] = true;
      if (this.bot !== null) this.revancha[this.bot] = true;
      let ev = [];
      if (this.revancha[0] && this.revancha[1]) {
        const antes = this.estado.j.map((p) => ({ nombre: p.nombre, mazoElegido: p.mazoElegido || null, heroe: p.mazoElegido?.heroe || null }));
        this.estado = M.crearPartida(DB, crypto.getRandomValues(new Uint32Array(1))[0]);
        antes.forEach((x, i) => Object.assign(this.estado.j[i], x));
        this.revancha = [false, false];
        ev = M.empezar(this.estado, DB, Date.now(), HEROES);
      }
      await this.guardar();
      await this.programarAlarma();
      this.difundir(ev);
      return;
    }

    const res = M.aplicar(this.estado, yo, msg, DB, Date.now());
    if (res.error) {
      ws.send(JSON.stringify({ t: "error", msg: res.error }));
      return;
    }
    await this.guardar();
    await this.programarAlarma();
    this.difundir(res.ev);
  }

  async webSocketClose(ws) {
    try { ws.close(); } catch {}
    if (this.estado) this.difundir([]);
  }

  async alarm() {
    if (!this.estado) return;
    if (this.estado.fase === "jugando") {
      const ev = M.tiempoAgotado(this.estado, DB, Date.now());
      if (ev) {
        await this.guardar();
        this.difundir(ev);
      }
      await this.programarAlarma();
      return;
    }
    // sala sin uso por un dia: se borra
    if (!this.ctx.getWebSockets().length) await this.ctx.storage.deleteAll();
    else await this.programarAlarma();
  }
}
