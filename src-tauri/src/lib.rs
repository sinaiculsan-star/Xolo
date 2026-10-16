//! XOLO PoC: ventana transparente convertida en NSPanel (macOS) para
//! intentar verse sobre apps a pantalla completa.
//! API de tauri-nspanel verificada en su código (rama v2.1, ejemplo `fullscreen`).

use tauri::{Emitter, Manager};

#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(XoloPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true
        }
    })
}

/// Convierte la ventana "main" en panel no activante, visible en todos
/// los Spaces y junto a apps a pantalla completa.
#[cfg(target_os = "macos")]
fn setup_panel(app: &tauri::AppHandle) {
    use tauri_nspanel::{CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt};

    let Some(window) = app.get_webview_window("main") else {
        eprintln!("no existe la ventana main");
        return;
    };
    match window.to_panel::<XoloPanel>() {
        Ok(panel) => {
            panel.set_level(PanelLevel::Floating.value());
            if let Err(e) = panel.add_style_mask(StyleMask::empty().nonactivating_panel().into()) {
                eprintln!("no se pudo aplicar nonactivating_panel: {e:?}");
            }
            panel.set_collection_behavior(
                CollectionBehavior::new()
                    .full_screen_auxiliary()
                    .can_join_all_spaces()
                    .into(),
            );
        }
        Err(e) => eprintln!("no se pudo convertir a panel: {e}"),
    }
}

/// Mostrar u ocultar la mascota (en macOS, a través del panel).
fn set_visible(app: &tauri::AppHandle, visible: bool) {
    #[cfg(target_os = "macos")]
    {
        use tauri_nspanel::ManagerExt;
        match app.get_webview_panel("main") {
            Ok(panel) => {
                if visible {
                    panel.show();
                } else {
                    panel.hide();
                }
            }
            Err(e) => eprintln!("panel no encontrado: {e:?}"),
        }
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(w) = app.get_webview_window("main") {
        let _ = if visible { w.show() } else { w.hide() };
    }
}

/// Icono en la barra de menús con Mostrar / Ocultar / Salir.
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::TrayIconBuilder,
    };
    let show = MenuItem::with_id(app, "show", "Mostrar XOLO", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Ocultar XOLO", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => set_visible(app, true),
            "hide" => set_visible(app, false),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

/// Distancia (dx, dy) en PUNTOS desde el centro de la ventana hasta el cursor.
/// macOS: NSEvent.mouseLocation y NSWindow.frame comparten sistema de coordenadas,
/// así que no hay mezcla de escalas entre pantallas (bug de la pantalla secundaria).
/// Comando síncrono = se ejecuta en el hilo principal (doc oficial de Tauri).
#[cfg(target_os = "macos")]
#[tauri::command]
fn cursor_offset(window: tauri::WebviewWindow) -> Result<(f64, f64), String> {
    let ptr = window.ns_window().map_err(|e| e.to_string())?;
    // SAFETY: el puntero es el NSWindow vivo de esta ventana y estamos en el hilo principal.
    let ns_window = unsafe { &*(ptr as *const objc2_app_kit::NSWindow) };
    let f = ns_window.frame();
    let m = objc2_app_kit::NSEvent::mouseLocation();
    Ok((
        m.x - (f.origin.x + f.size.width / 2.0),
        m.y - (f.origin.y + f.size.height / 2.0),
    ))
}

/// Otras plataformas (sin probar): conversión simple a píxeles lógicos.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn cursor_offset(window: tauri::WebviewWindow) -> Result<(f64, f64), String> {
    let c = window.cursor_position().map_err(|e| e.to_string())?;
    let p = window.outer_position().map_err(|e| e.to_string())?;
    let s = window.inner_size().map_err(|e| e.to_string())?;
    let k = window.scale_factor().map_err(|e| e.to_string())?;
    Ok((
        (c.x - (p.x as f64 + s.width as f64 / 2.0)) / k,
        (c.y - (p.y as f64 + s.height as f64 / 2.0)) / k,
    ))
}

/// Menú de clic derecho sobre la esfera (menú nativo del sistema).
/// Comando síncrono = hilo principal. Los eventos llegan a `WebviewWindow::on_menu_event` (ver run()).
#[tauri::command]
fn show_context_menu(window: tauri::Window, paused: bool) -> Result<(), String> {
    use tauri::menu::{Menu, MenuItem};
    let e = |e: tauri::Error| e.to_string();
    let label = if paused { "Reanudar movimiento" } else { "Pausar movimiento" };
    let pause = MenuItem::with_id(&window, "ctx_pause", label, true, None::<&str>).map_err(e)?;
    let hide = MenuItem::with_id(&window, "ctx_hide", "Ocultar", true, None::<&str>).map_err(e)?;
    let quit = MenuItem::with_id(&window, "ctx_quit", "Salir", true, None::<&str>).map_err(e)?;
    let menu = Menu::with_items(&window, &[&pause, &hide, &quit]).map_err(e)?;
    window.popup_menu(&menu).map_err(e)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());

    builder
        .invoke_handler(tauri::generate_handler![cursor_offset, show_context_menu])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                // Sin icono en el Dock (necesario para aparecer sobre pantalla completa).
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                setup_panel(app.handle());
            }
            setup_tray(app)?;
            if let Some(w) = app.get_webview_window("main") {
                w.on_menu_event(|w, event| match event.id.as_ref() {
                    "ctx_pause" => {
                        let _ = w.emit("toggle-pause", ());
                    }
                    "ctx_hide" => set_visible(w.app_handle(), false),
                    "ctx_quit" => w.app_handle().exit(0),
                    _ => {}
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar XOLO");
}
