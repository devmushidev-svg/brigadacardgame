# Mecánicas de Puto Cartas

Registro vivo de todo lo que el juego sabe hacer. Si una carta nueva necesita algo que no está aquí, se agrega al motor (`src/motor.js`) y se anota en este archivo.

Nivel de poder: **absurdo a propósito**, como Hearthstone en sus peores (mejores) momentos.

Meta actual: **100 cartas**. Todos los personajes hasta ahora son hombres salvo los marcados ♀. Los hechizos (y las misiones) no tienen género.

## Reglas base

| Regla | Valor |
|---|---|
| Vida del héroe | 30 |
| Maná | sube 1 por turno, máximo 10 |
| Mano | máximo 10 (si robás con la mano llena, la carta se quema) |
| Mesa | máximo 7 esbirros por lado |
| Mazo | 20 cartas. Se arma en **Mis mazos** (héroe + cartas de su clase y neutrales; la misión no va, empieza sola en la mano). Sin mazo armado, uno al azar: 12 de clase + 8 neutrales |
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

- **Color de clase (`marco`):** como en Hearthstone, las cartas de clase usan el marco del color de su héroe (Tun = verde selva); las neutrales son de piedra gris y dicen "Neutral". La misión mantiene su marco dorado.
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

Campos: `id`, `nombre`, `coste`, `ataque`, `vida`, `texto`, `arte` (emoji o `/arte/x.png` en `public/arte/`), `clase`, `tribu`, `rareza` (`legendaria`), `token: true` (no entra al mazo; solo se invoca o se da), `arquetipo`, `genero` (`hombre`, `mujer` o `no_binario`; **toda carta de personaje lleva uno**, se pregunta al crearla; sale como ♂ ♀ ⚧ abajo de la carta), `etiquetas` (lista libre, ej. `["mujer"]`, para efectos que buscan cartas por etiqueta), `descuento` (`{ "por": "tribu_en_mesa", "tribu": "tun" }`: cuesta 1 menos por cada esbirro de esa tribu en la mesa, de los dos lados; `"lados": "propio"` solo cuenta los tuyos; `{ "por": "tribu_muertos", "tribu": "tun" }`: 1 menos por cada Tun que murió en la partida, de los dos lados), `entrada` (animación al entrar: `legendaria` —automática en legendarias— o `demonio`).

## Palabras clave (`claves`)

| clave | efecto |
|---|---|
| `provocar` | hay que atacarlo primero |
| `carga` | puede atacar el turno que entra |
| `escudo` | escudo divino: ignora el primer daño |
| `doble` | viento furioso: ataca dos veces |
| `no_ataca` | no puede atacar |
| `acometida` | puede atacar esbirros el turno que entra (a la cara recién el turno siguiente) |

## Disparadores

| campo | cuándo |
|---|---|
| `grito` | grito de batalla: al jugarlo desde la mano |
| `aliento` | último aliento: al morir |
| `fin_turno` | al final de cada turno de su dueño |
| `cuando_ataca_aliado` | `{ "tribu": "tun", "ataque": 1, "vida": 1 }`: cada vez que uno de tus esbirros de esa tribu ataca, gana esos stats antes del golpe |
| `al_recibir_dano` | cada vez que este esbirro recibe daño (aunque muera por ese golpe) |
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
| `invocar` | invoca N copias de `carta`; `lado`: propio, `enemigo` o `quien_roba`; `disparar: true` = cada uno se lanza contra un enemigo al azar; `disparar: "elegir"` = el jugador elige a quién lanza cada uno (ignora provocar); `azar: { "tribu": "tun" }` en vez de `carta` = invoca esbirros al azar de esa tribu |
| `destruir` | destruye un esbirro |
| `mana` | maná extra este turno |
| `dar_carta` | pone `carta` en tu mano |
| `global` | crea un efecto permanente con `disparador` y `efectos` |
| `robar_mano` | te robás N cartas de la mano rival que cumplan el `filtro` (`{ "genero": "mujer" }`, `{ "etiqueta": ... }` o `{ "tribu": ... }`); si no hay, no pasa nada |
| `descubrir` | como Hearthstone: muestra 3 cartas distintas del `filtro` (ej. tribu Tun) y te quedás con una; si se acaba el turno sin elegir, se elige al azar |
| `atraer_ataques` | tus otros esbirros (del `filtro`) atacan a esta carta, uno por uno, con choque normal |
| `repetir_jugados` | repite los gritos y últimos alientos de las cartas del `filtro` que jugaste esta partida, en orden (Coco Supremo). Como Shudderwock: los efectos salen de quien los repite, así que un "gana +3/+3" lo buffea a él |
| `moneda` | 50/50: aplica `cara` o `cruz` (listas de efectos) con animación de moneda |
| `pelea` | como Pelea de Hearthstone: todos los esbirros hacen parkour y solo uno al azar sobrevive |
| `activar` | si el esbirro elegido es de la tribu del `filtro` (Cruit), repite su grito de batalla y su último aliento |
| `transformar` | convierte a los esbirros del `objetivo` en `carta` (pierden buffs y claves; quedan en el mismo lugar y del mismo dueño) |
| `invocar_por_muertos` | invoca `carta` una vez por cada esbirro de la `tribu` que murió en la partida; cada uno que no cabe en la mesa da +1 de ataque o +1 de vida (al azar) a uno de tus esbirros de esa tribu al azar. En la mano, la carta (y Tun Mastermind) lleva un contador ☠ con los Tun muertos |
| `mejora_tribu` | por el resto de la partida, tus esbirros de esa `tribu` tienen +`ataque`/+`vida`: los que están en mesa, los de la mano y los que vengan (se ve en la placa del jugador) |
| `devorar` | destruye a tus otros esbirros (con `filtro` de tribu) y la carta gana +`ataque`/+`vida` por cada uno |

