import {
  MedicalEquipment,
  OCTrackingContract,
  TenderClientProject,
  SavedQuote,
  SalesOrderRecord,
  SystemAlertItem,
  AlertSeverity,
} from '../types';
import { CURRENT_APP_VERSION, hasUnseenAppUpdates, APP_RELEASES_HISTORY } from './versionCheck';

/**
 * Calculates and aggregates all real-time system alerts across Catalog, Tenders, OC Tracking, Quotes, Sales Orders and System Updates.
 * Strictly prioritized by operational and financial impact.
 */
export function computeSystemAlerts(params: {
  equipments: MedicalEquipment[];
  ocContracts: OCTrackingContract[];
  tenderClients?: TenderClientProject[];
  savedQuotes?: SavedQuote[];
  salesOrders?: SalesOrderRecord[];
}): {
  alerts: SystemAlertItem[];
  summary: {
    total: number;
    critica: number;
    media: number;
    informativa: number;
  };
} {
  const {
    equipments = [],
    ocContracts = [],
    tenderClients = [],
    savedQuotes = [],
    salesOrders = [],
  } = params;
  const alerts: SystemAlertItem[] = [];
  const now = Date.now();

  // =========================================================================
  // 0. SYSTEM UPDATE NOTIFICATION (✨ Novedades y Actualizaciones del Software)
  // =========================================================================
  const latestRelease = APP_RELEASES_HISTORY[0];
  if (hasUnseenAppUpdates() && latestRelease) {
    alerts.push({
      id: `alert-app-update-${latestRelease.version}`,
      title: `✨ Nueva Versión v${latestRelease.version} Disponible`,
      message: `${latestRelease.title}: ${latestRelease.summary}`,
      severity: 'media',
      category: 'actualizacion_sistema',
      sourceModule: 'Actualizaciones (Sistema)',
      targetTab: 'inicio',
      entityId: `release-${latestRelease.version}`,
      entityName: `SYD Colombia v${latestRelease.version}`,
      actionLabel: 'Ver Novedades & Actualizar',
      createdAt: latestRelease.releaseDate,
      details: { version: latestRelease.version, release: latestRelease },
    });
  }

  // =========================================================================
  // 1. CRITICAL ALERTS (🔴 Impacto Operativo Alto / Incumplimiento)
  // =========================================================================

  // A. Overdue OC Items & >48h Inactivity on Active Orders
  ocContracts.forEach((contract) => {
    (contract.items || []).forEach((item) => {
      // Check Payment Overdue
      if (item.paymentStatus === 'Vencido' || contract.paymentStatus === 'Vencido') {
        alerts.push({
          id: `alert-oc-payment-overdue-${item.id}`,
          title: `Pago a Proveedor Vencido: ${item.supplier || contract.supplier || 'Proveedor'}`,
          message: `La orden ${item.ocNumber || contract.ocNumber || 'S/N'} (${item.name}) presenta pago vencido en Tesorería. Riesgo de bloqueo de despachos.`,
          severity: 'critica',
          category: 'oc_pago',
          sourceModule: 'Seguimiento OC (Ventana 5)',
          targetTab: 'seguimiento_oc',
          entityId: contract.id,
          entityName: item.name,
          actionLabel: 'Ver Orden de Compra',
          createdAt: item.lastUpdatedAt || contract.lastUpdatedAt,
          details: { contractId: contract.id, itemId: item.id },
        });
      }

      // Check Inactivity > 48 hours for pending/in-progress orders
      const lastUpdate = new Date(item.lastUpdatedAt || item.createdAt || contract.lastUpdatedAt || now).getTime();
      const diffHours = (now - lastUpdate) / (1000 * 60 * 60);

      const isActiveStatus =
        item.status !== 'Entregado e Instalado' &&
        item.status !== 'Cerrado / Concluido' &&
        item.status !== 'Cancelada' &&
        item.status !== 'Borrador / Solicitud';

      if (isActiveStatus && diffHours > 48) {
        const days = Math.floor(diffHours / 24);
        alerts.push({
          id: `alert-oc-inactive-${item.id}`,
          title: `Seguimiento OC sin Novedad (${days}d): ${item.name}`,
          message: `La OC ${item.ocNumber || contract.ocNumber || 'S/N'} con ${item.supplier || contract.supplier} lleva ${days} días sin registrar avances ni novedades de despacho.`,
          severity: 'critica',
          category: 'oc_retraso',
          sourceModule: 'Seguimiento OC (Ventana 5)',
          targetTab: 'seguimiento_oc',
          entityId: contract.id,
          entityName: item.name,
          actionLabel: 'Actualizar Seguimiento OC',
          createdAt: item.lastUpdatedAt,
          details: { contractId: contract.id, itemId: item.id, daysInactive: days },
        });
      }
    });
  });

  // B. Awarded Tenders without OC Tracking
  tenderClients.forEach((client) => {
    if (client.status === 'Adjudicada') {
      const hasOC = ocContracts.some(
        (c) =>
          c.tenderClientId === client.id ||
          c.contractNumber === client.header.processNumber ||
          c.contractNumber === client.clientName ||
          c.salesOrderNumber === client.header.processNumber ||
          c.id === `tender-contract-${client.id}`
      );
      if (!hasOC && (client.items || []).length > 0) {
        alerts.push({
          id: `alert-tender-without-oc-${client.id}`,
          title: `Licitación Adjudicada sin OC Emitida: ${client.clientName}`,
          message: `El proceso "${client.header.processNumber || client.clientName}" (${client.items?.length || 0} equipos) está adjudicado pero aún no tiene órdenes de compra asignadas en Seguimiento.`,
          severity: 'critica',
          category: 'licitacion_sin_oc',
          sourceModule: 'Licitaciones (Ventana 4)',
          targetTab: 'licitaciones',
          entityId: client.id,
          entityName: client.clientName,
          actionLabel: 'Abrir Licitación',
          createdAt: client.updatedAt,
          details: { clientId: client.id },
        });
      }
    }
  });

  // C. Sales Orders (OV) & OC Linking Status (Informative Notifications)
  salesOrders.forEach((order) => {
    // Only check active OVs that are not cancelled
    if (order.status !== 'Cancelada') {
      const hasMatchingContract = ocContracts.some(
        (c) =>
          c.salesOrderNumber === order.salesOrderNumber ||
          c.contractNumber === order.salesOrderNumber ||
          c.id === `ov-contract-${order.id}` ||
          (order.id && c.id?.includes(order.id)) ||
          (order.ocContractId && c.id === order.ocContractId)
      );

      const hasLinkedOC = hasMatchingContract || Boolean(order.hasLinkedOC);

      if (hasLinkedOC) {
        // Informative notification confirming OC creation & linkage
        alerts.push({
          id: `info-ov-with-oc-${order.id}`,
          title: `✓ OC vinculada a OV ${order.salesOrderNumber}: ${order.clientName}`,
          message: `Se ha generado y vinculado la Orden de Compra (OC) correspondiente a la OV ${order.salesOrderNumber} (${order.items?.length || 0} equipos) en Seguimiento de OC.`,
          severity: 'informativa',
          category: 'ov_sin_oc',
          sourceModule: 'Órdenes de Venta (OV)',
          targetTab: 'seguimiento_oc',
          entityId: order.id,
          entityName: order.salesOrderNumber,
          actionLabel: 'Ver en Seguimiento OC',
          createdAt: order.createdAt || order.orderDate,
          details: {
            salesOrderId: order.id,
            salesOrderNumber: order.salesOrderNumber,
            clientName: order.clientName,
            hasLinkedOC: true,
          },
        });
      } else if (order.status !== 'Facturada' && (order.items || []).length > 0) {
        // Informational reminder
        alerts.push({
          id: `info-ov-pending-oc-${order.id}`,
          title: `ℹ️ OV ${order.salesOrderNumber} lista para OC: ${order.clientName}`,
          message: `La Orden de Venta ${order.salesOrderNumber} (${order.items?.length || 0} equipos) está disponible para emitir OC a proveedores cuando lo requieras.`,
          severity: 'informativa',
          category: 'ov_sin_oc',
          sourceModule: 'Órdenes de Venta (OV)',
          targetTab: 'ordenes_venta',
          entityId: order.id,
          entityName: order.salesOrderNumber,
          actionLabel: 'Ver Orden de Venta',
          createdAt: order.createdAt || order.orderDate,
          details: {
            salesOrderId: order.id,
            salesOrderNumber: order.salesOrderNumber,
            clientName: order.clientName,
          },
        });
      }
    }
  });

  // =========================================================================
  // 2. MEDIUM ALERTS (🟡 Advertencias Comerciales, Técnicas y Costos)
  // =========================================================================

  // A. Equipments in Catalog without Base Cost ($0 COP)
  const equipmentsWithoutCost = equipments.filter((eq) => !eq.baseCostCOP || eq.baseCostCOP === 0);
  if (equipmentsWithoutCost.length > 0) {
    if (equipmentsWithoutCost.length <= 2) {
      equipmentsWithoutCost.forEach((eq) => {
        alerts.push({
          id: `alert-cat-cost-${eq.id}`,
          title: `Falta Costo Base: ${eq.name}`,
          message: `El equipo (${eq.brand} - ${eq.model}) tiene costo de $0 COP en el catálogo. Se requiere definir el costo para cotizar con margen correcto.`,
          severity: 'media',
          category: 'costo_catalogo',
          sourceModule: 'Catálogo (Ventana 3)',
          targetTab: 'catalogo',
          entityId: eq.id,
          entityName: eq.name,
          actionLabel: 'Definir Costo en Catálogo',
          createdAt: new Date().toISOString(),
          details: { equipmentId: eq.id },
        });
      });
    } else {
      alerts.push({
        id: `alert-cat-cost-bulk`,
        title: `${equipmentsWithoutCost.length} Equipos en Catálogo sin Costo Base`,
        message: `Hay ${equipmentsWithoutCost.length} equipos con costo base $0 COP (incluyendo ${equipmentsWithoutCost[0].name}). Requieren asignación de costo de adquisición.`,
        severity: 'media',
        category: 'costo_catalogo',
        sourceModule: 'Catálogo (Ventana 3)',
        targetTab: 'catalogo',
        entityId: equipmentsWithoutCost[0].id,
        entityName: 'Equipos Catálogo',
        actionLabel: 'Revisar Catálogo',
        createdAt: new Date().toISOString(),
        details: { count: equipmentsWithoutCost.length },
      });
    }
  }

  // B. INVIMA Registrations Expired or in Renewal
  equipments.forEach((eq) => {
    if (eq.invimaStatus === 'Vencido' || eq.invimaRecordNumber?.toLowerCase().includes('vencid')) {
      alerts.push({
        id: `alert-invima-expired-${eq.id}`,
        title: `Registro INVIMA Vencido: ${eq.name}`,
        message: `El registro INVIMA (${eq.invimaRecordNumber}) del equipo ${eq.brand} figura vencido o inactivo. Puede inhabilitar ofertas públicas.`,
        severity: 'media',
        category: 'invima_pendiente',
        sourceModule: 'Catálogo (Ventana 3)',
        targetTab: 'catalogo',
        entityId: eq.id,
        entityName: eq.name,
        actionLabel: 'Ver Ficha en Catálogo',
        createdAt: new Date().toISOString(),
        details: { equipmentId: eq.id },
      });
    }
  });

  // =========================================================================
  // 2. MEDIUM ALERTS / NOTIFICACIONES DE GOOGLE DRIVE (🟡 Novedades de Partes)
  // =========================================================================
  try {
    const rawDetected = localStorage.getItem('syd_detected_sheet_parts_v1');
    if (rawDetected) {
      const detectedParts = JSON.parse(rawDetected);
      if (Array.isArray(detectedParts)) {
        // Find parts from Google Drive that are not yet in the local equipments catalog
        const newUncatalogedParts = detectedParts.filter((p: any) => {
          if (!p || (!p.code && !p.name)) return false;
          const cleanCode = (p.code || '').trim().toLowerCase();
          const cleanName = (p.name || '').trim().toLowerCase();
          const inCatalog = equipments.some((eq) => {
            const eqCode = (eq.code || '').trim().toLowerCase();
            const eqName = (eq.name || '').trim().toLowerCase();
            return (cleanCode && eqCode === cleanCode) || (cleanName && eqName === cleanName);
          });
          return !inCatalog && p.status !== 'Inactiva';
        });

        if (newUncatalogedParts.length > 0) {
          const latestPart = newUncatalogedParts[0];
          alerts.push({
            id: `alert-drive-new-parts-${latestPart.code || latestPart.id || 'batch'}`,
            title:
              newUncatalogedParts.length === 1
                ? `🔔 Nueva Parte Detectada en Drive: ${latestPart.name}`
                : `🔔 ${newUncatalogedParts.length} Nuevas Partes Creadas en Google Drive`,
            message:
              newUncatalogedParts.length === 1
                ? `Se detectó la nueva parte "${latestPart.name}" (Ref: ${latestPart.code || 'En revisión'}, Proveedor: ${latestPart.supplier || 'N/D'}) agregada en la hoja de Drive. Disponible para consultar e incorporar al catálogo.`
                : `Se detectaron ${newUncatalogedParts.length} partes nuevas agregadas en la hoja de Google Drive (ej: ${latestPart.name}). Disponibles para consulta y catálogo.`,
            severity: 'media',
            category: 'nueva_parte_drive',
            sourceModule: 'Google Drive / Sheets',
            targetTab: 'catalogo',
            entityId: latestPart.code || latestPart.id,
            entityName: latestPart.name,
            actionLabel: 'Consultar en Google Drive',
            createdAt: new Date().toISOString(),
            details: { partsCount: newUncatalogedParts.length, parts: newUncatalogedParts.slice(0, 5) },
          });
        }
      }
    }
  } catch (_) {}

  // =========================================================================
  // 3. INFORMATIVE ALERTS (🔵 Tareas Pendientes y Sugerencias)
  // =========================================================================

  // A. Approved Quotes without OC
  savedQuotes.forEach((quote) => {
    if (quote.status === 'Aprobada') {
      const hasOC = ocContracts.some((c) => c.quoteId === quote.id || c.contractNumber === quote.quoteNumber);
      if (!hasOC) {
        alerts.push({
          id: `alert-quote-approved-${quote.id}`,
          title: `Cotización Aprobada por Enviar a OC: ${quote.quoteNumber}`,
          message: `La cotización para ${quote.clientName} por ${quote.items.length} equipos fue aprobada. Está lista para generar órdenes de compra.`,
          severity: 'informativa',
          category: 'cotizacion_pendiente',
          sourceModule: 'Cotizaciones (Ventana 2)',
          targetTab: 'ventas',
          entityId: quote.id,
          entityName: quote.quoteNumber,
          actionLabel: 'Ver Cotización',
          createdAt: quote.date,
          details: { quoteId: quote.id },
        });
      }
    }
  });

  // Sort alerts: CRITICAL first, then MEDIUM, then INFORMATIVE
  const severityWeight: Record<AlertSeverity, number> = {
    critica: 3,
    media: 2,
    informativa: 1,
  };

  const sortedAlerts = alerts.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);

  const summary = {
    total: sortedAlerts.length,
    critica: sortedAlerts.filter((a) => a.severity === 'critica').length,
    media: sortedAlerts.filter((a) => a.severity === 'media').length,
    informativa: sortedAlerts.filter((a) => a.severity === 'informativa').length,
  };

  return {
    alerts: sortedAlerts,
    summary,
  };
}
