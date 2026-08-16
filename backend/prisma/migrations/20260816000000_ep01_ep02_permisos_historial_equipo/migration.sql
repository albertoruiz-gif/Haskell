-- EP-01: overrides de roles por endpoint (Gestión → Permisos)
CREATE TABLE "permisos_override" (
    "clave" TEXT NOT NULL,
    "roles" "RolUsuario"[],
    "actualizadoPorId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permisos_override_pkey" PRIMARY KEY ("clave")
);

-- EP-02: historial de reasignación de líder por asesor de Comercio Minorista
CREATE TABLE "historial_asignaciones_asesor" (
    "id" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "liderAnteriorId" TEXT,
    "liderNuevoId" TEXT,
    "actorId" TEXT NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_asignaciones_asesor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historial_asignaciones_asesor_asesorId_idx" ON "historial_asignaciones_asesor"("asesorId");

ALTER TABLE "historial_asignaciones_asesor" ADD CONSTRAINT "historial_asignaciones_asesor_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "asesores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "historial_asignaciones_asesor" ADD CONSTRAINT "historial_asignaciones_asesor_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
