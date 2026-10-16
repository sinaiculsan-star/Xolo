# XOLO: traspaso de sesión (16 oct 2026)

Resumen para retomar el proyecto en otra conversación sin depender del historial. Complementa `docs/estado-poc.md` (diario técnico) y las instrucciones del proyecto.

## Estado en una línea
XOLO 0.1 funciona en macOS (`npm run tauri dev`): ventana transparente sin bordes, ajolote 3D real, arrastrable, paseo autónomo en una zona limitada, estados idle/walking/drowsy/sleeping/dragging, menú contextual (pausar/ocultar/salir), click-through. Falta empaquetar y confirmar en el Mac los últimos cambios.

## Cómo ejecutar
- Desarrollo: `cd ~/XOLO && npm run tauri dev` (tras cambios de modelos o caché, reiniciar con Ctrl+C y relanzar).
- Empaquetar (pendiente de confirmar): `npm run tauri icon && npm run tauri build`; abrir con `open ~/XOLO/src-tauri/target/release/bundle/macos/XOLO.app`. Sin firmar (Apple Developer Program, 99 $/año) macOS puede exigir "Abrir igualmente" en Ajustes del Sistema.
- El icono fuente es `app-icon.png` (1024 px, ajolote sentado sobre fondo lavanda→crema). Los nombres de iconos en `tauri.conf.json` son hipótesis hasta que `tauri icon` los genere.

## Stack (verificado funcionando)
Tauri 2 (Rust + WKWebView), React 19, TypeScript estricto, @react-three/fiber 9, three 0.170, Vite. `tauri-nspanel` (commit `ef6e309`) para aparecer sobre apps a pantalla completa. Política Accessory, `macos-private-api`, `tray-icon`.

## Estructura (`~/XOLO/src`)
| Archivo | Qué hace |
|---|---|
| `App.tsx` | Canvas, menú contextual, arrastre, giro (trackpad/rueda; ⌥+arrastrar), Zzz |
| `useCompanion.ts` | Máquina de estados, paseo (zona `ZONE_PX`), arrastre, pausa, `heading` |
| `behavior.ts` | Tipos de estado y lógica pura (duraciones, qué hacer tras idle, destino) |
| `useClickThrough.ts` | Sondea el cursor (Rust `cursor_offset`) y activa/desactiva clics a través; publica el cursor |
| `Xolo.tsx` | Carga de modelos (despierto/dormido), corte directo con rebote (`POP`), giro, mirada |
| `Eyelids.tsx` | Parpadeo con párpados postizos (cúpula con degradado + línea de pestañas) |
| `Paws.tsx` | Patitas: desplazamiento de vértices por pie al caminar (sin esqueleto) |
| `Zzz.tsx` | Letras CSS flotantes al dormir; respeta "reducir movimiento" |
| `pose.ts` | Squash/stretch por estado (`useSquash`) |
| `Sphere.tsx`, `ModelBoundary.tsx` | Esfera de reserva si el modelo falla |
| `constants.ts` | `WINDOW_PX`=300, `RADIUS_PX`=100, `ZONE_PX`=500 |
| `src-tauri/src/lib.rs` | Panel NSPanel, bandeja, `cursor_offset`, `show_context_menu` |

## Modelos (en `public/models/`)
- `xolo.glb` (10 MB): ajolote despierto sentado, una sola malla (12 886 vértices), texturas a 2048 px. Origen: Meshy, modelo del usuario (diseños propios).
- `xolo-dormido.glb` (2 MB): pose tumbada con ojos cerrados, una sola malla, sin animación; simplificado (ratio 0,1) y textura a 1024 px con el color reajustado (igualación de histograma con la del despierto, sin el marrón del collar). Se ve de frente, retrasado para que el morro quede en el plano central (si no, la perspectiva lo agranda).
- Fuera del proyecto (en el equipo del usuario): `Xolo_3D.glb` original (48 MB); `Xolo_dormido.glb` original de Meshy (22 MB, sin tocar); `habitación_pastel.glb` (126 MB, 3,9 M triángulos; aligerada a 12,7 MB sale bien, diorama de dos paredes con escritorio, ventana, plantas y puf; para "Mi mundo", no integrada); `meshy_movimiento.glb` (rig de Meshy fallido: sin texturas y pose distinta).

