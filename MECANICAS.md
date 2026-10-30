# Mecánicas de Puto Cartas

Registro vivo de todo lo que el juego sabe hacer. Si una carta nueva necesita algo que no está aquí, se agrega al motor (`src/motor.js`) y se anota en este archivo.

Nivel de poder: **absurdo a propósito**, como Hearthstone en sus peores (mejores) momentos.

Meta actual: **100 cartas**. Todos los personajes hasta ahora son hombres salvo los marcados ♀. Los hechizos (y las misiones) no tienen género.

## Reglas base

| Regla | Valor |
|---|---|
| Vida del héroe | 50 |
| Maná | sube 1 por turno, máximo 10 |
| Mano | máximo 10 (si robás con la mano llena, la carta se quema) |
| Mesa | máximo 7 esbirros por lado |
| Mazo | 40 cartas. Se elige en el lobby o en **Mis mazos**: siempre hay un mazo **precargado** por héroe (su `mazoMeta` en `heroes`; no se borra, se puede copiar para editar) y los que arme cada uno (héroe + cartas de su clase y neutrales; la misión no va, empieza sola en la mano; se guardan en el navegador). Con "Al azar", héroe al azar con su mazo precargado. Sin mazo meta, uno al azar: 32 de clase + 8 neutrales |
| Copias | 2 por carta, **1 si es legendaria** |
| Mano inicial | el que empieza roba 3, el otro 4 + **La Moneda** (llega después del mulligan) |
| Mulligan | antes del primer turno cada uno elige qué cartas de su mano inicial cambiar: vuelven al mazo y se roban otras. La misión no se cambia. 40 segundos; si no elegís, te quedás con tu mano. El bot cambia las cartas de más de 3 de maná |
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
- **Poder de héroe:** una vez por turno; usa los mismos efectos que las cartas, y puede pedir objetivo. Con `etiquetas` cuenta como esas cartas (ej. `["tarea"]`).

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

Otros campos: `fusionar: true` (si ya hay uno igual en tu mesa se suma a ese; `porApilado` en un efecto lo multiplica por las fusionadas), `excluir: { "etiqueta": "programa" }` en un efecto (no puede elegir esos esbirros: a Cruit Excel no se le da Leche). Global `tareas_dobles` (Unislop): tus Tareas se lanzan una vez más.

Campos: `id`, `nombre`, `coste`, `ataque`, `vida`, `texto`, `arte` (emoji o `/arte/x.png` en `public/arte/`), `clase`, `tribu`, `rareza` (`legendaria`), `token: true` (no entra al mazo; solo se invoca o se da), `arquetipo`, `genero` (`hombre`, `mujer` o `no_binario`; **toda carta de personaje lleva uno**, se pregunta al crearla; sale como ♂ ♀ ⚧ abajo de la carta), `etiquetas` (lista libre, ej. `["mujer"]`, para efectos que buscan cartas por etiqueta), `descuento` (`{ "por": "tribu_en_mesa", "tribu": "tun" }`: cuesta 1 menos por cada esbirro de esa tribu en la mesa, de los dos lados; `"lados": "propio"` solo cuenta los tuyos; `{ "por": "tribu_muertos", "tribu": "tun" }`: 1 menos por cada Tun que murió en la partida, de los dos lados), `entrada` (animación al entrar: `legendaria` —automática en legendarias— o `demonio`).

## Palabras clave en el texto

En el texto de las cartas, las palabras clave salen en **negrita** y al ver la carta grande (o al pasar el mouse en PC) aparece abajo qué significa cada una. La lista con sus explicaciones está en `PALABRAS` al principio de `public/app.js`: Grito de batalla, Último aliento, Provocar, Carga, Acometida, Escudo divino, Viento furioso, No puede atacar, Descubre, Robar vida, Activar, Tarea y Misión. Si agregás una palabra clave nueva, sumala ahí.

## Tutorial

**Tutorial** (botón en el lobby): una partida guiada contra el bot. El jugador es Tun y empieza; las cartas salen en un orden fijo (`TUTORIAL` en `src/motor.js`) y el bot es Cruit con un mazo flojo y 12 de vida. No hay mulligan ni misión. Un globo en el medio de la mesa dice qué hacer y la carta, esbirro o botón que hay que usar brilla: tocar una carta de la mano para verla grande (en el tutorial también explica el maná, el ataque y la vida), jugar esbirros, tocar un esbirro del rival para verlo grande (en cualquier partida, un toque sobre un esbirro rival lo muestra en grande), poder de héroe (desde el segundo turno), hechizos, atacar y terminar turno. Al ganar ofrece jugar contra el bot de verdad.

