# Estado del PoC (2026-10-16)

Proyecto en `~/XOLO` (Tauri 2 + React + R3F). Ejecutar: `cd ~/XOLO && npm run tauri dev` (cerrar: Ctrl+C).
Informe de viabilidad: `docs/research/01-viabilidad.md` (en el Project XOLO).

## Verificado en el Mac de la usuaria (macOS 15.3.2, Apple Silicon)
- Ventana transparente sin borde/sombra/halo con esfera 3D rosa: OK (A1).
- Arrastre: OK. Clics a través de zonas vacías (sondeo del cursor + setIgnoreCursorEvents): OK (A2, sin contar 20/20).
- Visible al cambiar de Space si la ventana es pequeña: OK.

## Fallido
- Sobre apps a pantalla completa NO se ve. Probado con NSWindow normal: `setCollectionBehavior` (canJoinAllSpaces|fullScreenAuxiliary), `setLevel` 101, reaplicado a los 800 ms, política Accessory (sin icono en Dock). Ver `src-tauri/src/lib.rs`.
- Copia de la versión básica (con icono en Dock): `.copia-esfera-basica/` (lib.rs y Cargo.toml).

## Siguiente paso (acordado: opción B)
Probar `tauri-nspanel` (rama v2.1, licencia MIT/Apache-2.0; `PanelBuilder`, `tauri_panel!`, `PanelLevel`). 
- Pendiente: API exacta para panel no activante + collection behavior fullScreenAuxiliary + nivel alto (docs en github.com/ahkohd/tauri-nspanel/tree/v2.1/docs bloqueadas por robots; probar docs.rs o el código fuente vía clon con git). NO inventar nombres de API.
- Si falla: aceptar que 0.1 no cubre pantalla completa y volver a la versión básica.
- Necesario antes de entregar: menú contextual con Salir (en modo Accessory no hay icono en Dock) + icono en barra de menús.

## Notas
- Bug npm con dependencias opcionales: se resolvió instalando `@rollup/rollup-darwin-arm64` y `@esbuild/darwin-arm64@0.25.12` (versión igual a esbuild).
- Usuaria no técnica: explicar "para dummies", respuestas cortas, pocos tokens.

## Actualización: intento nspanel (2026-10-16) — FUNCIONA (confirmado por la usuaria)
- Implementado (sin compilar aún; el equipo de desarrollo no puede compilar macOS desde aquí): `tauri-nspanel` fijado al commit `ef6e309` (rama v2.1) en `Cargo.toml`.
- `lib.rs`: la ventana `main` se convierte en panel (`to_panel`), nivel `PanelLevel::Floating`, estilo `nonactivating_panel`, collection behavior `full_screen_auxiliary` + `can_join_all_spaces`. Igual que el ejemplo oficial `examples/fullscreen` (verificado leyendo su código).
- Se eliminó la dependencia `objc2` directa y el código de `msg_send!`.
- Copia del estado anterior (intento NSWindow fallido): `.copia-pre-nspanel/`.
- Hipótesis a comprobar: `setIgnoreCursorEvents` y el arrastre siguen funcionando sobre un panel.
- Cómo probar: `cd ~/XOLO && npm run tauri dev`; (1) ¿se ve la esfera? (2) ¿arrastra? (3) ¿clics atraviesan zonas vacías? (4) abrir una app en pantalla completa y ver si la esfera aparece encima.
- Si falla (4): aceptar que 0.1 no cubre pantalla completa y volver a la versión básica (`.copia-esfera-basica/`).

- Resultado: la usuaria confirma "ya funciona" con nspanel (2026-10-16). Verificado por la usuaria: se ve sobre apps a pantalla completa (tarda unos segundos en ponerse encima), todo OK.
- Implementado, PENDIENTE DE PRUEBA: icono en barra de menús con Mostrar / Ocultar / Salir (`setup_tray` en lib.rs, feature `tray-icon`). Icono = icono por defecto de la app (a color; versión "template" no verificada).
- Pendiente: menú contextual (clic derecho) sobre la esfera.

## Bug pantalla secundaria (2026-10-16)
- Síntoma: en la pantalla secundaria la esfera se quedaba "congelada" y no se podía mover.
- Tras reiniciar con un panel de diagnóstico temporal (ya retirado), la usuaria dice que funciona. Causa NO identificada: no se cambió la lógica de clics. Puede reaparecer; si vuelve, reinstrumentar (posición del cursor/ventana, escala y monitor).
- `.copia-pre-debug/` se puede borrar a mano (copia de los archivos antes del diagnóstico).

## Estado al 2026-10-16 18:50 (para retomar sin historial)
- Diagnóstico con la terminal: en la pantalla secundaria (escala 1) el cursor de Tauri venía en escala x2 (la de la principal) y la ventana en escala 1, así que el cálculo de "cursor sobre la esfera" fallaba y los clics pasaban de largo. Causa muy probable (datos coherentes), no confirmada con el arreglo.
- Arreglo aplicado, SIN PROBAR: comando Rust `cursor_offset` (lib.rs) usa `NSEvent::mouseLocation` + `NSWindow::frame` (mismo sistema de coordenadas); `useClickThrough.ts` lo llama con `invoke`. Dependencia nueva: `objc2-app-kit` (features NSEvent, NSWindow, NSResponder).
- Diagnóstico temporal (DIAG) ELIMINADO el 2026-10-16.
- Pendiente tras confirmar: menú clic derecho sobre la esfera; luego, empaquetar app (`tauri build`; firmar requiere cuenta Apple de pago: consultar).

