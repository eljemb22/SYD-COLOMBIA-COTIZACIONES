import alasql from 'alasql';
import {
  MedicalEquipment,
  SavedQuote,
  TenderClientProject,
  OCTrackingContract,
  SalesOrderRecord,
  SalesInvoiceRecord
} from '../types';

export interface SqlQueryResult {
  columns: string[];
  values: any[][];
}

export interface SyDSqlDatabase {
  exec: (sql: string) => SqlQueryResult[];
}

/**
 * Builds an in-memory pure JavaScript SQL relational database populated with all active project entities:
 * - equipments (306+ medical equipments & specs)
 * - quotations & quote_items (saved quotes & line items)
 * - tender_clients & tender_items (licitaciones & items)
 * - purchase_orders (seguimiento OC & proveedores)
 * - sales_orders & sales_invoices (despacho y facturación)
 * 
 * Uses alasql (100% pure JS SQL engine, zero external wasm/network dependencies).
 */
export async function createSyDRelationalDatabase(data: {
  equipments: MedicalEquipment[];
  savedQuotes: SavedQuote[];
  tenderClients: TenderClientProject[];
  ocContracts: OCTrackingContract[];
  salesOrders: SalesOrderRecord[];
  salesInvoices: SalesInvoiceRecord[];
}): Promise<SyDSqlDatabase> {
  // Clear any existing tables in default db
  try {
    alasql('DROP TABLE IF EXISTS equipments');
    alasql('DROP TABLE IF EXISTS quotations');
    alasql('DROP TABLE IF EXISTS quote_items');
    alasql('DROP TABLE IF EXISTS tender_clients');
    alasql('DROP TABLE IF EXISTS tender_items');
    alasql('DROP TABLE IF EXISTS purchase_orders');
    alasql('DROP TABLE IF EXISTS sales_orders');
  } catch (e) {
    // Ignore drop errors
  }

  // 1. Create Tables
  alasql(`
    CREATE TABLE equipments (
      id STRING,
      code STRING,
      name STRING,
      brand STRING,
      model STRING,
      category STRING,
      product_group STRING,
      supplier STRING,
      base_cost_cop NUMBER,
      base_cost_usd NUMBER,
      tax_rate NUMBER,
      default_margin_list STRING,
      invima_record STRING,
      invima_status STRING,
      warranty_months NUMBER,
      origin_country STRING,
      has_manual NUMBER,
      has_quality_cert NUMBER,
      has_invima_doc NUMBER
    );

    CREATE TABLE quotations (
      id STRING,
      quote_number STRING,
      client_name STRING,
      nit STRING,
      contact_person STRING,
      contact_email STRING,
      contact_phone STRING,
      city STRING,
      quote_date STRING,
      status STRING,
      margin_list STRING,
      subtotal_cop NUMBER,
      tax_total_cop NUMBER,
      total_cop NUMBER,
      items_count NUMBER,
      created_at STRING
    );

    CREATE TABLE quote_items (
      id STRING,
      quote_id STRING,
      code STRING,
      name STRING,
      brand STRING,
      model STRING,
      quantity NUMBER,
      unit_cost_cop NUMBER,
      margin_type STRING,
      unit_sale_price_cop NUMBER,
      total_sale_price_cop NUMBER,
      discount_percentage NUMBER,
      profit_cop NUMBER,
      margin_percentage NUMBER
    );

    CREATE TABLE tender_clients (
      id STRING,
      client_name STRING,
      nit STRING,
      process_number STRING,
      process_type STRING,
      city STRING,
      budget_cop NUMBER,
      status STRING,
      items_count NUMBER
    );

    CREATE TABLE tender_items (
      id STRING,
      client_id STRING,
      item_number NUMBER,
      code STRING,
      name STRING,
      brand STRING,
      model STRING,
      quantity NUMBER,
      estimated_unit_budget_cop NUMBER,
      offered_unit_price_cop NUMBER,
      total_offered_cop NUMBER,
      warranty_months NUMBER,
      selected NUMBER
    );

    CREATE TABLE purchase_orders (
      id STRING,
      oc_number STRING,
      supplier STRING,
      supplier_nit STRING,
      payment_terms STRING,
      payment_status STRING,
      logistics_status STRING,
      estimated_delivery STRING,
      items_count NUMBER,
      total_amount_cop NUMBER
    );

    CREATE TABLE sales_orders (
      id STRING,
      sales_order_number STRING,
      quote_number STRING,
      client_name STRING,
      client_nit STRING,
      client_city STRING,
      order_date STRING,
      status STRING,
      total_amount_cop NUMBER,
      items_count NUMBER
    );
  `);

  // 2. Insert Equipments
  const eqRows = (data.equipments || []).map((eq) => ({
    id: eq.id,
    code: eq.code || '',
    name: eq.name || '',
    brand: eq.brand || '',
    model: eq.model || '',
    category: eq.category || '',
    product_group: eq.productGroup || '',
    supplier: eq.supplier || '',
    base_cost_cop: eq.baseCostCOP || 0,
    base_cost_usd: eq.baseCostUSD || 0,
    tax_rate: eq.taxRate || 19,
    default_margin_list: eq.defaultMarginList || 'L4',
    invima_record: eq.invimaRecordNumber || '',
    invima_status: eq.invimaStatus || 'Vigente',
    warranty_months: eq.warrantyMonths || 12,
    origin_country: eq.originCountry || '',
    has_manual: eq.hasManual ? 1 : 0,
    has_quality_cert: eq.hasQualityCert ? 1 : 0,
    has_invima_doc: eq.hasInvimaDoc ? 1 : 0
  }));
  alasql.tables.equipments.data = eqRows;

  // 3. Insert Quotations & Quote Items
  const qRows: any[] = [];
  const qiRows: any[] = [];

  (data.savedQuotes || []).forEach((q) => {
    const subtotal = q.subtotal || q.items?.reduce((sum, item) => sum + (item.unitSalePrice * item.quantity), 0) || 0;
    const tax = q.iva || (subtotal * (q.taxRate || 0.19));
    const total = q.total || (subtotal + tax);

    qRows.push({
      id: q.id,
      quote_number: q.quoteNumber || '',
      client_name: q.clientName || 'Sin Cliente',
      nit: q.nit || '',
      contact_person: q.contactPerson || '',
      contact_email: q.contactEmail || '',
      contact_phone: q.contactPhone || '',
      city: q.city || '',
      quote_date: q.date || '',
      status: q.status || 'Borrador',
      margin_list: q.items?.[0]?.marginType || 'L4',
      subtotal_cop: subtotal,
      tax_total_cop: tax,
      total_cop: total,
      items_count: q.items?.length || 0,
      created_at: q.savedAt || q.date || ''
    });

    q.items?.forEach((item) => {
      const lineCost = (item.unitCostCOP || 0) * (item.quantity || 1);
      const lineSale = (item.unitSalePrice || 0) * (item.quantity || 1);
      const profit = lineSale - lineCost;
      const marginPct = lineSale > 0 ? (profit / lineSale) * 100 : 0;

      qiRows.push({
        id: item.id || Math.random().toString(),
        quote_id: q.id,
        code: item.code || '',
        name: item.name || '',
        brand: item.brand || '',
        model: item.model || '',
        quantity: item.quantity || 1,
        unit_cost_cop: item.unitCostCOP || 0,
        margin_type: item.marginType || 'L4',
        unit_sale_price_cop: item.unitSalePrice || 0,
        total_sale_price_cop: lineSale,
        discount_percentage: item.discountPercentage || 0,
        profit_cop: profit,
        margin_percentage: marginPct
      });
    });
  });
  alasql.tables.quotations.data = qRows;
  alasql.tables.quote_items.data = qiRows;

  // 4. Insert Tender Clients & Items
  const tcRows: any[] = [];
  const tiRows: any[] = [];

  (data.tenderClients || []).forEach((tc) => {
    tcRows.push({
      id: tc.id,
      client_name: tc.clientName || '',
      nit: tc.nit || '',
      process_number: tc.header?.processNumber || '',
      process_type: tc.header?.processType || '',
      city: tc.header?.city || '',
      budget_cop: tc.header?.budgetCOP || 0,
      status: tc.status || 'En Preparación',
      items_count: tc.items?.length || 0
    });

    tc.items?.forEach((ti) => {
      const totalOffered = (ti.offeredUnitPrice || 0) * (ti.quantity || 1);
      tiRows.push({
        id: ti.id,
        client_id: tc.id,
        item_number: ti.itemNumber || 1,
        code: ti.code || '',
        name: ti.name || '',
        brand: ti.brand || '',
        model: ti.model || '',
        quantity: ti.quantity || 1,
        estimated_unit_budget_cop: ti.unitEstimatedBudget || 0,
        offered_unit_price_cop: ti.offeredUnitPrice || 0,
        total_offered_cop: totalOffered,
        warranty_months: ti.warrantyMonths || 12,
        selected: ti.selected ? 1 : 0
      });
    });
  });
  alasql.tables.tender_clients.data = tcRows;
  alasql.tables.tender_items.data = tiRows;

  // 5. Insert Purchase Orders (OC)
  const poRows: any[] = [];
  (data.ocContracts || []).forEach((c) => {
    c.purchaseOrders?.forEach((so) => {
      const totalAmount = so.items?.reduce((sum, it) => sum + (it.totalCostCOP || ((it.costPriceCOP || 0) * (it.quantity || 1))), 0) || 0;
      poRows.push({
        id: so.id,
        oc_number: so.ocNumber || '',
        supplier: so.supplier || '',
        supplier_nit: so.supplierNit || '',
        payment_terms: so.paymentTerms || '',
        payment_status: so.paymentStatus || '',
        logistics_status: so.status || '',
        estimated_delivery: so.estimatedDeliveryDate || '',
        items_count: so.items?.length || 0,
        total_amount_cop: totalAmount
      });
    });
  });
  alasql.tables.purchase_orders.data = poRows;

  // 6. Insert Sales Orders
  const soRows: any[] = [];
  (data.salesOrders || []).forEach((so) => {
    const totalAmount = so.items?.reduce((sum, it) => sum + (it.totalSalePriceCOP || ((it.unitSalePriceCOP || 0) * (it.quantityToDispatch || 1))), 0) || 0;
    soRows.push({
      id: so.id,
      sales_order_number: so.salesOrderNumber || '',
      quote_number: so.quoteNumber || '',
      client_name: so.clientName || '',
      client_nit: so.clientNit || '',
      client_city: so.clientCity || '',
      order_date: so.orderDate || '',
      status: so.status || 'Borrador',
      total_amount_cop: totalAmount,
      items_count: so.items?.length || 0
    });
  });
  alasql.tables.sales_orders.data = soRows;

  // Return standard executor wrapper
  return {
    exec: (sqlString: string): SqlQueryResult[] => {
      // Remove trailing semicolons
      const cleanSql = sqlString.trim().replace(/;+$/, '');
      const rawResult = alasql(cleanSql);

      if (!rawResult || !Array.isArray(rawResult)) {
        return [{
          columns: ['Resultado'],
          values: [[String(rawResult ?? 'OK')]]
        }];
      }

      if (rawResult.length === 0) {
        return [{
          columns: ['Mensaje'],
          values: [['Consulta ejecutada con éxito (0 filas retornadas)']]
        }];
      }

      // Handle array of objects
      if (typeof rawResult[0] === 'object' && rawResult[0] !== null) {
        const columns = Object.keys(rawResult[0]);
        const values = rawResult.map((row) => columns.map((col) => row[col]));
        return [{ columns, values }];
      }

      // Handle primitive arrays
      return [{
        columns: ['Valor'],
        values: rawResult.map((v) => [v])
      }];
    }
  };
}
