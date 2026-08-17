-- EP-12: reprogramar una entrega fallida (fecha + motivo + contador),
-- columnas nuevas nullable/con default — seguro para filas existentes.
ALTER TABLE "entregas"
  ADD COLUMN "fechaReprogramada" TIMESTAMP(3),
  ADD COLUMN "motivoReprogramacion" TEXT,
  ADD COLUMN "vecesReprogramada" INTEGER NOT NULL DEFAULT 0;
