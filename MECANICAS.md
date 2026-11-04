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
| `arma` | se le equipa al héroe (`ataque`, `durabilidad`): ataca una vez por turno, cada ataque gasta un uso, recibe el golpe de vuelta de los esbirros; `al_atacar` en el arma = "cada vez que tu héroe ataca" |

**Cartas relacionadas:** al ver una carta en grande (o en la vista previa de PC) salen al lado las cartas a las que hace referencia: lo que invoca, da, mete en el mazo o transforma, la recompensa de una misión, los apéndices de un colosal, las opciones de "elegí una", y las piezas de la unión del PutoVC. Se calcula solo, mirando los campos `carta` de sus efectos.

Más campos: `colosal: { carta, cantidad }` (entra con apéndices a los costados; si el apéndice tiene `reemplazo: true`, lo que no entra queda de reserva y cada uno que muere es reemplazado), clave `robo_vida` (el daño que hace al pelear se suma a la vida del héroe), efecto `esconder` (se esconde en una carta al azar de la mano del rival; al jugarla sale para su dueño).

Otros campos: `fusionar: true` (si ya hay uno igual en tu mesa se suma a ese; `porApilado` en un efecto lo multiplica por las fusionadas), `excluir: { "etiqueta": "programa" }` en un efecto (no puede elegir esos esbirros: a Cruit Excel no se le da Leche). Global `tareas_dobles` (Unislop): tus Tareas se lanzan una vez más.

Campos: `id`, `nombre`, `coste`, `ataque`, `vida`, `texto`, `arte` (emoji o `/arte/x.png` en `public/arte/`), `clase`, `tribu`, `rareza` (`legendaria`), `token: true` (no entra al mazo; solo se invoca o se da), `arquetipo`, `genero` (`hombre`, `mujer` o `no_binario`; **toda carta de personaje lleva uno**, se pregunta al crearla; sale como ♂ ♀ abajo de la carta), `etiquetas` (lista libre, ej. `["mujer"]`, para efectos que buscan cartas por etiqueta), `descuento` (`{ "por": "tribu_en_mesa", "tribu": "tun" }`: cuesta 1 menos por cada esbirro de esa tribu en la mesa, de los dos lados; `"lados": "propio"` solo cuenta los tuyos; `{ "por": "tribu_muertos", "tribu": "tun" }`: 1 menos por cada Tun que murió en la partida, de los dos lados), `entrada` (animación al entrar: `legendaria` —automática en legendarias— o `demonio`).

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
| `al_lanzar_hechizo` | cada vez que lanzás un hechizo, mientras este esbirro esté en tu mesa (Mossad Strongest Agent) |
| `al_invocar` | cada vez que el esbirro entra a la mesa, se juegue de la mano o lo invoque otra carta (los músicos de Folklore) |
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
| `descubrir` | como Hearthstone: muestra 3 cartas distintas del `filtro` (ej. tribu Tun) y te quedás con una; si se acaba el turno sin elegir, se elige al azar. `cantidad: 2` = dos elecciones seguidas; `todas: true` también ofrece fichas y hechizos | Con `filtro: { "tipo": "hechizo" }` ofrece hechizos (sin fichas); `deMiClase: true` solo de tu clase o neutrales (si no hay 3, de todas); `rebaja: N` = la carta descubierta cuesta N menos.
| `atraer_ataques` | tus otros esbirros (del `filtro`) atacan a esta carta, uno por uno, con choque normal |
| `repetir_jugados` | repite los gritos y últimos alientos de las cartas del `filtro` que jugaste esta partida, en orden (Coco Supremo). Como Shudderwock: los efectos salen de quien los repite, así que un "gana +3/+3" lo buffea a él |
| `barajar` | mete N copias de `carta` en lugares al azar del mazo (`lado: "enemigo"` = del rival) |
| `grito_extra` | el próximo grito de batalla de un esbirro del `filtro` que juegues se activa `cantidad` veces (Cruit Rage; se ve en la placa) |
| `rebajar` | una carta de tu mano del `filtro` al azar cuesta `cantidad` menos (se ve en verde en la mano) |
| `robar_filtro` | robás de tu mazo N cartas que cumplan el `filtro` (ej. `{ "tipo": "hechizo" }`), al azar entre las que queden |
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

