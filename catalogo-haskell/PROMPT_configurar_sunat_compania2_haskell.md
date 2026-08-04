# Prompt para Claude Code (VS Code) — Configurar facturación electrónica SUNAT para la Compañía 2 (Haskell_Distribuidor)

Copia y pega esto en Claude Code. No lo ejecutes hasta que Alberto confirme que ya tiene certificado digital o cuenta PSE/OSE lista — pregúntaselo primero si no te lo ha dicho.

---

## Contexto

En esta instancia de Odoo hay dos compañías: **Efficax** (Compañía 1, ya tiene facturación electrónica SUNAT funcionando) y **Haskell_Distribuidor** (Compañía 2, catálogo de productos ya migrado, pero SUNAT nunca se configuró — cero facturas/boletas emitidas hasta hoy).

Son dos RUC distintos e independientes — Haskell_Distribuidor no hereda nada de la configuración de Efficax:

- **RUC**: 10095397757
- **Titular**: Juan Alberto Ruiz Díaz (persona natural con negocio)
- **Régimen tributario**: RER (Régimen Especial de Renta) — permite emitir tanto boleta de venta como factura, sin restricción.

## Prerrequisito — no lo asumas, confírmalo con Alberto primero

Antes de tocar Odoo, confirma con Alberto que ya tiene uno de estos dos listo para el RUC 10095397757:
- Un certificado digital propio (persona natural con negocio), o
- Una cuenta contratada con un PSE/OSE (recomendado: Nubefact, que se integra con el módulo `l10n_pe_edi_odoofact` sin requerir certificado propio).

Si todavía no tiene ninguno de los dos, no sigas — repórtaselo como bloqueante, esto es un trámite suyo, no algo que puedas resolver desde el código.

## Qué construir

1. Confirma qué módulo de localización peruana está instalado y activo para la Compañía 2 (`l10n_pe`, `l10n_pe_edi`, y/o `l10n_pe_edi_odoofact` si se usa Nubefact) — puede ser el mismo que usa Efficax o requerir instalación/activación aparte, ya que en Odoo Online la activación de apps ya instaladas en la base de datos no requiere instalar módulo nuevo, pero la *configuración* sí es por compañía.
2. Configura los datos de la Compañía 2 en Odoo: RUC 10095397757, razón social/nombre del titular, régimen tributario RER si el módulo lo pide como campo.
3. Carga las credenciales que te dé Alberto (token + RUC de Nubefact, o certificado digital `.pfx`/`.p12`/`.cer` según corresponda) — nunca las inventes ni las copies de la Compañía 1.
4. Configura las series de comprobantes para la Compañía 2 (ej. B001 para boleta, F001 para factura) — confirma con Alberto los códigos exactos si ya los tiene asignados, no los asumas.
5. Prueba emitiendo **una boleta** y **una factura** reales (o de prueba, si SUNAT/Nubefact ofrece ambiente de pruebas — confírmalo, no asumas que hay que usar datos reales de un cliente) para la Compañía 2, y confirma que ambas se validan correctamente.

## Al terminar, reporta

- Qué módulo(s) de localización peruana quedaron activos para la Compañía 2.
- Series de comprobantes configuradas.
- Resultado de la prueba de boleta y de factura (validado o el error exacto si falló).
- Cualquier dato que Alberto no te haya dado y hayas tenido que pedirle a mitad de camino.

## Después de esto

Con esto resuelto, queda desbloqueada la tarea de facturación automática (que además depende de corregir `orders.service.ts:261`, donde el producto/precio del pedido llega hardcodeado a Odoo — esa es una tarea aparte, no la mezcles con esta).
