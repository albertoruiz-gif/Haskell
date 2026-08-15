/**
 * Chequeo puntual y de una sola vez: ¿la Compañía 2 (Haskell_Distribuidor)
 * ya tiene plan de cuentas / diarios / impuestos generados tras elegir el
 * paquete fiscal "PE Perú" (docs/odoo/PARAMETRIZACION_ODOO_HASKELL.md §8.3)?
 * No se agrega como script permanente — es diagnóstico de EP-13.
 */
import 'dotenv/config';
import axios from 'axios';

async function main() {
  const url = process.env.ODOO_URL!;
  const db = process.env.ODOO_DB!;
  const username = process.env.ODOO_USERNAME!;
  const apiKey = process.env.ODOO_API_KEY!;
  const companyId = Number(process.env.ODOO_COMPANY_ID);

  const http = axios.create({ baseURL: url, timeout: 15000 });

  const authRes = await http.post('/jsonrpc', {
    jsonrpc: '2.0', method: 'call',
    params: { service: 'common', method: 'authenticate', args: [db, username, apiKey, {}] },
  });
  const uid = authRes.data.result;
  if (!uid) throw new Error('No se pudo autenticar: ' + JSON.stringify(authRes.data));
  console.log('Autenticado, uid:', uid);

  async function searchRead(model: string, domain: unknown[], fields: string[]) {
    const res = await http.post('/jsonrpc', {
      jsonrpc: '2.0', method: 'call',
      params: {
        service: 'object', method: 'execute_kw',
        args: [db, uid, apiKey, model, 'search_read', [domain], { fields, context: { allowed_company_ids: [companyId], company_id: companyId } }],
      },
    });
    if (res.data.error) throw new Error(JSON.stringify(res.data.error));
    return res.data.result;
  }

  console.log('\n--- Compañia ---');
  const compania = await searchRead('res.company', [['id', '=', companyId]], ['name', 'vat', 'l10n_pe_edi_provider', 'account_fiscal_country_id']);
  console.log(compania);

  console.log('\n--- Cuentas contables (account.account) ---');
  const cuentas = await searchRead('account.account', [['company_ids', 'in', [companyId]]], ['id', 'name', 'code']);
  console.log('Total:', cuentas.length);
  console.log(cuentas.slice(0, 5));

  console.log('\n--- Diarios (account.journal) ---');
  const diarios = await searchRead('account.journal', [['company_id', '=', companyId]], ['id', 'name', 'type', 'code', 'l10n_latam_use_documents']);
  console.log(diarios);

  console.log('\n--- Impuestos (account.tax) ---');
  const impuestos = await searchRead('account.tax', [['company_id', '=', companyId]], ['id', 'name', 'amount']);
  console.log('Total:', impuestos.length);
  console.log(impuestos.slice(0, 5));

  console.log('\n--- Tipos de documento SUNAT disponibles (l10n_latam.document.type) ---');
  const tiposDoc = await searchRead('l10n_latam.document.type', [['code', 'in', ['01', '03']]], ['id', 'name', 'code']);
  console.log(tiposDoc);

  console.log('\n--- Todos los campos del diario "Sales" (id 26) — buscando cuantos tipos de documento soporta ---');
  const journalId = 26;
  const diarioCompleto = await searchRead('account.journal', [['id', '=', journalId]], []);
  const campo = diarioCompleto[0];
  const clavesRelevantes = Object.keys(campo).filter((k) => k.includes('latam') || k.includes('l10n_pe') || k.includes('document'));
  console.log('Campos relacionados a documentos/latam encontrados:', clavesRelevantes);
  for (const k of clavesRelevantes) console.log(` ${k}:`, campo[k]);
}

main().catch((e) => {
  console.error('FALLÓ:', e.message);
  process.exit(1);
});
