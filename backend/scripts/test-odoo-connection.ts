/**
 * Prueba manual de la conexion a Odoo — NO se ejecuta en CI, es para correr
 * a mano una vez que .env tenga las credenciales reales (ODOO_URL, ODOO_DB,
 * ODOO_USERNAME, ODOO_API_KEY, ODOO_COMPANY_ID).
 *
 * Uso:  npm run test:odoo   (desde backend/)
 *
 * A proposito nunca imprime ODOO_API_KEY ni ningun otro secreto — solo
 * confirma que la autenticacion funciono y que los datos que vuelven
 * corresponden a la compañia configurada.
 */
import 'dotenv/config';
import { SecretsService } from '../src/config/secrets.service';
import { OdooClient } from '../src/modules/odoo/odoo.client';

async function main() {
  console.log('--- Prueba de conexion a Odoo 19 Online ---');

  const secrets = new SecretsService();
  const { url, db, companyId } = secrets.odoo(); // valida que ODOO_COMPANY_ID sea un numero valido
  console.log(`URL: ${url}`);
  console.log(`Base de datos: ${db}`);
  console.log(`Compañia configurada (ODOO_COMPANY_ID): ${companyId}`);

  const client = new OdooClient(secrets);

  console.log('\n1) Autenticando y trayendo productos (product.product)...');
  const productos = await client.obtenerProductos();
  console.log(`   OK — se autenticó correctamente. Productos visibles: ${productos.length}`);
  if (productos.length > 0) {
    const ejemplo = productos[0];
    console.log(`   Ejemplo: [${ejemplo.default_code ?? 's/codigo'}] ${ejemplo.name}`);
  } else {
    console.log('   (0 productos — puede ser normal si Haskell_Distribuidor aun no tiene productos activos, o revisar el filtro de compañia)');
  }

  console.log('\n2) Trayendo stock (stock.quant) de esos productos...');
  const ids = productos.slice(0, 20).map((p) => p.id);
  const stock = ids.length > 0 ? await client.obtenerStock(ids) : [];
  console.log(`   OK — registros de stock encontrados: ${stock.length}`);

  console.log('\n--- Prueba terminada sin errores ---');
  console.log('Si esperabas ver productos/stock de Haskell_Distribuidor y salió 0,');
  console.log('revisa en Odoo si esos productos realmente estan asignados a esa');
  console.log('compañia (o compartidos, company_id vacio) y si el usuario tecnico');
  console.log('tiene permiso de lectura sobre Ventas/Inventario/Contactos.');
}

main().catch((err) => {
  console.error('\n--- FALLÓ la conexión ---');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
