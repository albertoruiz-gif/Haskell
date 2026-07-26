// Logotipo de texto — no hay un archivo de logo real en el proyecto
// (ningún .png/.svg de marca en el repo). Si en algún momento se agrega
// uno, este componente es el único lugar a cambiar.

export function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-bosque text-sm font-bold text-white">H</span>
      <span className="text-base font-semibold tracking-tight text-bosque">
        Haskell<span className="text-acento">.</span>
      </span>
    </div>
  );
}
