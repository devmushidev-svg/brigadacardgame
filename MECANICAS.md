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
| Mazo | 20 cartas: 12 de la clase del héroe + 8 neutrales, al azar. Si no hay neutrales (como ahora), se completa repitiendo las cartas de clase no legendarias |
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

## Imágenes

Cada carta, héroe o poder puede usar una imagen en vez de emoji:

1. Guardá la imagen en `public/arte/` con el id de la carta, por ejemplo `public/arte/panama.png`.
2. En `src/cartas.json` poné `"arte": "/arte/panama.png"`.

Recomendado: PNG o WEBP cuadrado de 512×512, con el personaje centrado, porque se recorta en óvalo (esbirros) o en arco (héroes). Sin imagen se usa el emoji.

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
| `cuando_muere` | `{ "tribu": "tun", "efectos": [...] }`: cada vez que muere un esbirro de esa tribu (de cualquier lado) |
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
| `devorar` | destruye a tus otros esbirros (con `filtro` de tribu) y la carta gana +`ataque`/+`vida` por cada uno |

**Efecto visual (`fx`):** cualquier efecto puede llevar `"fx"` para que el cliente lo dibuje distinto:
- `"piedra"`: el esbirro tira una piedra en arco al objetivo y revienta en pedazos (Tun Puto)
- `"devorar"`: los esbirros devorados vuelan girando hacia la carta, con gruñido demoníaco (Tun Satánico)

**Sonidos:** las cartas de Tun suenan a mono al jugarse; los Tun invocados hacen un "uh" corto. Una carta puede llevar `"sonido": "/sonidos/x.mp3"` (archivo en `public/sonidos/`) para usar un audio propio en vez del sintetizado.

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

| Carta | Coste | Stats | Efecto | Estado |
|---|---|---|---|---|
| Héroe Tun | — | 30 | Poder (1): invoca un Tun 1/1 | hecho |
| Tun (ficha) | 1 | 1/1 | tribu Tun | hecho |
| **Tun the Awarded** (misión, legendaria) | 1 | — | Invoca 15 Tun (cuenta todo, incluido el poder) → Tun Maestro del Universo | hecho |
| **Tun Maestro del Universo** (legendaria, recompensa) | 5 | 8/8 | Grito: invoca 5 Tun y cada uno se lanza contra un enemigo al azar | hecho |
| **Panamá** (legendaria) | 1 | 1/1 | Grito: por el resto de la partida, cada vez que un jugador robe, invoca un Tun para él | hecho |
| Tun Puto | 3 | 1/5 | Cada vez que muere un Tun (de cualquier lado), 1 de daño a un enemigo al azar | hecho |
| Tun Brawl Stars | 2 | 2/3 | — | hecho |
| Choza de Monos | 4 | 0/8 | Al final de tu turno, invoca dos Tun | hecho |
| Tun Satánico | **5** | **3/3** | Grito: destruye a tus otros Tun y gana +2/+2 por cada uno | hecho — **coste y stats provisionales**, falta que Mario los defina |

## Pendiente de agregar al motor (ideas en discusión)

- auras ("mientras esté vivo, tus Tun tienen +2/+2")
- "al inicio de tu turno"
- "cada vez que invocás un Tun..."
- cartas que cuestan menos según la mesa
- transformar esbirros
- reinvocar los que murieron esta partida
