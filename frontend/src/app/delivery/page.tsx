'use client';

// Pantalla "Delivery" — operativa, del responsable de Almacén: asignar
// transportista a pedidos ya empacados y hacer seguimiento del despacho
// (asignado → en tránsito → entregado/devuelto, con motivo). La creación
// de transportistas, el tarifario y los pagos son administrativos y viven
// en Gestión → Transporte.

import { DespachoSection } from '../../components/admin/transporte/DespachoSection';

export default function DeliveryPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-bosque">Delivery</h1>
      <DespachoSection />
    </div>
  );
}
