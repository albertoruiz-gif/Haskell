import { RolUsuario } from '@prisma/client';

export interface PermisoCatalogoItem {
  /** "<NombreDeClaseController>.<metodo>" — mismo par que arma RolesGuard
   *  en tiempo de ejecución (context.getClass().name/getHandler().name). */
  clave: string;
  modulo: string;
  etiqueta: string;
  rolesPorDefecto: RolUsuario[];
}

// EP-01: catálogo estático de TODO endpoint que hoy usa @Roles() en algún
// controller (generado a mano el 2026-08-16, auditado contra el código real
// de los 24 controllers del backend). Sirve dos cosas: (1) los defaults acá
// deben coincidir EXACTO con lo compilado en cada @Roles(), porque
// PermisosService.rolesEfectivos() cae en este valor cuando no hay override
// en la tabla permisos_override; (2) es lo que arma la pantalla de Gestión →
// Permisos (etiqueta + agrupación por módulo). Un endpoint sin restricción
// de rol (abierto a cualquier autenticado, ej. login, checkout) a propósito
// NO aparece acá — el mecanismo de override solo tiene sentido sobre algo
// que hoy YA está restringido.
export const PERMISOS_CATALOGO: PermisoCatalogoItem[] = [
  // --- Usuarios y accesos (AuthController) ---
  { clave: 'AuthController.desactivar', modulo: 'Usuarios y accesos', etiqueta: 'Desactivar una cuenta', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'AuthController.reactivar', modulo: 'Usuarios y accesos', etiqueta: 'Reactivar una cuenta', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'AuthController.cerrarSesiones', modulo: 'Usuarios y accesos', etiqueta: 'Cerrar la sesión de un usuario', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'AuthController.resetear2FA', modulo: 'Usuarios y accesos', etiqueta: 'Resetear el 2FA de un usuario', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'AuthController.listarPorRol', modulo: 'Usuarios y accesos', etiqueta: 'Listar usuarios por rol', rolesPorDefecto: ['ADMINISTRADOR', 'ALMACEN'] },
  { clave: 'AuthController.listarUsuariosAdministrativos', modulo: 'Usuarios y accesos', etiqueta: 'Listar cuentas administrativas', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'AuthController.crearUsuarioAdministrativo', modulo: 'Usuarios y accesos', etiqueta: 'Crear cuenta administrativa', rolesPorDefecto: ['ADMINISTRADOR'] },

  // --- Afiliación de asesores (AfiliacionController) ---
  { clave: 'AfiliacionController.listar', modulo: 'Afiliación de asesores', etiqueta: 'Listar asesores afiliados', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA'] },
  { clave: 'AfiliacionController.crearIndividual', modulo: 'Afiliación de asesores', etiqueta: 'Afiliar un asesor nuevo', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA'] },
  { clave: 'AfiliacionController.previsualizar', modulo: 'Afiliación de asesores', etiqueta: 'Previsualizar carga masiva (Excel)', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'AfiliacionController.confirmar', modulo: 'Afiliación de asesores', etiqueta: 'Confirmar carga masiva (Excel)', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'AfiliacionController.reasignarLider', modulo: 'Afiliación de asesores', etiqueta: 'Reasignar el líder de un asesor', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'AfiliacionController.historialAsignaciones', modulo: 'Afiliación de asesores', etiqueta: 'Ver historial de reasignaciones de un asesor', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },

  // --- Líderes de equipo (LideresController) ---
  { clave: 'LideresController.crear', modulo: 'Líderes de equipo', etiqueta: 'Crear un líder', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'LideresController.listar', modulo: 'Líderes de equipo', etiqueta: 'Listar líderes', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'LideresController.actualizarComision', modulo: 'Líderes de equipo', etiqueta: 'Editar comisión de un líder', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'LideresController.comisionGanada', modulo: 'Líderes de equipo', etiqueta: 'Ver comisión ganada de un líder', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA'] },
  { clave: 'LideresController.resumenEquipo', modulo: 'Líderes de equipo', etiqueta: 'Ver resumen "Mi equipo" de un líder', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA'] },

  // --- Gerentes comerciales (GerentesComercialesController) ---
  { clave: 'GerentesComercialesController.crear', modulo: 'Gerentes comerciales', etiqueta: 'Crear un gerente comercial', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'GerentesComercialesController.listar', modulo: 'Gerentes comerciales', etiqueta: 'Listar gerentes comerciales', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'GerentesComercialesController.actualizarComision', modulo: 'Gerentes comerciales', etiqueta: 'Editar comisión de un gerente comercial', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'GerentesComercialesController.comisionGanada', modulo: 'Gerentes comerciales', etiqueta: 'Ver comisión ganada de un gerente comercial', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },

  // --- Clientes, crédito y descuentos (ClientesController) ---
  { clave: 'ClientesController.crear', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Registrar un cliente', rolesPorDefecto: ['ASESOR'] },
  { clave: 'ClientesController.listar', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Listar clientes', rolesPorDefecto: ['ASESOR', 'GERENTE_COMERCIAL', 'ADMINISTRADOR'] },
  { clave: 'ClientesController.obtener', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Ver detalle de un cliente', rolesPorDefecto: ['ASESOR', 'GERENTE_COMERCIAL', 'ADMINISTRADOR'] },
  { clave: 'ClientesController.marcarEstado', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Cambiar estado de un cliente (activo/moroso/bloqueado)', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'ClientesController.solicitarCredito', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Pedir línea de crédito para un cliente', rolesPorDefecto: ['ASESOR'] },
  { clave: 'ClientesController.listarSolicitudes', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Ver solicitudes de crédito', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'ClientesController.aprobarSolicitud', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Aprobar solicitud de crédito', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'ClientesController.rechazarSolicitud', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Rechazar solicitud de crédito', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'ClientesController.solicitarDescuento', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Pedir descuento por volumen para un cliente', rolesPorDefecto: ['ASESOR'] },
  { clave: 'ClientesController.listarSolicitudesDescuento', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Ver solicitudes de descuento', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL'] },
  { clave: 'ClientesController.aprobarSolicitudDescuento', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Aprobar solicitud de descuento', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL'] },
  { clave: 'ClientesController.rechazarSolicitudDescuento', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Rechazar solicitud de descuento', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL'] },
  { clave: 'ClientesController.registrarCobro', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Registrar un cobro de cliente', rolesPorDefecto: ['ASESOR', 'GERENTE_COMERCIAL', 'ADMINISTRADOR', 'FINANZAS'] },
  { clave: 'ClientesController.listarCobros', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Ver bandeja de cobros a validar', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'ClientesController.validarCobro', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Validar un cobro (aplica al saldo del cliente)', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'ClientesController.rechazarCobro', modulo: 'Clientes, crédito y descuentos', etiqueta: 'Rechazar un cobro', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'FINANZAS'] },

  // --- Catálogo de productos (CatalogController) ---
  { clave: 'CatalogController.listarLineas', modulo: 'Catálogo de productos', etiqueta: 'Listar productos (panel admin)', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO', 'ALMACEN'] },
  { clave: 'CatalogController.crearLinea', modulo: 'Catálogo de productos', etiqueta: 'Crear un producto', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogController.sincronizarDesdeOdoo', modulo: 'Catálogo de productos', etiqueta: 'Sincronizar catálogo desde Odoo', rolesPorDefecto: ['ADMINISTRADOR', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogController.compararStockOdoo', modulo: 'Catálogo de productos', etiqueta: 'Comparar stock contra Odoo', rolesPorDefecto: ['ADMINISTRADOR', 'GESTOR_CATALOGO', 'ALMACEN'] },
  { clave: 'CatalogController.actualizarPrecio', modulo: 'Catálogo de productos', etiqueta: 'Editar precio de un producto', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogController.definirPack', modulo: 'Catálogo de productos', etiqueta: 'Armar un pack de productos', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogController.actualizarLinea', modulo: 'Catálogo de productos', etiqueta: 'Editar datos de un producto', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogController.subirFoto', modulo: 'Catálogo de productos', etiqueta: 'Subir foto principal de un producto', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogController.eliminarLinea', modulo: 'Catálogo de productos', etiqueta: 'Eliminar un producto', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogController.subirFotosAdicionales', modulo: 'Catálogo de productos', etiqueta: 'Subir fotos adicionales de un producto', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },

  // --- Catálogos digitales (CatalogosDigitalesController) ---
  { clave: 'CatalogosDigitalesController.listar', modulo: 'Catálogos digitales', etiqueta: 'Listar catálogos digitales (flipbook)', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogosDigitalesController.subir', modulo: 'Catálogos digitales', etiqueta: 'Subir un catálogo digital', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogosDigitalesController.cambiarActivo', modulo: 'Catálogos digitales', etiqueta: 'Activar/desactivar un catálogo digital', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CatalogosDigitalesController.eliminar', modulo: 'Catálogos digitales', etiqueta: 'Eliminar un catálogo digital', rolesPorDefecto: ['ADMINISTRADOR'] },

  // --- Campañas y ofertas (CampaignsController) ---
  { clave: 'CampaignsController.crearCampania', modulo: 'Campañas y ofertas', etiqueta: 'Crear una campaña', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'CampaignsController.listarCampanias', modulo: 'Campañas y ofertas', etiqueta: 'Listar campañas', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CampaignsController.listarCatalogos', modulo: 'Campañas y ofertas', etiqueta: 'Listar catálogos de una campaña', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CampaignsController.crearCatalogo', modulo: 'Campañas y ofertas', etiqueta: 'Crear un catálogo dentro de una campaña', rolesPorDefecto: ['ADMINISTRADOR', 'GESTOR_CATALOGO'] },
  { clave: 'CampaignsController.aprobarCatalogo', modulo: 'Campañas y ofertas', etiqueta: 'Aprobar un catálogo', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'CampaignsController.observarCatalogo', modulo: 'Campañas y ofertas', etiqueta: 'Observar (rechazar con motivo) un catálogo', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'CampaignsController.publicarCatalogo', modulo: 'Campañas y ofertas', etiqueta: 'Publicar un catálogo', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'CampaignsController.suspenderCatalogo', modulo: 'Campañas y ofertas', etiqueta: 'Suspender un catálogo', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'CampaignsController.crearOferta', modulo: 'Campañas y ofertas', etiqueta: 'Crear una oferta', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'CampaignsController.listarOfertas', modulo: 'Campañas y ofertas', etiqueta: 'Listar ofertas', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'] },
  { clave: 'CampaignsController.desactivarOferta', modulo: 'Campañas y ofertas', etiqueta: 'Desactivar una oferta', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },

  // --- Precios (PricingController) ---
  { clave: 'PricingController.actualizar', modulo: 'Precios', etiqueta: 'Editar % de ganancia del asesor', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },

  // --- Tarifas de envío (TarifasController) ---
  { clave: 'TarifasController.listar', modulo: 'Tarifas de envío', etiqueta: 'Listar tarifas por distrito', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'TarifasController.crear', modulo: 'Tarifas de envío', etiqueta: 'Crear una tarifa', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'TarifasController.actualizar', modulo: 'Tarifas de envío', etiqueta: 'Editar una tarifa', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'TarifasController.importar', modulo: 'Tarifas de envío', etiqueta: 'Importar tarifas (Excel)', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },

  // --- Inventario (InventarioController) ---
  { clave: 'InventarioController.crearLote', modulo: 'Inventario', etiqueta: 'Registrar un lote de inventario', rolesPorDefecto: ['ADMINISTRADOR', 'ALMACEN'] },
  { clave: 'InventarioController.listarLotes', modulo: 'Inventario', etiqueta: 'Listar lotes de inventario', rolesPorDefecto: ['ADMINISTRADOR', 'ALMACEN', 'GERENTE_COMERCIAL'] },
  { clave: 'InventarioController.cambiarEstadoLote', modulo: 'Inventario', etiqueta: 'Cambiar estado de un lote', rolesPorDefecto: ['ADMINISTRADOR', 'ALMACEN'] },
  { clave: 'InventarioController.stockBreakdown', modulo: 'Inventario', etiqueta: 'Ver desglose de stock por producto', rolesPorDefecto: ['ADMINISTRADOR', 'ALMACEN', 'GERENTE_COMERCIAL'] },

  // --- Pedidos (OrdersController) ---
  { clave: 'OrdersController.listar', modulo: 'Pedidos', etiqueta: 'Listar pedidos (panel admin)', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'ALMACEN'] },
  { clave: 'OrdersController.seguimiento', modulo: 'Pedidos', etiqueta: 'Ver seguimiento de un pedido', rolesPorDefecto: ['ASESOR', 'ADMINISTRADOR', 'GERENTE_COMERCIAL', 'ALMACEN'] },
  { clave: 'OrdersController.validarPago', modulo: 'Pedidos', etiqueta: 'Validar el pago de un pedido', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'OrdersController.registrarDeposito', modulo: 'Pedidos', etiqueta: 'Registrar depósito de un pedido al crédito', rolesPorDefecto: ['ASESOR'] },
  { clave: 'OrdersController.validarDeposito', modulo: 'Pedidos', etiqueta: 'Validar depósito de un pedido al crédito', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'OrdersController.rechazar', modulo: 'Pedidos', etiqueta: 'Rechazar un pedido', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },

  // --- Picking, packing y despacho (OperacionesController) ---
  { clave: 'OperacionesController.pickingList', modulo: 'Picking, packing y despacho', etiqueta: 'Ver lista de picking de un pedido', rolesPorDefecto: ['ALMACEN', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.confirmarPicking', modulo: 'Picking, packing y despacho', etiqueta: 'Confirmar picking de un pedido', rolesPorDefecto: ['ALMACEN', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.confirmarPacking', modulo: 'Picking, packing y despacho', etiqueta: 'Confirmar packing de un pedido', rolesPorDefecto: ['ALMACEN', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.asignarTransportista', modulo: 'Picking, packing y despacho', etiqueta: 'Asignar transportista a un pedido', rolesPorDefecto: ['ALMACEN', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.aceptarBultos', modulo: 'Picking, packing y despacho', etiqueta: 'Aceptar bultos asignados (transportista)', rolesPorDefecto: ['TRANSPORTISTA', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.marcarEnRuta', modulo: 'Picking, packing y despacho', etiqueta: 'Marcar pedido en ruta', rolesPorDefecto: ['TRANSPORTISTA', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.confirmarEntrega', modulo: 'Picking, packing y despacho', etiqueta: 'Confirmar entrega de un pedido', rolesPorDefecto: ['TRANSPORTISTA', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.entregaFallida', modulo: 'Picking, packing y despacho', etiqueta: 'Registrar entrega fallida', rolesPorDefecto: ['TRANSPORTISTA', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.reprogramarEntrega', modulo: 'Picking, packing y despacho', etiqueta: 'Reprogramar una entrega fallida', rolesPorDefecto: ['ALMACEN', 'ADMINISTRADOR'] },
  { clave: 'OperacionesController.listarPagos', modulo: 'Picking, packing y despacho', etiqueta: 'Ver pagos a transportistas', rolesPorDefecto: ['ADMINISTRADOR', 'ALMACEN'] },
  { clave: 'OperacionesController.marcarPagado', modulo: 'Picking, packing y despacho', etiqueta: 'Marcar pago a transportista como pagado', rolesPorDefecto: ['ADMINISTRADOR'] },

  // --- Transporte (TransportistasController) ---
  { clave: 'TransportistasController.listar', modulo: 'Transporte', etiqueta: 'Listar transportistas', rolesPorDefecto: ['ADMINISTRADOR', 'ALMACEN'] },
  { clave: 'TransportistasController.crear', modulo: 'Transporte', etiqueta: 'Registrar un transportista', rolesPorDefecto: ['ADMINISTRADOR'] },
  { clave: 'TransportistasController.actualizarTarifa', modulo: 'Transporte', etiqueta: 'Editar tarifa por entrega de un transportista', rolesPorDefecto: ['ADMINISTRADOR'] },

  // --- Premios e incentivos (PremiosController) ---
  { clave: 'PremiosController.crear', modulo: 'Premios e incentivos', etiqueta: 'Crear un nivel de premio', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'PremiosController.actualizar', modulo: 'Premios e incentivos', etiqueta: 'Editar un nivel de premio', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'PremiosController.retirar', modulo: 'Premios e incentivos', etiqueta: 'Retirar un nivel de premio', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'PremiosController.miResumen', modulo: 'Premios e incentivos', etiqueta: 'Ver mi propio resumen de premios (asesor)', rolesPorDefecto: ['ASESOR'] },
  { clave: 'PremiosController.miSerie', modulo: 'Premios e incentivos', etiqueta: 'Ver mi propia serie mensual (asesor)', rolesPorDefecto: ['ASESOR'] },
  { clave: 'PremiosController.miHistorial', modulo: 'Premios e incentivos', etiqueta: 'Ver mi propio historial de premios (asesor)', rolesPorDefecto: ['ASESOR'] },
  { clave: 'PremiosController.miHistorialVentas', modulo: 'Premios e incentivos', etiqueta: 'Ver mi propio historial de ventas (asesor)', rolesPorDefecto: ['ASESOR'] },
  { clave: 'PremiosController.serieDeAsesor', modulo: 'Premios e incentivos', etiqueta: 'Ver serie mensual de cualquier asesor', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA'] },
  { clave: 'PremiosController.historialDeAsesor', modulo: 'Premios e incentivos', etiqueta: 'Ver historial de premios de cualquier asesor', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA'] },

  // --- Configuración (ConfiguracionController) ---
  { clave: 'ConfiguracionController.obtener', modulo: 'Configuración', etiqueta: 'Ver configuración del sistema', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'ConfiguracionController.actualizar', modulo: 'Configuración', etiqueta: 'Editar configuración del sistema', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },

  // --- Indicadores (IndicadoresController) ---
  { clave: 'IndicadoresController.gerencial', modulo: 'Indicadores', etiqueta: 'Ver tablero gerencial', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'IndicadoresController.comercial', modulo: 'Indicadores', etiqueta: 'Ver indicadores comerciales', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'IndicadoresController.ventasPorCanal', modulo: 'Indicadores', etiqueta: 'Ver ventas por canal', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'IndicadoresController.finanzas', modulo: 'Indicadores', etiqueta: 'Ver indicadores financieros', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'IndicadoresController.operaciones', modulo: 'Indicadores', etiqueta: 'Ver indicadores de operaciones', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'IndicadoresController.marketing', modulo: 'Indicadores', etiqueta: 'Ver indicadores de marketing', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'IndicadoresController.serie', modulo: 'Indicadores', etiqueta: 'Ver serie histórica de un indicador', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'IndicadoresController.productosTop', modulo: 'Indicadores', etiqueta: 'Ver productos top', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'IndicadoresController.miSerie', modulo: 'Indicadores', etiqueta: 'Ver mi propia serie (asesor)', rolesPorDefecto: ['ASESOR'] },
  { clave: 'IndicadoresController.misProductosTop', modulo: 'Indicadores', etiqueta: 'Ver mis propios productos top (asesor)', rolesPorDefecto: ['ASESOR'] },

  // --- Metas (MetasController) ---
  { clave: 'MetasController.listar', modulo: 'Metas', etiqueta: 'Listar metas', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'MetasController.crear', modulo: 'Metas', etiqueta: 'Crear una meta', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL'] },
  { clave: 'MetasController.actualizar', modulo: 'Metas', etiqueta: 'Editar una meta', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL'] },

  // --- Gasto de marketing (GastoMarketingController) ---
  { clave: 'GastoMarketingController.listar', modulo: 'Gasto de marketing', etiqueta: 'Listar gastos de marketing', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'GastoMarketingController.crear', modulo: 'Gasto de marketing', etiqueta: 'Registrar un gasto de marketing', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL'] },

  // --- Datos financieros (DatosFinancierosController) ---
  { clave: 'DatosFinancierosController.listar', modulo: 'Datos financieros', etiqueta: 'Ver datos financieros', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },
  { clave: 'DatosFinancierosController.guardar', modulo: 'Datos financieros', etiqueta: 'Registrar un dato financiero', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] },

  // --- Libro de reclamaciones (LibroReclamacionesController) ---
  { clave: 'LibroReclamacionesController.listar', modulo: 'Libro de reclamaciones', etiqueta: 'Listar reclamos', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
  { clave: 'LibroReclamacionesController.responder', modulo: 'Libro de reclamaciones', etiqueta: 'Responder un reclamo', rolesPorDefecto: ['ADMINISTRADOR', 'GERENTE_COMERCIAL'] },
];