**Reglas** (`/reglas`): la explicación en texto, en 9 pasos (objetivo, maná, cartas, jugar y atacar, poder de héroe, palabras clave, mulligan, misiones y reglas del mazo).

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
| `al_robarse` | (en la carta) se lanza sola cuando la robás: no va a la mano y robás otra (Caca, como las plagas del Rey Exánime) |
| `al_recibir_dano` | cada vez que este esbirro recibe daño (aunque muera por ese golpe) |
| `al_atacar` | cada vez que este esbirro ataca, antes del golpe (Tun Astrónomo) |
| `cuando_muere` | `{ "tribu": "tun", "efectos": [...] }`: cada vez que muere un esbirro de esa tribu (de cualquier lado) |
| efecto `global` | por el resto de la partida, aunque la carta muera: `al_robar` (Panamá, para quien roba) o `muere_tribu` con `tribu` (cada vez que muere uno de TUS esbirros de esa tribu: Tun Iguana) |

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
| `descubrir` | como Hearthstone: muestra 3 cartas distintas del `filtro` (ej. tribu Tun) y te quedás con una; si se acaba el turno sin elegir, se elige al azar. `cantidad: 2` = dos elecciones seguidas; `todas: true` también ofrece fichas y hechizos |
| `atraer_ataques` | tus otros esbirros (del `filtro`) atacan a esta carta, uno por uno, con choque normal |
| `repetir_jugados` | repite los gritos y últimos alientos de las cartas del `filtro` que jugaste esta partida, en orden (Coco Supremo). Como Shudderwock: los efectos salen de quien los repite, así que un "gana +3/+3" lo buffea a él |
| `barajar` | mete N copias de `carta` en lugares al azar del mazo (`lado: "enemigo"` = del rival) |
| `grito_extra` | el próximo grito de batalla de un esbirro del `filtro` que juegues se activa `cantidad` veces (Cruit Rage; se ve en la placa) |
| `rebajar` | una carta de tu mano del `filtro` al azar cuesta `cantidad` menos (se ve en verde en la mano) |
| `repartir` | daño de a 1 punto a enemigos vivos al azar (héroe o esbirros), `cantidad` veces; `"cantidad": "ataque"` usa el ataque actual de quien lo lanza (Cruit Baño; con Leche pega más, y si lo repite Coco Supremo usa el ataque de Coco) |
| `robar_vida` | daño que se **suma** a la vida de tu héroe (puede pasar de la vida máxima y la sube); cada esbirro tuyo con `duplica_robo_de` igual a la carta que roba lo duplica (Cruit Vampiro: tus Cruit Sangre roban el doble; dos Vampiros, el cuádruple) |
| `dar_azar` | te da N cartas distintas al azar de las que cumplen el `filtro` (Unislop) |
| `moneda` | 50/50: aplica `cara` o `cruz` (listas de efectos) con animación de moneda |
| `pelea` | como Pelea de Hearthstone: todos los esbirros hacen parkour y solo uno al azar sobrevive |
| `activar` | si el esbirro es de la tribu del `filtro` (Cruit), repite su grito de batalla y su último aliento. Un esbirro que ya se está activando no se vuelve a activar (evita bucles) |
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
- automáticos: `heroe_enemigo`, `heroe_propio`, `esbirro_enemigo_azar`, `esbirros_enemigos`, `todos_esbirros`, `otros_esbirros` (todos menos el que lo lanza), `aliado_azar`, `aliado_herido_azar` (tu héroe o un esbirro tuyo herido), `aliados` (tus otros esbirros), `todos_enemigos`, `enemigo_azar`, `enemigo_menos_vida`, `yo`
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
| **Tun the Awarded** (misión, legendaria) | 1 | — | Invoca 20 Tun (cuenta todo, incluido el poder) → Tun Maestro del Universo | hecho |
| **Tun Maestro del Universo** (legendaria, recompensa) | 5 | 8/8 | Grito: llena tu mesa de Tun al azar (cualquier Tun del juego) y elegís contra quién se lanza cada uno | hecho |
| **Panamá** (legendaria) | 1 | 1/1 | Grito: por el resto de la partida, cada vez que un jugador robe, invoca un Tun para él | hecho |
| Tun Puto | 3 | 1/5 | Cada vez que muere un Tun (de cualquier lado), 1 de daño a un enemigo al azar | hecho |
| Tun Tung Sahur | 1 | 1/1 | Grito: invoca un Tun 1/1 | hecho |
| Tun Mujer ♀ | 5 | 2/8 | Grito: transforma a tus otros esbirros en Tun Puto | hecho |
| Tun Cool | 10 | 6/7 | Cuesta 1 menos por cada otro Tun en el campo (los dos lados). Cada vez que recibe daño, invoca un Tun 1/1 | hecho |
| Novia de Tun ♀ | 3 | 2/1 | Último aliento: invoca 2 Tun y tus Tun tienen +1 de ataque por el resto de la partida | hecho |
| Tun Mastermind | 15 | 6/3 | Acometida. 1 menos por cada Tun muerto en la partida. Grito: invoca 3 Tun y tus Tun tienen +1 de ataque por el resto de la partida | hecho |
| Comida (hechizo) | 3 | — | Llena tu mesa de Tun 1/1 | hecho |
| Plátano (hechizo) | 1 | — | +2/+2 y provocar a uno de tus Tun | hecho |
| Tuna (hechizo) | 2 | — | +1 de vida a tus Tun | hecho |
| Tunita (hechizo) | 2 | — | 1 de daño a un esbirro, +1 por cada Tun que jugaste esta partida | hecho |
| **Funeral de Tun** (hechizo legendario) | 10 | — | Un Tun Zombie por cada Tun muerto en la partida; cada uno que no cabe da +1 de ataque o de vida a un Tun al azar | hecho |
| Tun Zombie (ficha) | — | 1/1 | Lo invoca Funeral de Tun | hecho — **stats provisionales** |
| **Porque Me Monean** (legendaria) | 6 | 3/5 | Grito: convierte a todos los esbirros del rival en Tun 1/1 | hecho |
| Tun Amor (sin género) | 5 | 3/5 | Cada vez que uno de tus Tun ataca, gana +1/+1 | hecho |
| Choza de Monos | 3 | 0/6 | Al final de tu turno, invoca dos Tun | hecho |
| **Tun Iguana** (legendaria) | 5 | 5/5 | Grito: por el resto de la partida, cada vez que muere uno de tus Tun, invoca un Tun Zombie que ataca a un enemigo al azar | hecho — falta imagen (🦎) y confirmar género |
| Tun Astrónomo | 3 | 2/4 | Cada vez que ataca, un Tun de tu mano al azar cuesta 2 menos | hecho — falta imagen (🔭); coste y stats propuestos, falta confirmar género |
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
| Héroe Cruit | — | 50 | Poder (1) "Hacer la tarea": recibís 2 de daño y robás una carta. Cuenta como Tarea (Cruit Excel la cuenta; con Unislop se lanza dos veces) | hecho (retrato con fondo de leche) |
| Coco ⚧ (ficha, el hámster) | — | 1/1 | Carga. Muere al final de tu turno | hecho |
| Cruit Intolerante a la Lactosa ⚧ (tribu Cruit) | 2 | 1/3 | Grito y último aliento: 2 de daño a todos los demás esbirros (vómito) | hecho |
| Lechero ♂ | 1 | 1/1 | Grito: obtenés una Leche | hecho |
| Leche (hechizo) | 1 | — | +1/+1 a un esbirro; si es un Cruit, activa su grito y su último aliento | hecho |
| Nullscape (hechizo) | 4 | — | Todos los esbirros hacen parkour; solo uno al azar sobrevive | hecho |
| Cruit Excel ⚧ (tribu Cruit, etiqueta programa) | 5 | 2/2 | Grito: +1/+1 por cada Tarea que lanzaste esta partida. No se le puede dar Leche | hecho |
| Tarea de la U (hechizo, etiqueta Tarea) | 1 | — | Robás una carta y obtenés una tarea universitaria al azar | hecho |
| **Coco Supremo** ⚧ (legendaria) | 9 | 7/5 | Grito: repite los gritos y últimos alientos de los Cruit que jugaste esta partida. Orden: primero el resto, después los que crecen por cada cosa (Excel) y al último los que pegan según su ataque (Baño) | hecho |
| Estreñido Cruit ⚧ | 1 | 1/2 | Grito y último aliento: mete 2 Cacas en el mazo del rival (al robarlas: 2 de daño y roba otra) | hecho |
| Cruit Sangre ⚧ | 2 | 2/2 | Se fusiona con tus otros Cruit Sangre (suma stats, ×N en la carta). Al final de tu turno, roba 1 de vida por cada Sangre fusionada al enemigo con menos vida | hecho |
| Cruit Vampiro ⚧ | 5 | 3/3 | Tus Cruit Sangre roban el doble de vida. Grito: invoca 2 Cruit Sangre (se fusionan en una, con animación) | hecho |
| Caca (ficha) | 0 | — | Se lanza al robarla: 2 de daño a quien la roba y roba otra | hecho |
| Cruit Tostadora ⚧ | 1 | 1/2 | Grito: robás una carta | hecho |
| Cruit Baño ⚧ | 2 | 4/2 | Grito: inflige daño igual a su ataque, repartido al azar entre todos los enemigos (chorros de agua) | hecho |
| **Cruit Vaca** ⚧ (legendaria, tribu Vaca: no cuenta como Cruit) | 4 | 3/4 | Grito: una Leche a cada uno de tus otros esbirros (+1/+1 y activa a los Cruit) | hecho |
| **Cruit Verity** ⚧ (legendaria) | 3 | 3/1 | Último aliento: invoca a Verity 5/5 | hecho |
| Verity ⚧ (ficha, forma monstruosa) | 5 | 5/5 | — | hecho |
| **Unislop** (legendaria) | 4 | 3/3 | Grito: obtenés 3 tareas universitarias distintas al azar. Por el resto de la partida, tus Tareas se lanzan dos veces | hecho — falta género |
| Escuela Alumnos | 2 | 2/2 | Grito: descubre dos tareas universitarias | hecho — falta imagen (🏫); coste propuesto |
| Cruit Rage (hechizo) | 2 | — | El próximo grito de batalla de un Cruit que juegues se activa 3 veces | hecho — falta imagen (😡) |
| Elliot Cruit ⚧ (tribu Cruit, Forsaken) | 2 | 2/2 | Al final de tu turno, una pizza cura 3 a un aliado herido al azar | hecho |
| Chance Cruit ⚧ (tribu Cruit, Forsaken) | 3 | 3/3 | Grito: moneda. Cara: 6 de daño a un enemigo al azar. Cruz: 3 de daño a tu héroe | hecho |