**Sonidos:** cada carta tiene su propio sonido generado (una melodía corta que sale de su id, distinta para cada carta) al jugarse, al atacar y al morir; las legendarias suman un arpegio y un acorde final. El timbre depende de la clase: Tun chilla (y los esbirros de Tun suman su grito de mono), Cruit es suave, las neutrales varían. Los Tun 1/1 invocados hacen un "uh" corto. Como en Hearthstone, cada carta puede tener audios propios para tres momentos (archivos en `public/sonidos/`):

```json
"sonidos": { "jugar": "/sonidos/tun_puto_jugar.mp3", "ataque": "/sonidos/tun_puto_ataque.mp3", "muere": "/sonidos/tun_puto_muere.mp3" }
```

Cualquiera de los tres es opcional; si falta, suena el sintetizado. `"sonido"` suelto sigue valiendo para el de jugarla. Sirve para esbirros, hechizos y armas.

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

Serie de misiones: en vez de `meta` y `recompensa`, `etapas: [{ meta, recompensa }, ...]`; cada etapa da su recompensa y la meta pasa a la siguiente; con `carta` en la etapa, la misión cambia a esa carta (como las partes de las series de Hearthstone: imagen y texto propios). `contar: "scrobble"` cuenta los hechizos y las cartas con etiqueta `musica` jugadas.

`contar`: `invocar_tribu` (cualquier invocación cuenta, incluido el poder de héroe) o `jugar_tribu` (solo cartas jugadas desde la mano).

## Clase Tun

Diseño de Mario. Arquetipo: paladín molesto — llenar la mesa de Tun, buffearlos y estorbar.

| Carta | Coste | Stats | Efecto | Estado |
|---|---|---|---|---|
| Héroe Tun | — | 30 | Poder (1): invoca un Tun 1/1 | hecho |
| Tun (ficha) | 1 | 1/1 | tribu Tun | hecho |
| **Tun the Awarded** (misión, legendaria) | 1 | — | Invoca 20 Tun (cuenta todo, incluido el poder) → Tun Maestro del Universo | hecho |
| **Tun Maestro del Universo** (legendaria, recompensa) | 5 | 8/8 | Grito: llena tu mesa de Tun al azar (cualquier Tun del juego) y elegís contra quién se lanza cada uno | hecho |
| **Panamá** (legendaria) | 1 | 1/1 | Al inicio de la partida (si está en tu mazo): por el resto de la partida, cada vez que un jugador robe, invoca un Tun para él. Sin grito | hecho |
| Tun Puto | 3 | 1/5 | Cada vez que muere cualquier esbirro, tira una piedra de 1 de daño a un enemigo al azar | hecho |
| Tun Tung Sahur | 1 | 1/1 | Grito: invoca un Tun 1/1 | hecho |
| Tun Mujer ♀ | 5 | 2/8 | Grito: transforma a tus otros esbirros en Tun Puto | hecho |
| Tun Cool | 10 | 6/7 | Acometida. Robo de vida. 1 menos por cada otro Tun en el campo. Al recibir daño, invoca un Tun. Grito: invoca una copia sin habilidades (ficha) y robás 2 Tun | hecho |
| Novia de Tun ♀ | 3 | 4/1 | Acometida. Último aliento: invoca 2 Tun y tus Tun tienen +1 de ataque por el resto de la partida | hecho |
| Tun Mastermind | 15 | 6/3 | Acometida. 1 menos por cada Tun muerto en la partida. Grito: invoca 3 Tun, tus Tun tienen +1 de ataque por el resto de la partida y robás 2 Tun | hecho |
| Comida (hechizo) | 3 | — | Llena tu mesa de Tun 1/1 | hecho |
| Plátano (hechizo) | 1 | — | +1/+1 a tus Tun | hecho |
| Tuna (hechizo) | 2 | — | Restaura 5 de vida a tu héroe. Robás 2 cartas | hecho |
| Tunita (hechizo) | 2 | — | 1 de daño a un esbirro, +1 por cada Tun que invocaste o jugaste esta partida | hecho |
| **Funeral de Tun** (hechizo legendario) | 10 | — | Un Tun Zombie por cada Tun muerto en la partida; cada uno que no cabe da +1 de ataque o de vida a un Tun al azar | hecho |
| Tun Zombie (ficha) | — | 1/1 | Lo invocan Funeral de Tun y Tun Iguana. Como mucho 2 de ataque aunque tengas mejoras (`ataqueMax`). El de la Iguana ataca y se va (`efimero`) | hecho |
| **Porque Me Monean** (legendaria) | 6 | 3/5 | Grito: convierte a todos los esbirros del rival en Tun 1/1 | hecho |
| Tun Amor (sin género) | 4 | 1/8 | Cada vez que uno de tus Tun ataca, gana +1/+1 | hecho |
| Choza de Monos | 2 | 0/6 | Al final de tu turno, invoca tres Tun | hecho |
| **Tun Iguana** (legendaria) | 8 | 8/8 | Grito: por el resto de la partida, cada vez que muere uno de tus Tun (no cuenta el Tun Zombie), un Tun Zombie ataca a un enemigo al azar y se va (no queda en la mesa) | hecho — falta confirmar género |
| Tun Astrónomo | 2 | 1/5 | Cada vez que ataca, un Tun de tu mano al azar cuesta 2 menos | hecho |
| Tun Satánico | 3 | 1/1 | Grito: destruye a tus otros Tun y gana +2/+2 por cada uno. Último aliento: reparte su ataque como daño entre los enemigos (piedras) | hecho |