## Menú clic derecho (2026-10-16 ~19:10) — SIN COMPILAR NI PROBAR
- `show_context_menu` (lib.rs) abre un menú nativo con Ocultar / Salir (`Window::popup_menu`, verificado en docs.rs tauri 2.12.4). Eventos `ctx_hide`/`ctx_quit` por `WebviewWindow::on_menu_event` en `setup`. `App.tsx` llama al comando en `onContextMenu` (con `preventDefault`, así desaparece el menú Reload/Inspect).
- "Pausar movimiento" NO está: aún no hay movimiento autónomo en el PoC. Va con el hito de movimiento.
- Hipótesis: el menú nativo funciona sobre un NSPanel no activante y con el click-through activo. Requiere prueba.
- Devtools (Inspect): solo en builds debug o con la feature `devtools` (verificado en docs). La app de `tauri build` no los trae salvo que se active.
- Pendiente: confirmar arreglo pantalla secundaria, quitar DIAG, empaquetar.

## Confirmado por la usuaria (2026-10-16 19:00)
- Menú clic derecho (Ocultar / Salir) funciona; la esfera se mueve y recibe clics en todas las pantallas (arreglo `cursor_offset` OK).
- DIAG eliminado (sin compilar tras quitarlo: probar `npm run tauri dev`).
- Pendiente: empaquetar (`tauri build`; firmar requiere cuenta Apple de pago: consultar). Borrables a mano: `.copia-pre-debug/`.

## Movimiento autónomo (2026-10-16 ~19:20) — TypeScript sin errores (tsc), Rust SIN COMPILAR, sin probar
- Archivos: `src/behavior.ts` (lógica pura: estados, duraciones, destino), `src/useCompanion.ts` (máquina de estados + mover ventana, 30 Hz), `src/Sphere.tsx` (animación por estado), `src/constants.ts`, menú en `lib.rs` (`show_context_menu(paused)`), permisos nuevos en `capabilities/default.json`.
- Estados: idle (3-8 s) → 60 % walking / 25 % sleeping (8-20 s) / 15 % idle. Walking: destino aleatorio a ≤400x250 px lógicos, 70 px/s, dentro de `Monitor.workArea` (verificado en la API instalada). Dragging: al pulsar; termina con mouseup o 400 ms sin `onMoved`.
- Pausar/Reanudar movimiento en el menú de clic derecho (Rust emite evento `toggle-pause`). Pausado = se queda quieta en idle.
- Hipótesis (requieren prueba): (1) `workArea` en macOS excluye Dock y barra de menús; (2) `currentMonitor()` devuelve la pantalla correcta en la secundaria; (3) `mouseup` llega tras `startDragging`, si no, actúa el temporizador de 400 ms; (4) el movimiento se ve fluido con `setPosition` a 30 Hz.
- Limitación: solo pasea dentro de la pantalla donde está; para cambiar de pantalla, arrastrarla.

## Zona de paseo (2026-10-16 ~19:20) — tsc OK, sin probar
- Feedback usuaria: animaciones (blandito al pulsar, rebote al pasear, aplastarse al dormir) aprobadas; quiere que pasee solo por un "cuadrado imaginario" para no molestar.
- Implementado: la esfera pasea dentro de un cuadrado de `ZONE_PX` = 500 px lógicos (incluye la esfera; `src/constants.ts`) centrado en su posición "home" = donde está al empezar o donde se suelta tras un arrastre. Destino uniforme dentro de la zona e intersectado con `workArea`. Ajustar `ZONE_PX` para hacerla mayor o menor.

## Hito movimiento + zona APROBADO por la usuaria (2026-10-16 19:40)
- "Parece que todo va bien": movimiento autónomo, animaciones, zona de paseo y menú Pausar/Ocultar/Salir.
- Pendiente de 0.1: probar icono de barra de menús (Mostrar/Ocultar/Salir), empaquetar (`tauri build`, sin firmar) y borrar a mano `.copia-pre-debug/`, `.copia-pre-nspanel/`, `.copia-esfera-basica/` cuando ya no hagan falta.

## Limpieza (2026-10-16 19:50)
- Borradas a petición de la usuaria: `.copia-esfera-basica/`, `.copia-pre-nspanel/`, `.copia-pre-debug/` (versión nspanel + movimiento ya aprobada; sin git, no hay vuelta atrás).
- Pendiente: integrar modelo 3D propio (generado en Meshy, formato GLB con animaciones) en lugar de la esfera; decisión de alcance abierta (¿en 0.1 o 0.2?).