**Efecto visual (`fx`):** cualquier efecto puede llevar `"fx"` para que el cliente lo dibuje distinto:
- `"piedra"`: el esbirro tira una piedra en arco al objetivo y revienta en pedazos (Tun Puto)
- `"vomito"`: un chorro verde que sale del esbirro y salpica a todos los objetivos (Cruit Intolerante)
- `"devorar"`: los esbirros devorados vuelan girando hacia la carta, con gruñido demoníaco (Tun Satánico)

**Sonidos:** las cartas de Tun suenan a mono al jugarse; los Tun invocados hacen un "uh" corto. Una carta puede llevar `"sonido": "/sonidos/x.mp3"` (archivo en `public/sonidos/`) para usar un audio propio en vez del sintetizado.

**Por cada (`porCada`):** en un `buff`, multiplica los stats: `{ "por": "etiqueta_jugados", "etiqueta": "tarea" }` cuenta las cartas con esa etiqueta que jugaste esta partida (Cruit Excel). En la mano se ve "(llevás N)".

**Bonus (`bonus`):** `{ "por": "tribu_jugados", "tribu": "tun" }` suma a la `cantidad` 1 por cada carta de esa tribu que jugaste desde la mano esta partida (Tunita). En la mano se ve "(ahora: N)".

**Objetivos:**
- los elige el jugador con la flecha: `elegido`, `elegido_enemigo`, `elegido_esbirro`, `elegido_aliado`
- automáticos: `heroe_enemigo`, `heroe_propio`, `esbirro_enemigo_azar`, `esbirros_enemigos`, `todos_esbirros`, `otros_esbirros` (todos menos el que lo lanza), `aliado_azar`, `aliado_herido_azar` (tu héroe o un esbirro tuyo herido), `aliados` (tus otros esbirros), `todos_enemigos`, `enemigo_azar`, `yo`
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
| **Tun Maestro del Universo** (legendaria, recompensa) | 5 | 8/8 | Grito: invoca 5 Tun al azar (cualquier Tun del juego) y elegís contra quién se lanza cada uno | hecho |
| **Panamá** (legendaria) | 1 | 1/1 | Grito: por el resto de la partida, cada vez que un jugador robe, invoca un Tun para él | hecho |
| Tun Puto | 3 | 1/5 | Cada vez que muere un Tun (de cualquier lado), 1 de daño a un enemigo al azar | hecho |
| Tun Tung Sahur | 1 | 1/1 | Grito: invoca un Tun 1/1 | hecho |
| Tun Mujer ♀ | 5 | 2/8 | Grito: tus Tun la atacan. Cada vez que recibe daño, 2 de daño a un enemigo al azar | hecho |
| Tun Cool | 10 | 6/7 | Cuesta 1 menos por cada otro Tun en el campo (los dos lados) | hecho |
| Novia de Tun ♀ | 4 | 4/4 | Último aliento: tus Tun tienen +1 de ataque por el resto de la partida | hecho |
| Tun Mastermind | 25 | 6/3 | Acometida. 1 menos por cada Tun muerto en la partida. Grito: tus Tun tienen +1 de ataque por el resto de la partida | hecho |
| Comida (hechizo) | 3 | — | Invoca 4 Tun 1/1 | hecho |
| Plátano (hechizo) | 1 | — | +2/+2 y provocar a uno de tus Tun | hecho |
| Tuna (hechizo) | 2 | — | +1 de vida a tus Tun | hecho |
| Tunita (hechizo) | 2 | — | 1 de daño a un esbirro, +1 por cada Tun que jugaste esta partida | hecho |
| **Funeral de Tun** (hechizo legendario) | 10 | — | Un Tun Zombie por cada Tun muerto en la partida; cada uno que no cabe da +1 de ataque o de vida a un Tun al azar | hecho |
| Tun Zombie (ficha) | — | 1/1 | Lo invoca Funeral de Tun | hecho — **stats provisionales** |
| **Porque Me Monean** (legendaria) | 7 | 3/5 | Grito: convierte a todos los esbirros del rival en Tun 1/1 | hecho |
| Tun Amor (sin género) | 5 | 3/5 | Cada vez que uno de tus Tun ataca, gana +1/+1 | hecho |
| Choza de Monos | 4 | 0/8 | Al final de tu turno, invoca dos Tun | hecho |
| Tun Satánico | **5** | **3/3** | Grito: destruye a tus otros Tun y gana +2/+2 por cada uno | hecho — **coste y stats provisionales**, falta que Mario los defina |