## Neutrales

| Carta | Coste | Stats | Efecto | Estado |
|---|---|---|---|---|
| Tun Brawl Stars | 2 | 2/3 | — (tribu Tun: cuenta para la misión y Tun Puto) | hecho |
| Tun IA | 1 | 1/2 | Grito: descubre un Tun (tribu Tun) | hecho |
| Mauro Sosa | 2 | 2/3 | Grito: si el rival tiene una mujer en la mano, te la robás | hecho — roba cartas con `"genero": "mujer"` (todavía no hay ninguna) |
| Mascotas de Tun (hechizo) | 2 | — | Roba 2 cartas | hecho |
| Nullscape (hechizo) | 4 | — | Todos los esbirros hacen parkour; solo uno al azar sobrevive | hecho (ahora es neutral) |
| **Mario Multiplanet** (legendaria) | 7 | 5/6 | Escudo divino, robo de vida, acometida. Grito: invoca una copia de este esbirro | hecho — falta género; rareza propuesta |
| **Rafael Fernando** (legendaria) | 6 | 3/7 | Colosal +99 (apéndices 2/3). Cuando muere un Rafael Fernando que no es el original, otro lo reemplaza (mientras queden de los 99) | hecho — falta imagen (🧍) y género; rareza propuesta |
| El Tipo de la Foto ♂ | 4 | 5/5 | Último aliento: se esconde en una carta al azar de la mano del rival; cuando la juegue, vuelve a salir para su dueño | hecho — falta imagen (📸) |
| **Cruit Breakdown** (legendaria, neutral, tribu Cruit, como Yogg-Saron) | 10 | 7/5 | Grito: lanza un hechizo al azar por cada hechizo que lanzaste esta partida, con objetivos al azar | hecho — falta imagen (🤯) |
| Doxeo (arma) | 4 | 3 de ataque, 3 usos | Cada vez que tu héroe ataca, robás una carta legendaria de tu mazo | hecho — coste propuesto |
| Cuidar VC (VC) | 3 | 3/4 | Último aliento: obtenés 4 de armadura | hecho — falta imagen (🎧) |
| Ishowspeed Tocándose ♂ (VC) | 4 | 4/3 | Último aliento: 3 de daño a todos los esbirros | hecho — falta imagen (⚡); coste y stats propuestos |
| Enojaste Destroyer of VC | 6 | 4/4 | Grito: destruye tu PutoVC y elegís una: gana sus stats y reparte el doble de su ataque entre los enemigos; armadura igual al doble de su ataque; o lo lanzás gratis y obtenés sus piezas a coste 1 | hecho — falta imagen (😤), género; coste y stats propuestos |

### Mecánica: Entrar al VC (como las naves de Hearthstone)