## Empaquetado (2026-10-16 20:50)
- `npm run tauri build` COMPILA bien (release, 1m13s). Falló solo el bundle: "Failed to create app icon: No matching IconType" (solo había `icons/icon.png`, 1024x1024).
- Arreglo preparado: `app-icon.png` en la raíz (copia del icono) + `npm run tauri icon` (genera icns/ico/pngs en `src-tauri/icons/`) + `tauri.conf.json` con la lista de iconos generados (nombres estándar de la plantilla de Tauri: HIPÓTESIS, si falta alguno el build lo dirá). Pendiente de ejecutar por la usuaria.
- XOLO.app sin firmar quedará en `src-tauri/target/release/bundle/macos/XOLO.app`.

## Modelo 3D real: ajolote de la usuaria (2026-10-16 21:10) — tsc OK; app SIN PROBAR en Mac
- Origen: `Xolo_3D.glb` (Meshy, 48 MB: 1 malla de 12.886 vértices, sin esqueleto ni animaciones; texturas PNG 8192² + 2×4096²). NO se pudo guardar el original en el proyecto (límite de transferencia 30 MB): la usuaria lo conserva en Descargas.
- Optimizado con gltf-transform (`resize` a 2048 px) → `public/models/xolo.glb` (10,4 MB; GPU ≈ 64 MB en vez de >400 MB). Mira a +Z; origen centrado.
- Código: `src/Xolo.tsx` (carga con `useLoader(GLTFLoader)`, trabaja sobre un CLON de la caché, escala a 1,76 unidades ≈ 200 px y centra; tinte oscuro al dormir), `src/pose.ts` (poses squash/stretch compartidas; mismas animaciones aprobadas de la esfera), `src/ModelBoundary.tsx` (si el modelo falla, se ve la esfera), `src/Sphere.tsx` (ahora reserva), `App.tsx` (`flat` = sin tonemapping para conservar el rosa de la textura).
- Verificado en navegador sin cabeza (componentes reales, mismas dependencias): carga, 4 estados, encaje dentro del círculo de clic (radio 100 px), y reserva a esfera sin modelo. Esa prueba destapó y corrigió un bug de mutación de la caché.
- Hipótesis / requiere prueba en el Mac: carga en WKWebView (ruta absoluta `/models/xolo.glb` también en `tauri build`), rendimiento a 30 Hz de movimiento, y que el círculo de clic (circular) cubra bien las branquias.
- Licencia: asset generado con Meshy. Si la usuaria usa el plan gratuito aplica CC BY 4.0 (atribución al repartir). PENDIENTE: confirmar plan y, si procede, añadir atribución antes de distribuir.
- Pendiente: poses extra (sitting, working, happy) y animación de esqueleto si se quiere más naturalidad; hitbox más ajustada a la silueta; icono de la app con el ajolote (ahora es el icono genérico); empaquetado.

## Modelo dormido + Zzz (16 oct 2026)
- `public/models/xolo-dormido.glb` (2 MB; original de Meshy 22 MB, malla simplificada y textura a 1024 px). Pose fija, sin animación.
- `Xolo.tsx` cambia de modelo según el estado (`sleeping` → dormido, girado 90° para verlo de perfil). Ambos se precargan.
- `pose.ts`: al dormir solo respira (ya no se aplasta). Se eliminó el tinte al dormir.
- `Zzz.tsx`: letras CSS flotantes, solo al dormir; respeta "reducir movimiento".
- Verificado: `tsc` sin errores; el modelo dormido se ve bien en render de prueba (ojos cerrados, mismo personaje).
- Sin verificar (requiere prueba en el Mac): orientación (cabeza a la derecha, Zzz a ese lado), tamaño, transición al cambiar de modelo, colores.
- Referencia (no integrada, fuera de 0.1): habitación pastel (126 MB, 3,9 M triángulos; aligerada 12,7 MB). Licencias de Meshy/ChatGPT pendientes de revisar.

## Personalidad (16 oct 2026) — sin verificar en el Mac
- Giro por el usuario: trackpad/rueda sobre Xolo o ⌥+arrastrar; vuelve de frente al parar. Gira sobre su centro (despierto y dormido).
- Parpadeo con párpados postizos (`Eyelids.tsx`; posiciones por raycast sobre `xolo.glb`, hay que repetirlas si cambia el modelo).
- Nuevo estado `drowsy` (2,6 s) antes de dormirse: parpadeos lentos y postura caída.
- Mirada (`Xolo.tsx`): caminando se orienta hacia su destino (~49°); en reposo mira al cursor si está a <400 px (~31°). `useClickThrough` publica la posición del cursor.
- Hipótesis a comprobar: signo de `dx` (derecha = positivo) en `cursor_offset`; naturalidad de los giros.
- Dormido de frente, mismo ancho que despierto. Icono del ajolote en `app-icon.png`.

## Patitas y color del dormido (16 oct 2026)
- `Paws.tsx`: al caminar, los vértices de cada pie suben/bajan alternando en diagonal (sin esqueleto; pesos por posición en el espacio de `xolo.glb`). Render de prueba correcto (medalla intacta); sin ver aún en la app.
- `xolo-dormido.glb`: textura reajustada (igualación de histograma con la del despierto, sin el marrón del collar) para un rosa más claro y crema. Original de Meshy conservado fuera del proyecto.
