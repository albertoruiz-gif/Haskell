// Logo oficial de Haskell Cosméticos (frontend/public/logo-haskell.webp).
// Único lugar donde se usa — si el archivo cambia, alcanza con reemplazar
// ese .webp o actualizar la ruta acá.

export function Logo({ className = 'h-14' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-haskell.webp" alt="Haskell Cosméticos" className={`${className} w-auto shrink-0`} />;
}