- Las cartas con `"vc": true` entran a la mesa normal y además se suman a tu **PutoVC** (su último aliento y sus stats).
- El PutoVC es una **ubicación** fija en el borde izquierdo de tu mesa (aparece con la primera pieza): no ocupa lugar de esbirro, no se puede atacar ni destruir. Al tocarlo se ven sus piezas y la unión que saldría; lanzarlo cuesta `COSTE_VC` (4) de maná y necesita lugar en la mesa: sale la **unión** (`putovc`), un esbirro con la suma de ataque y vida de las piezas, sus claves y todos sus efectos (últimos alientos, al final de tu turno, al recibir daño, al atacar, auras); no se activa nada al lanzarlo. Después el VC vuelve a 0.
- **Armadura** (`armadura` en el jugador, efecto `armadura`): absorbe el daño al héroe antes que la vida. Se ve como un escudo en el retrato.
- **Elegí una** (efecto `destruir_vc` con `opciones`): usa la pantalla de descubrir, pero la opción elegida se aplica en vez de ir a la mano (cartas ficha `vc_op_*` con efecto `vc_opcion`).

## Animaciones automáticas

- Legendarias: se oscurece la pantalla, aparecen grandes con rayos y caen de golpe a la mesa (onda expansiva + temblor). Tun Satánico usa la versión roja (`"entrada": "demonio"`).
- Efectos de fin de turno: el esbirro se levanta brillando con un círculo rúnico y su carta aparece al lado; lo que invoca sale volando desde él (igual con el poder de héroe y los gritos).
- Misión: medallón arriba del retrato del héroe con anillo de progreso; cada avance suena y brilla; al completarse hay fanfarria, el medallón se agranda y se muestra la recompensa.
- Robar de la mano: la carta cruza la pantalla de una mano a la otra.

## Clase Cruit

Diseño de Mario. Marco azul (provisional). Cruit es no binario: toda carta con su nombre lleva `"genero": "no_binario"` (sin símbolo en la carta).

| Carta | Coste | Stats | Efecto | Estado |
|---|---|---|---|---|
| Héroe Cruit | — | 50 | Poder (1) "Hacer la tarea": recibís 2 de daño y robás una carta. Cuenta como Tarea (Cruit Excel la cuenta; con Unislop se lanza dos veces) | hecho (retrato con fondo de leche) |
| Coco (ficha, el hámster) | — | 1/1 | Carga. Muere al final de tu turno | hecho |
| Cruit Intolerante a la Lactosa (tribu Cruit) | 2 | 1/3 | Grito y último aliento: 2 de daño a todos los demás esbirros (vómito) | hecho |
| Lechero ♂ | 1 | 1/1 | Grito: obtenés una Leche | hecho |
| Leche (hechizo) | 1 | — | +1/+1 a un esbirro; si es un Cruit, activa su grito y su último aliento | hecho |
| Cruit Excel (tribu Cruit, etiqueta programa) | 5 | 2/2 | Grito: +1/+1 por cada Tarea que lanzaste esta partida. No se le puede dar Leche | hecho |
| Tarea de la U (hechizo, etiqueta Tarea) | 1 | — | Robás una carta y obtenés una tarea universitaria al azar | hecho |
| **Coco Supremo** (legendaria) | 9 | 7/5 | Grito: repite los gritos y últimos alientos de los Cruit que jugaste esta partida. Orden: primero el resto, después los que crecen por cada cosa (Excel) y al último los que pegan según su ataque (Baño) | hecho |
| Estreñido Cruit | 1 | 1/2 | Grito y último aliento: mete 2 Cacas en el mazo del rival (al robarlas: 2 de daño y roba otra) | hecho |
| Cruit Sangre | 2 | 2/2 | Se fusiona con tus otros Cruit Sangre (suma stats, ×N en la carta). Al final de tu turno, roba 1 de vida por cada Sangre fusionada al enemigo con menos vida | hecho |
| Cruit Vampiro | 5 | 3/3 | Tus Cruit Sangre roban el doble de vida. Grito: invoca 2 Cruit Sangre (se fusionan en una, con animación) | hecho |
| Caca (ficha) | 0 | — | Se lanza al robarla: 1 de daño a quien la roba y a sus esbirros, y roba otra | hecho |
| Cruit Tostadora | 1 | 1/2 | Grito: robás una carta | hecho |
| Cruit Baño | 2 | 4/2 | Grito: inflige daño igual a su ataque, repartido al azar entre todos los enemigos (chorros de agua) | hecho |
| **Cruit Vaca** (legendaria, tribu Vaca: no cuenta como Cruit) | 4 | 3/4 | Grito: una Leche a cada uno de tus otros esbirros (+1/+1 y activa a los Cruit) | hecho |
| **Cruit Verity** (legendaria) | 3 | 3/1 | Último aliento: invoca a Verity 5/5 | hecho |
| Verity (ficha, forma monstruosa) | 5 | 5/5 | — | hecho |
| **Unislop** (legendaria) | 4 | 3/3 | Grito: obtenés 3 tareas universitarias distintas al azar. Por el resto de la partida, tus Tareas se lanzan dos veces | hecho — falta género |
| Escuela Alumnos | 2 | 2/2 | Grito: descubre dos tareas universitarias | hecho — falta imagen (🏫); coste propuesto |
| Cruit Rage (hechizo) | 2 | — | El próximo grito de batalla de un Cruit que juegues se activa 3 veces | hecho — falta imagen (😡) |
| Elliot Cruit (tribu Cruit, Forsaken) | 2 | 2/2 | Al final de tu turno, una pizza cura 3 a un aliado herido al azar | hecho |
| Chance Cruit (tribu Cruit, Forsaken) | 3 | 3/3 | Grito: moneda. Cara: 6 de daño a un enemigo al azar. Cruz: 3 de daño a tu héroe | hecho |

