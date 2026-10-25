// Worker: sirve la página y manda cada partida a su Durable Object.
import { DurableObject } from "cloudflare:workers";
import datos from "./cartas.json";
import { crearPartida, empezar, aplicar, tiempoAgotado, vista } from "./motor.js";

const DB = Object.fromEntries(datos.cartas.map((c) => [c.id, c]));
const ID_OK = /^[a-z0-9]{6,16}$/;

function idNuevo() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(b, (x) => abc[x % abc.length]).join("");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/crear" && req.method === "POST") {
      return Response.json({ id: idNuevo() });
    }
    if (url.pathname === "/api/cartas") {
      return Response.json(datos.cartas, { headers: { "cache-control": "public, max-age=60" } });
    }
    const ws = url.pathname.match(/^\/ws\/([a-z0-9]+)$/);
    if (ws) {
      if (!ID_OK.test(ws[1])) return new Response("partida invalida", { status: 400 });
      if (req.headers.get("Upgrade") !== "websocket") return new Response("se esperaba websocket", { status: 426 });
      return env.PARTIDAS.get(env.PARTIDAS.idFromName(ws[1])).fetch(req);
    }
    // /p/<id> y /cartas son la misma página (la app lee la ruta)
    if (/^\/p\/[a-z0-9]+$/.test(url.pathname) || url.pathname === "/cartas") {
      return env.ASSETS.fetch(new Request(new URL("/", url), req));
    }
    return env.ASSETS.fetch(req);
  },
};

// Una instancia por partida. Usa la API de hibernación: si nadie hace nada, no cobra.
export class Partida extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.estado = null;
    this.asientos = null; // [{token, nombre}] x2
    ctx.blockConcurrencyWhile(async () => {
      this.estado = (await ctx.storage.get("estado")) || null;
      this.asientos = (await ctx.storage.get("asientos")) || [null, null];
    });
  }

  async fetch(req) {
    const par = new WebSocketPair();
    this.ctx.acceptWebSocket(par[1]);
    par[1].serializeAttachment({ seat: -1 });
    return new Response(null, { status: 101, webSocket: par[0] });
  }

  async guardar() {
    await this.ctx.storage.put({ estado: this.estado, asientos: this.asientos });
  }

  seatDe(ws) {
    return (ws.deserializeAttachment() || {}).seat ?? -1;
  }

  enviar(ws, msg) {
    try { ws.send(JSON.stringify(msg)); } catch {}
  }

  difundir(ev = []) {
    for (const ws of this.ctx.getWebSockets()) {
      const seat = this.seatDe(ws);
      this.enviar(ws, {
        t: "estado",
        ev,
        asientos: this.asientos.map((a) => (a ? a.nombre : null)),
        estado: this.estado ? vista(this.estado, seat) : null,
        yo: seat,
      });
    }
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (typeof msg !== "object" || !msg) return;
    const ahora = Date.now();

    if (msg.t === "hola") {
      const token = String(msg.token || "").slice(0, 64);
      const nombre = String(msg.nombre || "").trim().slice(0, 20) || "anonimo";
      let seat = this.asientos.findIndex((a) => a && token && a.token === token);
      if (seat < 0) {
        seat = this.asientos.findIndex((a) => !a);
        if (seat >= 0) {
          const nuevo = crypto.randomUUID();
          this.asientos[seat] = { token: nuevo, nombre };
          this.enviar(ws, { t: "token", token: nuevo });
        }
      }
      ws.serializeAttachment({ seat });
      if (!this.estado) this.estado = crearPartida(DB, crypto.getRandomValues(new Uint32Array(1))[0]);
      for (const s of [0, 1]) if (this.asientos[s]) this.estado.j[s].nombre = this.asientos[s].nombre;
      let ev = [];
      if (this.estado.fase === "esperando" && this.asientos[0] && this.asientos[1]) {
        ev = empezar(this.estado, DB, ahora);
        await this.ctx.storage.setAlarm(this.estado.finTurno);
      }
      await this.guardar();
      this.difundir(ev);
      return;
    }

    const seat = this.seatDe(ws);
    if (seat < 0 || !this.estado) return;

    if (msg.t === "revancha") {
      if (this.estado.fase !== "fin") return;
      this.estado.revancha = [...new Set([...(this.estado.revancha || []), seat])];
      let ev = [];
      if (this.estado.revancha.length === 2) {
        this.estado = crearPartida(DB, crypto.getRandomValues(new Uint32Array(1))[0]);
        for (const s of [0, 1]) this.estado.j[s].nombre = this.asientos[s].nombre;
        ev = empezar(this.estado, DB, ahora);
        await this.ctx.storage.setAlarm(this.estado.finTurno);
      }
      await this.guardar();
      this.difundir(ev);
      return;
    }

    const r = aplicar(this.estado, seat, msg, DB, ahora);
    if (r.error) {
      this.enviar(ws, { t: "error", msg: r.error });
      return;
    }
    if (this.estado.fase === "jugando") await this.ctx.storage.setAlarm(this.estado.finTurno);
    await this.guardar();
    this.difundir(r.ev);
  }

  async alarm() {
    if (!this.estado) return;
    const ev = tiempoAgotado(this.estado, DB, Date.now());
    if (ev) {
      await this.guardar();
      this.difundir(ev);
    }
    if (this.estado.fase === "jugando") await this.ctx.storage.setAlarm(this.estado.finTurno);
  }

  async webSocketClose(ws) {
    try { ws.close(); } catch {}
  }
}
