# Mecánicas de Puto Cartas

Registro vivo de todo lo que el juego sabe hacer. Si una carta nueva necesita algo que no está aquí, se agrega al motor (`src/motor.js`) y se anota en este archivo.

Nivel de poder: **absurdo a propósito**, como Hearthstone en sus peores (mejores) momentos.

## Reglas base

| Regla | Valor |
|---|---|
| Vida del héroe | 30 |
| Maná | sube 1 por turno, máximo 10 |
| Mano | máximo 10 (si robás con la mano llena, la carta se quema) |
| Mesa | máximo 7 esbirros por lado |
| Mazo | 20 cartas: 12 de la clase del héroe + 8 neutrales, al azar |
| Copias | 2 por carta, **1 si es legendaria** |
| Mano inicial | el que empieza roba 3, el otro 4 + **La Moneda** |
| Misión | la misión de tu clase siempre empieza en tu mano |
| Fatiga | robar sin cartas hace 1, luego 2, 3... de daño |
| Tiempo de turno | 75 segundos |

## Héroes

Se definen en `heroes` dentro de `src/cartas.json`:

```json
{ "id": "tun", "nombre": "Tun", "arte": "🧍", "clase": "tun",
  "poder": { "nombre": "Llamar a otro Tun", "coste": 1, "texto": "Invoca un Tun 1/1.",
             "efectos": [{ "tipo": "invocar", "carta": "tun", "cantidad": 1 }] } }
```

- **Poder de héroe:** una vez por turno; usa los mismos efectos que las cartas, y puede pedir objetivo.

## Tipos de carta

| tipo | qué hace |
|---|---|
| `esbirro` | entra a la mesa |
| `hechizo` | aplica `efectos` y se va |
| `mision` | queda activa con un contador; al cumplirse aplica su `recompensa` |

Campos: `id`, `nombre`, `coste`, `ataque`, `vida`, `texto`, `arte` (emoji o `/arte/x.png` en `public/arte/`), `clase`, `tribu`, `rareza` (`legendaria`), `token: true` (no entra al mazo; solo se invoca o se da), `arquetipo`.

## Palabras clave (`claves`)

| clave | efecto |
|---|---|
| `provocar` | hay que atacarlo primero |
| `carga` | puede atacar el turno que entra |
| `escudo` | escudo divino: ignora el primer daño |
| `doble` | viento furioso: ataca dos veces |
| `no_ataca` | no puede atacar |

## Disparadores

| campo | cuándo |
|---|---|
| `grito` | grito de batalla: al jugarlo desde la mano |
| `aliento` | último aliento: al morir |
| `fin_turno` | al final de cada turno de su dueño |
| efecto `global` | por el resto de la partida, aunque la carta muera (ej. `al_robar`) |

## Efectos

`{ "tipo": "...", "objetivo": "...", "cantidad": N }`

| tipo | qué hace |
|---|---|
| `dano` | daño |
| `curar` | cura sin pasar la vida máxima |
| `robar` | roba N cartas |
| `buff` | +`ataque`/+`vida`; opcional `provocar`, `escudo`, `carga` |
| `invocar` | invoca N copias de `carta`; `lado`: propio, `enemigo` o `quien_roba`; `disparar: true` = cada uno se lanza contra un enemigo al azar |
| `destruir` | destruye un esbirro |
| `mana` | maná extra este turno |
| `dar_carta` | pone `carta` en tu mano |
| `global` | crea un efecto permanente con `disparador` y `efectos` |

**Objetivos:**
- los elige el jugador con la flecha: `elegido`, `elegido_enemigo`, `elegido_esbirro`, `elegido_aliado`
- automáticos: `heroe_enemigo`, `heroe_propio`, `esbirro_enemigo_azar`, `esbirros_enemigos`, `todos_esbirros`, `aliado_azar`, `aliados` (tus otros esbirros), `todos_enemigos`, `enemigo_azar`, `yo`
- `filtro: { "tribu": "tun" }` limita a esbirros de esa tribu

## Misiones

```json
"mision": { "contar": "invocar_tribu", "tribu": "tun", "meta": 15,
            "recompensa": [{ "tipo": "dar_carta", "carta": "tun_maestro" }] }
```

`contar`: `invocar_tribu` (cualquier invocación cuenta, incluido el poder de héroe) o `jugar_tribu` (solo cartas jugadas desde la mano).

## Clase Tun

Diseño de Mario. Arquetipo: paladín molesto — llenar la mesa de Tun, buffearlos y estorbar.

| Carta | Estado |
|---|---|
| Héroe Tun — poder 1 maná: invoca un Tun 1/1 | hecho |
| Tun (ficha) 1/1, tribu Tun | hecho |
| **Tun the Awarded** (misión, legendaria, 1): invoca 15 Tun → Tun Maestro del Universo | hecho |
| **Tun Maestro del Universo** (5, 8/8, legendaria): Grito: invoca 5 Tun y dispáralos a los enemigos | hecho |
| **Panamá** (1, 1/1, legendaria): Grito: por el resto de la partida, cada vez que un jugador robe, invoca un Tun para él | hecho |
| Tun Bebé, Tun Molesto, Primo de Tun, Junta de Tuns, Bendición de Tun, Tun Motivador, Tun Pesado, Tun Infinito | provisionales (propuesta de Claude, se reemplazan por las de Mario) |

## Pendiente de agregar al motor (ideas en discusión)

- auras ("mientras esté vivo, tus Tun tienen +2/+2")
- "al inicio de tu turno"
- "cada vez que invocás un Tun..."
- cartas que cuestan menos según la mesa
- transformar esbirros
- reinvocar los que murieron esta partida