Sin mazo armado, el héroe sale al azar.

## Mazos meta

**Tun (40):** lista armada por Mario.

**Cruit (40):** lista armada por Mario.

Con los mazos de 20, bot contra bot, Cruit le ganaba a Tun ~68% (era ~95% antes de los nerfs a Estreñido, Cruit Baño y Cruit Sangre y el buff a Novia de Tun). Con los mazos de 30 y mulligan (Lechero 1/1, Cruit Vaca fuera de la tribu, Cruit Verity 3 de maná con Verity 5/5, Cruit Baño 4/2 de 2 de maná que reparte su ataque, Novia de Tun 3 de maná 2/1 que al morir invoca 2 Tun, Intolerante y Estreñido también al morir), Cruit gana ~46%. Con 50 de vida y los cambios a Tun (Tun Mujer, Mastermind, Porque Me Monean, Choza, misión de 20), ~41%.

### Tareas universitarias (fichas de Unislop, etiqueta Tarea: cuentan para Cruit Excel). Todas cuestan 1 salvo Desvelada (0)

| Tarea | Coste | Efecto |
|---|---|---|
| Ensayo 📝 | 1 | Robás 2 cartas |
| Exposición 🎤 | 2 | Invoca 2 Cruit al azar |
| Examen Sorpresa ❗ | 1 | Destruye un esbirro |
| Proyecto Grupal 👥 | 2 | +2/+2 a tus esbirros |
| Laboratorio 🧪 | 2 | Obtenés 2 Leches |
| Tesis 📚 | 1 | 3 de daño a todos los enemigos |
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

## Clase Tomis (clase de hechizos, inspirada en el Mago)

Habilitado: se puede elegir en Mis mazos, sale en "Al azar" y tiene mazo precargado de 40 (armado por Mario: sus cartas de clase más Mascotas de Tun ×2, Doxeo y Cruit Breakdown). Un héroe nuevo se puede marcar `"enConstruccion": true` para que aparezca en la colección sin poder jugarse. Marco rojo. Retrato: `public/arte/heroe_tomis.webp`. Poder: **Scrobbling (2): descubre un hechizo de tu clase o neutral; cuesta 1 menos** (imagen: `public/arte/poder_tomis.webp`) (`{ "tipo": "descubrir", "filtro": { "tipo": "hechizo" }, "deMiClase": true, "rebaja": 1 }`). El héroe no se agrega hasta tener cartas de clase, para que no salga en "Al azar" con un mazo vacío.

