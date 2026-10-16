import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/** Si el modelo 3D no carga, muestra la reserva (esfera) en lugar de dejar la ventana vacía. */
export class ModelBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("No se pudo cargar el modelo 3D; se usa la esfera.", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
