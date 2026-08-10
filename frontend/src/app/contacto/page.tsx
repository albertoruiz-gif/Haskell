import { AvisoLibroReclamaciones } from '../../components/ui/AvisoLibroReclamaciones';

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-card bg-white p-5 shadow-sm">
      <h1 className="text-lg font-medium text-bosque">Contacto</h1>
      <p className="text-sm text-bosque/70">
        Juan Alberto Ruiz Díaz — RUC 10095397757, operando bajo la marca comercial Haskell / Haskell Cosméticos.
      </p>

      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-bosque/50">Dirección</dt>
          <dd className="text-bosque">Av. Géminis H-16, San Borja, Lima, Perú</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-bosque/50">Teléfono</dt>
          <dd className="text-bosque">
            <a href="tel:+51999420044" className="text-acento">
              +51 999 420 044
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-bosque/50">Correo</dt>
          <dd className="text-bosque">
            <a href="mailto:alberto.ruiz@efficaxba.com" className="text-acento">
              alberto.ruiz@efficaxba.com
            </a>
          </dd>
        </div>
      </dl>

      <AvisoLibroReclamaciones />
    </div>
  );
}
