# brigadacardgame

Juego de cartas 1vs1 tipo Hearthstone, en Cloudflare Workers + Durable Objects (una sala por partida).

- `src/motor.js` reglas del juego (el servidor es la autoridad)
- `src/worker.js` servidor: crea partidas, websockets, tiempo de turno
- `src/cartas.json` las cartas (ver `CARTAS.md`)
- `public/` la página

Probar en local: `npm install && npm run dev`. Pruebas de reglas: `npm test`.
