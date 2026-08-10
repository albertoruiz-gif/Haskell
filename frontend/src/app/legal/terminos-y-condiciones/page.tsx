import Link from 'next/link';
import { AvisoLibroReclamaciones } from '../../../components/ui/AvisoLibroReclamaciones';

// Borrador base — ver docs/PROMPT_culqi_requisitos_web.md. NO es asesoría
// legal: falta revisión de un abogado antes de considerarse definitivo,
// especialmente los puntos marcados como pendientes abajo.
export default function TerminosPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 rounded-card bg-white p-5 text-sm leading-relaxed text-bosque/80 shadow-sm">
      <div className="rounded-card bg-crema p-3 text-xs text-bosque/60">
        Versión borrador, pendiente de revisión legal final.
      </div>

      <h1 className="text-lg font-medium text-bosque">Términos y Condiciones</h1>

      <p>
        <strong>Juan Alberto Ruiz Díaz</strong>, persona natural con negocio identificada con RUC{' '}
        <strong>10095397757</strong> (acogido al Régimen Especial de Renta — RER), operando bajo la marca comercial{' '}
        <strong>Haskell / Haskell Cosméticos</strong>, con domicilio en <strong>Av. Géminis H-16, San Borja, Lima,
        Perú</strong> (en adelante, &ldquo;la Empresa&rdquo;), pone a disposición de los usuarios el presente sitio
        web sujeto a los siguientes términos:
      </p>

      <h2 className="text-base font-medium text-bosque">1. Objeto</h2>
      <p>
        La Empresa comercializa productos de belleza y cuidado personal a través de este sitio (haskell.com.pe) y de
        su red de asesoras/asesores comerciales.
      </p>

      <h2 className="text-base font-medium text-bosque">2. Registro y cuentas</h2>
      <p>
        El acceso a la compra requiere registro como asesor/a autorizado/a. La Empresa se reserva el derecho de
        verificar la identidad de los usuarios registrados.
      </p>

      <h2 className="text-base font-medium text-bosque">3. Precios y pagos</h2>
      <p>
        Los precios se muestran en Soles (S/) e incluyen los impuestos de ley. El pago se procesa mediante Culqi
        (Yape) u otros medios que la Empresa habilite. Todo pedido queda sujeto a confirmación de pago y
        disponibilidad de stock.
      </p>

      <h2 className="text-base font-medium text-bosque">4. Envíos</h2>
      <p>Los plazos y costos de envío se calculan según el distrito de entrega registrado, y se muestran antes de confirmar el pedido.</p>

      <h2 className="text-base font-medium text-bosque">5. Cambios y devoluciones</h2>
      <p>
        Ver{' '}
        <Link href="/legal/politica-de-cambios-y-devoluciones" className="font-medium text-acento">
          Política de Cambios y Devoluciones
        </Link>
        .
      </p>

      <h2 className="text-base font-medium text-bosque">6. Libro de Reclamaciones</h2>
      <AvisoLibroReclamaciones />

      <h2 className="text-base font-medium text-bosque">7. Protección de datos personales</h2>
      <p>
        Los datos personales recopilados se tratan conforme a la Ley N.° 29733, Ley de Protección de Datos
        Personales, y su reglamento.
      </p>
      <p className="rounded-card bg-red-50 p-2 text-xs text-red-700">
        Pendiente: confirmar si existe una Política de Privacidad separada o si se cubre solo con esta sección.
      </p>

      <h2 className="text-base font-medium text-bosque">8. Contacto</h2>
      <p>
        alberto.ruiz@efficaxba.com · +51 999 420 044 · Av. Géminis H-16, San Borja, Lima, Perú
      </p>

      <h2 className="text-base font-medium text-bosque">9. Modificaciones</h2>
      <p>La Empresa puede modificar estos términos en cualquier momento; la versión vigente es la publicada en este sitio.</p>
    </article>
  );
}
