import backupSnapshot from '../../data_backup_snapshot.json';

export function hydrateFromSnapshotIfEmpty() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const rawQuotes = localStorage.getItem('syd_saved_quotes_database_v2');
    const hasQuotes = rawQuotes && JSON.parse(rawQuotes).length > 0;

    const rawTenders = localStorage.getItem('syd_tender_clients_v2');
    const hasTenders = rawTenders && JSON.parse(rawTenders).length > 0;

    const rawContracts = localStorage.getItem('syd_oc_tracking_contracts_v3');
    const hasContracts = rawContracts && JSON.parse(rawContracts).length > 0;

    const rawOrders = localStorage.getItem('syd_sales_orders_v1');
    const hasOrders = rawOrders && JSON.parse(rawOrders).length > 0;

    const rawEquipments = localStorage.getItem('syd_equipments_catalog');
    const hasEquipments = rawEquipments && JSON.parse(rawEquipments).length > 0;

    const data = (backupSnapshot as any)?.data;
    if (!data) return;

    if (!hasQuotes && Array.isArray(data.quotes) && data.quotes.length > 0) {
      console.log(`[Hydrate] Restoring ${data.quotes.length} quotes from snapshot.`);
      localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(data.quotes));
    }

    if (!hasTenders && Array.isArray(data.tenderProjects) && data.tenderProjects.length > 0) {
      console.log(`[Hydrate] Restoring ${data.tenderProjects.length} tenders from snapshot.`);
      localStorage.setItem('syd_tender_clients_v2', JSON.stringify(data.tenderProjects));
    }

    if (!hasContracts && Array.isArray(data.ocContracts) && data.ocContracts.length > 0) {
      console.log(`[Hydrate] Restoring ${data.ocContracts.length} ocContracts from snapshot.`);
      localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(data.ocContracts));
    }

    if (!hasOrders && Array.isArray(data.salesOrders) && data.salesOrders.length > 0) {
      console.log(`[Hydrate] Restoring ${data.salesOrders.length} salesOrders from snapshot.`);
      localStorage.setItem('syd_sales_orders_v1', JSON.stringify(data.salesOrders));
    }

    if (Array.isArray(data.salesInvoices) && data.salesInvoices.length > 0) {
      const rawInvoices = localStorage.getItem('syd_sales_invoices_v1');
      if (!rawInvoices || JSON.parse(rawInvoices).length === 0) {
        localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(data.salesInvoices));
      }
    }

    if (!hasEquipments && Array.isArray(data.equipments) && data.equipments.length > 0) {
      console.log(`[Hydrate] Restoring ${data.equipments.length} equipments from snapshot.`);
      localStorage.setItem('syd_equipments_catalog', JSON.stringify(data.equipments));
    }

    if (Array.isArray(data.systemUsers) && data.systemUsers.length > 0) {
      const rawUsers = localStorage.getItem('syd_registered_system_users_v4');
      if (!rawUsers || JSON.parse(rawUsers).length === 0) {
        localStorage.setItem('syd_registered_system_users_v4', JSON.stringify(data.systemUsers));
      }
    }
  } catch (err) {
    console.error('[Hydrate] Error hydrating from backup snapshot:', err);
  }
}