Sin mazo armado, el héroe sale al azar.

## Mazos meta

**Tun (40):** todas las cartas que puede usar Tun, al máximo de copias (hoy son justo 40).

**Cruit (40):** todas las cartas que puede usar Cruit menos los dos Nullscape.

Con los mazos de 20, bot contra bot, Cruit le ganaba a Tun ~68% (era ~95% antes de los nerfs a Estreñido, Cruit Baño y Cruit Sangre y el buff a Novia de Tun). Con los mazos de 30 y mulligan (Lechero 1/1, Cruit Vaca fuera de la tribu, Cruit Verity 3 de maná con Verity 5/5, Cruit Baño 4/2 de 2 de maná que reparte su ataque, Novia de Tun 3 de maná 2/1 que al morir invoca 2 Tun, Intolerante y Estreñido también al morir), Cruit gana ~46%. Con 50 de vida y los cambios a Tun (Tun Mujer, Mastermind, Porque Me Monean, Choza, misión de 20), ~41%.

### Tareas universitarias (fichas de Unislop, etiqueta Tarea: cuentan para Cruit Excel)

| Tarea | Coste | Efecto |
|---|---|---|
| Ensayo 📝 | 1 | Robás 2 cartas |
| Exposición 🎤 | 2 | Invoca 2 Cruit al azar |
| Examen Sorpresa ❗ | 1 | Destruye un esbirro |
| Proyecto Grupal 👥 | 2 | +2/+2 a tus esbirros |
| Laboratorio 🧪 | 2 | Obtenés 2 Leches |
| Tesis 📚 | 3 | 2 de daño a tu héroe y 6 de daño a un enemigo |
| Hoja de Cálculo 📊 | 2 | +3/+3 a un esbirro |
| Desvelada ☕ | 0 | +2 de maná este turno |

## Pendiente de agregar al motor (ideas en discusión)

- auras ("mientras esté vivo, tus Tun tienen +2/+2")
- "al inicio de tu turno"
- "cada vez que invocás un Tun..."
- cartas que cuestan menos según la mesa
- transformar esbirros
- reinvocar los que murieron esta partida

Con 50 de vida y mazos de 40, bot contra bot: Cruit gana ~45% con el poder del Coco y ~48% con "Hacer la tarea".