## Neutrales

| Carta | Coste | Stats | Efecto | Estado |
|---|---|---|---|---|
| Tun Brawl Stars | 2 | 2/3 | — (tribu Tun: cuenta para la misión y Tun Puto) | hecho |
| Mascotas de Tun (hechizo) | 2 | — | Roba 2 cartas | hecho |
| Tun IA | 1 | 1/2 | Grito: descubre un Tun (tribu Tun) | hecho |
| Mauro Sosa | 2 | 2/3 | Grito: si el rival tiene una mujer en la mano, te la robás | hecho — roba cartas con `"genero": "mujer"` (todavía no hay ninguna) |

## Animaciones automáticas

- Legendarias: se oscurece la pantalla, aparecen grandes con rayos y caen de golpe a la mesa (onda expansiva + temblor). Tun Satánico usa la versión roja (`"entrada": "demonio"`).
- Efectos de fin de turno: el esbirro se levanta brillando con un círculo rúnico y su carta aparece al lado; lo que invoca sale volando desde él (igual con el poder de héroe y los gritos).
- Misión: medallón arriba del retrato del héroe con anillo de progreso; cada avance suena y brilla; al completarse hay fanfarria, el medallón se agranda y se muestra la recompensa.
- Robar de la mano: la carta cruza la pantalla de una mano a la otra.

## Clase Cruit

Diseño de Mario. Marco azul (provisional). Cruit es no binario: toda carta con su nombre lleva `"genero": "no_binario"` (⚧).

| Carta | Coste | Stats | Efecto | Estado |
|---|---|---|---|---|
| Héroe Cruit | — | 30 | Poder (1): invoca un Coco 1/1 con carga que muere al final del turno | hecho (retrato con fondo de leche) |
| Coco ⚧ (ficha, el hámster) | — | 1/1 | Carga. Muere al final de tu turno | hecho |
| Cruit Intolerante a la Lactosa ⚧ (tribu Cruit) | 2 | 1/3 | Grito: 1 de daño a todos los demás esbirros (vómito) | hecho |
| Lechero ♂ | 1 | 1/3 | Grito y último aliento: obtenés una Leche | hecho |
| Leche (hechizo) | 1 | — | +1/+1 a un esbirro; si es un Cruit, activa su grito y su último aliento | hecho |
| Nullscape (hechizo) | 4 | — | Todos los esbirros hacen parkour; solo uno al azar sobrevive | hecho |
| Cruit Excel ⚧ (tribu Cruit) | 5 | 2/2 | Grito: +3/+3 por cada Tarea que lanzaste esta partida | hecho |
| Tarea de la U (hechizo, etiqueta Tarea) | 1 | — | 2 de daño a tu héroe, roba una carta | hecho |
| **Coco Supremo** ⚧ (legendaria) | 9 | 7/5 | Grito: repite los gritos y últimos alientos de todos los Cruit que jugaste esta partida | hecho |
| Elliot ♂ (Forsaken) | 2 | 2/2 | Al final de tu turno, una pizza cura 3 a un aliado herido al azar | hecho |
| Chance ♂ (Forsaken, cuenta como Cruit para la Leche) | 3 | 3/3 | Grito: moneda. Cara: 6 de daño a un enemigo al azar. Cruz: 3 de daño a tu héroe | hecho |

Sin mazo armado, el héroe sale al azar.

## Pendiente de agregar al motor (ideas en discusión)

- auras ("mientras esté vivo, tus Tun tienen +2/+2")
- "al inicio de tu turno"
- "cada vez que invocás un Tun..."
- cartas que cuestan menos según la mesa
- transformar esbirros
- reinvocar los que murieron esta partida