| Carta | Coste | Stats | Efecto | Estado |
|---|---|---|---|---|
| La Mejor Música que Jamás Escucharás | 2 | 1/2 | Poder de hechizo +1 | hecho |
| Grindcore (hechizo) | 2 | — | 1 de daño a lo que elijas y 2 a todos los enemigos (el objetivo enemigo recibe los dos) | hecho |
| Mi Playlist #67 | 3 | 3/2 | Último aliento: lanza 2 hechizos al azar (con objetivos al azar) | hecho |
| Fumando Porro (hechizo) | 3 | — | Invoca un Homero 5/5 (ficha). Tus próximos 2 hechizos también invocan un Homero (se ve en la placa) | hecho |
| **Ethypostlife** (legendaria) | 3 | 2/3 | Grito: por el resto de la partida, cada hechizo tuyo invoca un esbirro al azar de su mismo coste (si no hay, del más cercano por debajo; usa el coste original del hechizo) | hecho |
| Wey Emo Gritando (hechizo) | 1 | — | Reparte 4 de daño al azar entre los enemigos; si muere alguno, reparte 2 más (una vez) | hecho |
| Mossad Strongest Agent | 4 | 1/8 | Cada vez que lanzás un hechizo, robás una carta | hecho — falta género |
| Yamir | 5 | 3/7 | Poder de hechizo +1. Tus hechizos cuestan 1 menos (mientras esté en la mesa; campo `abarata_hechizos`). Grito: robás 1 hechizo de tu mazo | hecho — falta género |
| Audiophile | 2 | 2/3 | Tus hechizos cuestan 1 menos. Grito: robás una carta | hecho |
| Midwest Emo (hechizo) | 7 | — | Vuelven a tu mano los 5 últimos hechizos que lanzaste; cuestan 1 menos (efecto `recuperar_hechizos`; no cuenta a sí mismo) | hecho |
| Breakcore (hechizo) | 3 | — | Reparte 2 de daño entre los enemigos, 3 veces (cada reparto suma el poder de hechizo) | hecho |
| Post-rock (hechizo) | 15 | — | Cuesta 1 menos por cada hechizo que lanzaste esta partida (`descuento: { por: "hechizos_lanzados" }`). Reparte 10 de daño entre los enemigos | hecho (foto de Hesse Kassel) |
| Música Andina (hechizo) | 5 | — | Restaura 6 de vida a tu héroe y reparte 6 de daño entre los enemigos | hecho |
| **Folklore** (hechizo legendario) | 4 | — | Invoca un músico 2/3 con poder de hechizo +1 por cada 3 scrobbles (hasta 4), en orden: Violeta Parra ♀, Víctor Jara ♂, Eduardo Mateo ♂, Chico Buarque ♂ (fichas). Los scrobbles se cuentan aunque la misión no esté en juego | hecho |
| **Slowcore** (hechizo legendario) | 4 | — | Reparte 5 de daño entre los enemigos. Se repite al final de cada uno de tus turnos por el resto de la partida (global `fin_de_tu_turno`; las repeticiones no suman poder de hechizo) | hecho |
| Noise (hechizo) | 7 | — | Ganás 5 de armadura. Inflige 10 de daño a todos los esbirros enemigos | hecho |
| Deathconsciousness (hechizo) | 10 | — | Reparte 8 de daño entre los enemigos, restaura 8 de vida a tu héroe e invoca un Eternal Worm 8/8 (ficha) | hecho |
| Shoegaze (hechizo) | 6 | — | Lanza otra vez los 3 últimos hechizos que jugaste, con objetivos al azar (sin contarse a sí mismo) | hecho |
| Review de RYM (hechizo) | 2 | — | Descubre una carta de tu mazo: la robás y obtenés una copia (efecto `descubrir_mazo`) | hecho |
| Loop | 1 | 2/2 | Grito: obtenés una copia de una carta al azar de tu mano (efecto `copiar_mano`) | hecho |
| **Contador de Scrobbles** (misión legendaria, serie) | 1 | — | Suma un scrobble por cada hechizo o carta con etiqueta `musica` que jugás (todas las cartas de Tomis la tienen). Nivel 1 (5): robás 2 cartas que cuestan 1 menos. Nivel 2 (10): tus hechizos +1 de daño por el resto de la partida, robás 2 (el efecto `rebaja_proxima` existe pero ya no se usa). Nivel 3 (20): obtenés **Charts** | hecho |
| Descargar el FLAC (parte 2/3, ficha) | — | — | La misión pasa a esta carta al llegar al nivel 1 | hecho |
| Winamp (parte 3/3, ficha) | — | — | La misión pasa a esta carta al llegar al nivel 2 | hecho |
| **Charts** (legendaria, recompensa) | 5 | 5/5 | Grito: repite, en orden, todos los hechizos que lanzaste esta partida (objetivos al azar, con tu poder de hechizo) | hecho |

