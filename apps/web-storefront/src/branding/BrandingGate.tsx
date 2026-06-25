import { useEffect, ReactNode } from 'react';
import { useBranding } from './useBranding';

/**
 * Gate de branding: carga el theme del tenant antes de renderizar la tienda.
 * Maneja los tres estados (loading / error / ready) — requisito de UX
 * production-grade para que el storefront nunca "parpadee" sin identidad.
 */
export function BrandingGate({ children }: { children: ReactNode }) {
  const { status, load } = useBranding();

  useEffect(() => {
    if (status === 'idle') load();
  }, [status, load]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="brand-splash" role="status" aria-busy="true">
        <div className="spinner" />
        <p>Cargando tienda…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="brand-splash error">
        <h2>Tienda no disponible</h2>
        <p>No pudimos cargar esta tienda. Verificá la dirección e intentá de nuevo.</p>
        <button onClick={() => load()}>Reintentar</button>
      </div>
    );
  }

  return <>{children}</>;
}
