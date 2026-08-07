# Prompt para Claude Code (VS Code) — Resultado de la investigación de estados de pago

Copia y pega esto en la misma sesión de Claude Code donde le pediste `PROMPT_investigar_estados_pago.md` (o en una nueva, dentro del repo `plataforma-comercial-multicanal`, si es otra sesión).

---

Hace un tiempo te pedí investigar (sin cambiar código) los estados reales de pago de un pedido en esta plataforma — el pedido en `Gestión → Pagos` puede aparecer como "Pendiente de validar", "Validado" o "Rechazado".

Necesito que me confirmes:

1. ¿Llegaste a completar esa investigación? Si sí, dame el resultado completo: la lista exacta de todos los estados de pago que existen en el código (no solo los que se ven en la UI), el archivo y las líneas donde está definido cada uno, y si "Rechazado" tiene un campo de motivo/razón asociado (por ejemplo, por qué se rechazó un pago específico).

2. Si no la completaste o no la recuerdas, hazla ahora: busca en el código (probablemente en el schema de Prisma y/o el backend, cerca de donde se usan esos tres textos) el enum/tipo de estado de pago, y repórtame lo mismo que el punto 1.

3. Adicional a lo anterior, dime también: ¿el registro de un pedido guarda el número de teléfono del cliente o del asesor como campo indexado/buscable? Pregunto porque probé consultar un pedido por número de teléfono en Hasky y no encontró nada — quiero saber si ese dato existe en el modelo de pedido antes de asumir que fue un problema de otra parte.

No propongas ni hagas ningún cambio de código en esta tarea — es solo para que me reportes lo que ya existe.