**Poder de hechizo** (`poder_hechizo: N` en un esbirro): mientras esté en tu mesa, tus hechizos que hacen daño (`dano`, `repartir`, `robar_vida`) pegan N más.

Efecto `eco_hechizos` (`cantidad`, `efectos`, `origen`): tus próximos N hechizos también hacen esos efectos. Si lanzás otro Fumando Porro, se suman.

**Pool de hechizos al azar y de descubrir hechizos** (`hechizosAzar`): los hechizos del juego que van en mazos, más las tareas universitarias de Cruit (menos las que dan Leche, como Laboratorio). Lo usan Cruit Breakdown, Mi Playlist #67, el poder de Tomis, Charts no (repite los tuyos), y los músicos de Folklore.

Balance con los mazos precargados de Mario (50 de vida, bot contra bot, 300 partidas): tras bajar el daño de Tomis, Tomis 78% vs Tun y 79% vs Cruit; Cruit 74% vs Tun. Con 30 o 40 de vida casi no cambia. Tras los buffs a Tun (Panamá al inicio, Tun Puto, Choza, Iguana): Tun 51% vs Cruit, Tun 36% vs Tomis, Cruit 20% vs Tomis.
Tras el rework de Tun (Plátano, Tuna, Tunita, Novia, Astrónomo, Amor, Satánico, Cool, Mastermind) y Música Andina/Noise: Tun 90% vs Cruit, Tun 84% vs Tomis, Tomis 73% vs Cruit. Lo que más pesa: Tuna (+1/+1 permanente) junto con Tun Puto (su daño sube con el ataque del Tun).
Tras Panamá solo al inicio, Caca 1 a todos, tareas a 1 y Tun Puto de vuelta a 1: Tun 88% vs Cruit, Tun 82% vs Tomis, Cruit 37% vs Tomis.
Tras Tuna (cura 5, roba 2): Tun 85% vs Cruit, Tun 74% vs Tomis, Cruit 37% vs Tomis.

**Animaciones de daño de Tomis:** cada hechizo que hace daño tiene su `fx` y tira algo propio desde tu héroe: Grindcore 🤘 (rápido, hace temblar la mesa), Wey Emo 😭, Breakcore ⚡ (con glitch), Post-rock 🎸, Música Andina 🦙, Slowcore 🐌 (lento; cuando se repite al final del turno también se muestra la carta), Noise 📢 (con estática), Deathconsciousness 🪱. Con poder de hechizo, el daño de tus hechizos en la mano se ve subido, en verde.

Balance tras el nerf a Tomis (misión roba 2, músicos 2/3 sin hechizo, Mejor Música 1/2, Yamir roba 1) y Tun Iguana 8/8 (bot contra bot, 300 partidas): Tun 60% vs Cruit, Tun 55% vs Tomis, Tomis 56% vs Cruit.

Cambios de Tomis (otra tanda): Wey Emo reparte 4 (+1 si mata), Audiophile ya no roba, **Slowcore** pasa a ser un esbirro legendario 4 maná 3/3 que al final de tu turno reparte 5 (si lo matan, se acaba), Shoegaze repite los 2 últimos hechizos, **Midwest Emo** pasa a ser un esbirro 3 maná 2/3 con Grito: descubre un hechizo de coste 3 que se lanza dos veces al jugarlo (`descubrir` con `filtro.coste` y `doble`). Mascotas de Tun cuesta 2. Panamá se anima después del mulligan; cuando el rival descubre se ven 3 cartas boca abajo.
Balance (300 partidas): Tun 63% vs Cruit, Tun 70% vs Tomis, Cruit 50% vs Tomis.
