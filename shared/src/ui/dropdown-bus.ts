// Bus de cierre de dropdowns — shared/src/ui/dropdown-bus.ts
// Cierre determinista de FilterDropdown al navegar desde una notificación.
// Causa: el cierre por evento 'blur' de navegación no llegaba a runtime en web
// y el Modal de opciones quedaba pintado ENCIMA del detalle ("abre detrás del filtro").
// Al tocar una notificación, NotificationBell emite cerrarDropdownsAbiertos()
// y cada FilterDropdown montado cierra su Modal de forma sincrónica.
type Listener = () => void;

const listeners = new Set<Listener>();

export function suscribirCerrarDropdowns(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function cerrarDropdownsAbiertos(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // Un dropdown roto no debe bloquear la navegación
    }
  });
}
