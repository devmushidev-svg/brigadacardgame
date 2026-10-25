# Cómo hacer cartas

Las cartas viven en `src/cartas.json`. Cada carta es un objeto así:

```json
{ "id": "portero", "nombre": "Portero", "tipo": "esbirro", "coste": 2, "ataque": 1, "vida": 4,
  "claves": ["provocar"], "arte": "🚪", "arquetipo": "Oficina", "texto": "Provocar." }
```

| campo | qué es |
|---|---|
| `id` | identificador único, sin espacios |
| `tipo` | `esbirro` o `hechizo` |
| `coste`, `ataque`, `vida` | números (los hechizos no llevan ataque/vida) |
| `claves` | `provocar`, `carga`, `escudo` (escudo divino), `doble` (viento furioso), `no_ataca` |
| `arte` | un emoji, o la ruta a una imagen (`/arte/portero.png` dentro de `public/arte/`) |
| `texto` | lo que se lee en la carta (no afecta las reglas) |
| `grito` | efectos al jugar el esbirro (grito de batalla) |
| `aliento` | efectos al morir (último aliento) |
| `efectos` | efectos de un hechizo |
| `token: true` | no entra a los mazos (cartas que solo se invocan) |

## Efectos

```json
{ "tipo": "dano", "objetivo": "elegido", "cantidad": 2 }
```

`tipo`: `dano`, `curar`, `robar`, `buff` (con `ataque`, `vida` y opcional `provocar`/`escudo`), `invocar` (con `carta`), `destruir`, `mana`.

`objetivo`:
- los elige el jugador con la flecha: `elegido`, `elegido_enemigo`, `elegido_esbirro`, `elegido_aliado`
- automáticos: `heroe_enemigo`, `heroe_propio`, `esbirro_enemigo_azar`, `esbirros_enemigos`, `todos_esbirros`, `aliado_azar`, `aliados`, `todos_enemigos`, `yo`

Si una carta necesita algo que no está aquí, se agrega al motor (`src/motor.js`).
