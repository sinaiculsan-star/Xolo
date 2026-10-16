#!/bin/bash
# XOLO: prepara un Mac con Apple Silicon para ejecutar el proyecto.
# Uso: doble clic en Finder, o ./instalar.command en una terminal.
# Comprueba herramientas, instala las que falten (pidiendo permiso) y ejecuta `npm install`.
set -euo pipefail
cd "$(dirname "$0")"

ok()   { printf '\033[32m✔\033[0m %s\n' "$1"; }
info() { printf '\033[36m•\033[0m %s\n' "$1"; }
fail() { printf '\033[31m✘\033[0m %s\n' "$1"; read -r -p "Pulsa Intro para cerrar..." _ || true; exit 1; }
ask()  { local a; read -r -p "$1 [s/N] " a; [[ "$a" =~ ^[sSyY]$ ]]; }

echo "== XOLO: preparación del entorno =="

# 1. Mac con Apple Silicon (el proyecto usa paquetes solo para arm64)
[[ "$(uname -s)" == "Darwin" ]] || fail "Este script es solo para macOS."
[[ "$(uname -m)" == "arm64" ]] || fail "Hace falta un Mac con Apple Silicon (M1 o posterior). Este es $(uname -m)."
ok "Mac con Apple Silicon"

# 2. Herramientas de línea de comandos de Apple
if xcode-select -p >/dev/null 2>&1; then
  ok "Herramientas de línea de comandos de Apple"
else
  info "Faltan las herramientas de línea de comandos de Apple. Se abrirá su instalador."
  xcode-select --install || true
  fail "Cuando termine esa instalación, vuelve a ejecutar este script."
fi

# 3. Node.js (se pide 20 o superior)
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if (( NODE_MAJOR >= 20 )); then
    ok "Node.js $(node -v)"
  else
    fail "Node.js $(node -v) es antiguo. Instala la versión LTS desde https://nodejs.org y vuelve a ejecutar."
  fi
elif command -v brew >/dev/null 2>&1; then
  ask "Falta Node.js. ¿Instalarlo con Homebrew?" || fail "Sin Node.js no se puede continuar."
  brew install node
  ok "Node.js $(node -v)"
else
  fail "Falta Node.js. Instala la versión LTS desde https://nodejs.org y vuelve a ejecutar."
fi

# 4. Rust
[[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"
if command -v cargo >/dev/null 2>&1; then
  ok "Rust $(rustc --version | cut -d' ' -f2)"
else
  ask "Falta Rust. ¿Instalarlo con rustup (rustup.rs)?" || fail "Sin Rust no se puede continuar."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  . "$HOME/.cargo/env"
  ok "Rust $(rustc --version | cut -d' ' -f2)"
fi

# 5. Dependencias del proyecto
info "Instalando dependencias (npm install)..."
npm install
ok "Dependencias instaladas"

# 6. Qué hacer ahora
echo
echo "¿Qué quieres hacer?"
echo "  1) Arrancar XOLO en modo desarrollo (la primera vez tarda varios minutos en compilar)"
echo "  2) Generar la app XOLO.app"
echo "  3) Nada, salir"
read -r -p "Elige 1, 2 o 3: " CHOICE
case "$CHOICE" in
  1) npm run tauri dev ;;
  2)
    npm run tauri build
    OUT="src-tauri/target/release/bundle/macos"
    ok "App generada en $OUT/XOLO.app"
    info "Sin firmar: la primera vez, macOS pedirá Ajustes del Sistema > Privacidad y seguridad > \"Abrir igualmente\"."
    open "$OUT" || true
    ;;
  *) ok "Listo. Para arrancar más tarde: npm run tauri dev" ;;
esac