## Comportamiento implementado
- **Estados:** idle → (60 % caminar / 25 % dormir / 15 % seguir) ; dormir pasa antes por `drowsy` (2,6 s: postura caída, párpados cayendo y parpadeos lentos) ; sleeping dura 8–20 s.
- **Caminar:** rebote + patitas alternas en diagonal (`LIFT` 0,007, `SWING` 0,003 en `Paws.tsx`); se orienta hacia el destino (`WALK_TURN` 0,85 rad).
- **Mirada:** en reposo mira al cursor si está a <400 px (`CURSOR_TURN` 0,55 rad).
- **Giro del usuario:** trackpad/rueda sobre Xolo o ⌥+arrastrar; gira sobre su centro, vuelve de frente a 1,5 s. Despierto y dormido dan la vuelta completa.
- **Cambio despierto↔dormido:** corte directo con rebote "blandito" (el fundido y la inclinación se probaron y se descartaron: no gustaron).
- **Parpadeo:** cada 2,5–6 s, 0,18 s, a veces doble; no parpadea al arrastrar.
- **Tamaño:** dormido con el mismo ancho que despierto (`ASLEEP_SIZE = AWAKE_SIZE`).

## Decisiones de diseño tomadas con el usuario
- Quiere que Xolo parezca lo más animal posible y tenga personalidad. Le gusta el efecto "blandito" al pulsar, el rebote al andar, el aplastamiento al dormir (ahora sustituido por el modelo tumbado) y la opción Ocultar del menú.
- Rechazó: inclinarse/hundirse al cambiar de pose, fundido cruzado, reflejar la imagen al ir a la izquierda ("salto"), dormido de perfil, dormido demasiado grande.
- Hecho de modelo: la cola sale hacia un lado, así que al girarse a la izquierda el cuerpo la tapa (comprobado en render). El usuario prefiere dejarlo así antes que reflejar. Salidas futuras: modelo con cola centrada, o girar solo hacia la derecha.

## Pendiente / próximos pasos
1. **Probar en el Mac** (todo lo posterior al dormido está sin ver en la app): párpado nuevo y caída al dormirse, patitas, mirada al cursor, orientación al caminar, color del dormido.
2. **Empaquetar** y confirmar que el arreglo del icono funciona.
3. **Licencias:** el usuario paga Meshy (confirmar plan y términos antes de distribuir); el ajolote nace de sus propios diseños; la hoja de personaje se hizo con ChatGPT (revisar términos de uso comercial).
4. **Más poses** (0.2 en adelante): sentado, contento, curioso, sorprendido, feliz, concentrado (con portátil), triste, saludando. Cada una = un modelo de Meshy, integrado como el dormido. Probar primero con una imagen de la hoja de personaje (la hoja de referencia incluye paleta y accesorios) que Meshy devuelva el mismo ajolote.
5. **Movimiento de verdad:** rig en Meshy (el intento anterior salió sin textura y con otra pose). Si funciona, sustituiría `Paws.tsx`.
6. **Ideas sin modelos nuevos aún sin hacer:** reacciones al clic (salto contento con corazones, "?" si lo miras mucho), paradas a mirar a los lados, sacudirse tras arrastrarlo, estirón al despertar.
7. **Habitación pastel:** reducir texturas y peso cuando toque "Mi mundo".
8. Hitbox circular (radio 100 px) frente a la silueta real (branquias, cola); afinar si estorba.

## Hipótesis / sin verificar en la app
- Signo de `dx` en `cursor_offset` (derecha = positivo) para la mirada al cursor.
- Posiciones de ojos (`Eyelids.tsx`) y de pies (`Paws.tsx`) medidas por raycast sobre `xolo.glb`: hay que repetirlas si cambia el modelo.
- Naturalidad del color de los párpados en movimiento (`LID_TOP`, `LID_BOTTOM`).
- Rendimiento a 30 Hz con deformación de vértices (12,9 k vértices, cálculo en CPU, solo mientras camina).

## Técnicas y trampas aprendidas
- No mutar la escena cacheada de `useLoader`: clonarla (`scene.clone(true)`) y clonar la geometría antes de deformarla.
- Los atributos de posición pueden venir intercalados: usar `getX/setXYZ`, no `array[3*i]`.
- `flat` en el Canvas para conservar colores de textura. Materiales opacos forzados al cargar (por la recarga en caliente con la caché).
- Visualización sin GPU: Chromium headless + Playwright con `--use-gl=swiftshader`; añadir `preserveDrawingBuffer:true` si se renderiza tras un `await`.
- gltf-transform: `simplify`, `resize` y sustitución de texturas con la API de Node.

## Reglas de trabajo vigentes
Respuestas breves en español sencillo (el usuario es Product Designer/PO, no técnico); hitos pequeños; parar y esperar aprobación al acabar un hito; distinguir verificado / hipótesis / requiere prueba; nada destructivo, nada de credenciales, ningún servicio de pago sin consultar; revisar licencias; no inventar APIs ni resultados de pruebas.
