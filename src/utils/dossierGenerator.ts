import {
  MedicalEquipment,
  OCTrackingContract,
  OCTrackingItem,
  ItemSerialNumberRecord,
  TechnicalDocument,
} from '../types';

export interface HospitalDossierData {
  contract: OCTrackingContract;
  item: OCTrackingItem;
  serialRecord: ItemSerialNumberRecord;
  equipmentMaster?: MedicalEquipment;
  generalDocs: TechnicalDocument[];
}

/**
 * Normalizes strings for robust matching between catalog, quotes, and documentation
 */
export function normalizeText(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Finds all general documents from Ventana 6 that correspond to an equipment item
 */
export function findMatchingGeneralDocuments(
  item: OCTrackingItem,
  allDocuments: TechnicalDocument[],
  equipments: MedicalEquipment[]
): TechnicalDocument[] {
  const itemCodeNorm = normalizeText(item.code);
  const itemNameNorm = normalizeText(item.name);
  const itemModelNorm = normalizeText(item.model);
  const itemBrandNorm = normalizeText(item.brand);

  // Check if item has a direct equipmentId match
  const masterEq = equipments.find(
    (e) =>
      (item.equipmentId && e.id === item.equipmentId) ||
      (e.code && item.code && normalizeText(e.code) === itemCodeNorm) ||
      (e.model && item.model && normalizeText(e.model) === itemModelNorm)
  );

  return allDocuments.filter((doc) => {
    // 1. Direct ID link
    if (item.equipmentId && doc.equipmentId === item.equipmentId) return true;
    if (masterEq && doc.equipmentId === masterEq.id) return true;

    // 2. Code link
    if (doc.equipmentCode && item.code && normalizeText(doc.equipmentCode) === itemCodeNorm) {
      return true;
    }

    // 3. Name / Model substring match
    const docEqName = normalizeText(doc.equipmentName);
    if (itemNameNorm && (docEqName.includes(itemNameNorm) || itemNameNorm.includes(docEqName))) {
      return true;
    }
    if (itemModelNorm && docEqName.includes(itemModelNorm)) {
      return true;
    }

    return false;
  });
}

/**
 * Generates an official Hoja de Vida HTML according to MinSalud Resolution 3100 of 2019 / 4725 of 2005
 */
export function generateHojaDeVidaHtml(data: HospitalDossierData): string {
  const { contract, item, serialRecord, equipmentMaster } = data;
  const todayStr = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const invimaNumber =
    equipmentMaster?.invimaRecordNumber ||
    item.notes?.match(/INVIMA[:\s]+([A-Z0-9-]+)/i)?.[1] ||
    'REGISTRO SANITARIO VIGENTE SYD';

  const riskClass = equipmentMaster?.category ? `Categoría: ${equipmentMaster.category} (Riesgo Biomédico Controlado)` : 'Clase IIb (Riesgo Moderado-Alto)';
  const techType = 'Electromédica / Microprocesada';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Hoja de Vida Biomédica - S/N ${serialRecord.serialNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.4;
      margin: 0;
      padding: 24px;
      font-size: 12px;
      background: #ffffff;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 1.5cm; size: letter; }
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border: 1.5px solid #0f172a;
    }
    .header-table td {
      padding: 6px 10px;
      border: 1px solid #0f172a;
      vertical-align: middle;
    }
    .title-cell {
      text-align: center;
      font-weight: bold;
      font-size: 14px;
      background: #f8fafc;
    }
    .section-title {
      background: #0f172a;
      color: #ffffff;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 12px;
      margin-bottom: 4px;
      border-radius: 2px;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .grid-table td, .grid-table th {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      font-size: 11px;
    }
    .lbl {
      background: #f1f5f9;
      font-weight: bold;
      width: 22%;
      color: #334155;
    }
    .val {
      width: 28%;
      color: #0f172a;
    }
    .val-highlight {
      font-weight: bold;
      color: #0369a1;
    }
    .signatures-table {
      width: 100%;
      margin-top: 40px;
      border-collapse: collapse;
    }
    .signatures-table td {
      width: 50%;
      padding: 20px 30px 0 30px;
      text-align: center;
      vertical-align: top;
    }
    .sign-line {
      border-top: 1.5px solid #334155;
      padding-top: 6px;
      font-size: 11px;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .print-btn {
      background: #0284c7;
      color: white;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <div>
      <span class="badge">VISTA PREVIA DE HOJA DE VIDA OFICIAL MINSALUD</span>
      <span style="margin-left: 8px; color: #64748b;">Resolución 3100 de 2019 / 4725 de 2005</span>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar en PDF</button>
  </div>

  <table class="header-table">
    <tr>
      <td style="width: 25%; text-align: center;">
        <strong style="font-size: 15px; color: #0284c7;">SYD COLOMBIA</strong><br>
        <span style="font-size: 9px; color: #64748b;">NIT: 900.854.120-3</span><br>
        <span style="font-size: 8px; color: #94a3b8;">División Biomédica & Soporte Clínico</span>
      </td>
      <td class="title-cell" style="width: 50%;">
        HOJA DE VIDA DE EQUIPO BIOMÉDICO<br>
        <span style="font-size: 10px; font-weight: normal; color: #475569;">SISTEMA OBLIGATORIO DE GARANTÍA DE CALIDAD EN SALUD (SOGCS)</span>
      </td>
      <td style="width: 25%; font-size: 10px;">
        <strong>Código:</strong> F-BIO-01<br>
        <strong>Versión:</strong> 04<br>
        <strong>Emisión:</strong> ${todayStr}
      </td>
    </tr>
  </table>

  <!-- SECCIÓN 1: DATOS DE LA INSTITUCIÓN HOSPITALARIA -->
  <div class="section-title">1. Identificación de la Institución Prestadora (IPS / Cliente)</div>
  <table class="grid-table">
    <tr>
      <td class="lbl">Institución / IPS:</td>
      <td class="val val-highlight" colspan="3">${contract.clientName || 'Cliente Final'}</td>
    </tr>
    <tr>
      <td class="lbl">NIT / Cédula:</td>
      <td class="val">${contract.nit || 'N/A'}</td>
      <td class="lbl">Ciudad / Municipio:</td>
      <td class="val">${contract.city || 'Colombia'}</td>
    </tr>
    <tr>
      <td class="lbl">Servicio / Ubicación:</td>
      <td class="val">${serialRecord.hospitalLocation || 'Servicio Hospitalario / Asistencial'}</td>
      <td class="lbl">Placa Inventario IPS:</td>
      <td class="val font-mono"><strong>${serialRecord.inventoryPlate || 'Por Asignar en IPS'}</strong></td>
    </tr>
    <tr>
      <td class="lbl">N° Proceso / Contrato:</td>
      <td class="val">${contract.contractNumber || 'Venta Directa'}</td>
      <td class="lbl">Orden de Compra:</td>
      <td class="val">${item.ocNumber || contract.ocNumber || 'N/A'}</td>
    </tr>
  </table>

  <!-- SECCIÓN 2: IDENTIFICACIÓN TÉCNICA DEL EQUIPO -->
  <div class="section-title">2. Identificación del Equipo Médico</div>
  <table class="grid-table">
    <tr>
      <td class="lbl">Nombre del Equipo:</td>
      <td class="val val-highlight" colspan="3">${item.name}</td>
    </tr>
    <tr>
      <td class="lbl">Marca:</td>
      <td class="val"><strong>${item.brand}</strong></td>
      <td class="lbl">Modelo / Referencia:</td>
      <td class="val"><strong>${item.model}</strong></td>
    </tr>
    <tr>
      <td class="lbl">Número de Serie (S/N):</td>
      <td class="val val-highlight" style="font-size: 13px; font-family: monospace;">${serialRecord.serialNumber}</td>
      <td class="lbl">Código Catálogo SYD:</td>
      <td class="val font-mono">${item.code || 'N/A'}</td>
    </tr>
    <tr>
      <td class="lbl">Registro Sanitario INVIMA:</td>
      <td class="val"><strong>${invimaNumber}</strong></td>
      <td class="lbl">Clasificación del Riesgo:</td>
      <td class="val"><span class="badge">${riskClass}</span></td>
    </tr>
    <tr>
      <td class="lbl">Fabricante / Proveedor:</td>
      <td class="val">${item.supplier || 'Fabricante Autorizado'}</td>
      <td class="lbl">Tecnología Predominante:</td>
      <td class="val">${techType}</td>
    </tr>
  </table>

  <!-- SECCIÓN 3: NACIONALIZACIÓN Y ADUANA (DIAN) -->
  <div class="section-title">3. Procedencia Legal y Manifiesto de Aduana (DIAN)</div>
  <table class="grid-table">
    <tr>
      <td class="lbl">Declaración de Importación:</td>
      <td class="val font-mono"><strong>${serialRecord.dianDeclarationNumber || 'Trámite Nacional / DIAN'}</strong></td>
      <td class="lbl">Fecha Declaración DIAN:</td>
      <td class="val">${serialRecord.dianDate || todayStr}</td>
    </tr>
    <tr>
      <td class="lbl">Factura Comercial SYD:</td>
      <td class="val">${item.invoiceNumber || 'Factura Oficial de Venta'}</td>
      <td class="lbl">Forma de Adquisición:</td>
      <td class="val">Compraventa / Adjudicación Contractual</td>
    </tr>
  </table>

  <!-- SECCIÓN 4: PARÁMETROS DE OPERACIÓN Y MANTENIMIENTO -->
  <div class="section-title">4. Parámetros Operativos & Mantenimiento Preventivo</div>
  <table class="grid-table">
    <tr>
      <td class="lbl">Alimentación Eléctrica:</td>
      <td class="val">100 - 240 VAC ~ 50/60 Hz</td>
      <td class="lbl">Frecuencia Mantenimiento:</td>
      <td class="val"><strong>Semestral (2 veces/año)</strong></td>
    </tr>
    <tr>
      <td class="lbl">Protocolo de Seguridad:</td>
      <td class="val">Norma IEC 60601-1 / IEC 62353</td>
      <td class="lbl">Vigencia Garantía:</td>
      <td class="val"><strong>12 a 24 Meses según contrato</strong></td>
    </tr>
    <tr>
      <td class="lbl">Ingeniero Responsable:</td>
      <td class="val">${serialRecord.technicianName || 'Ing. Biomédico Especialista SYD'}</td>
      <td class="lbl">Fecha de Entrega/Instalación:</td>
      <td class="val">${serialRecord.deliveryDate || todayStr}</td>
    </tr>
  </table>

  <!-- SECCIÓN 5: OBSERVACIONES Y ACCESORIOS -->
  <div class="section-title">5. Accesorios & Observaciones Técnicas</div>
  <table class="grid-table">
    <tr>
      <td style="padding: 8px; color: #334155;">
        ${
          serialRecord.notes ||
          'Equipo entregado nuevo de fábrica, con accesorios estándar completos, manuales de usuario en español y pruebas de calibración inicial conforme a especificaciones técnicas del fabricante.'
        }
      </td>
    </tr>
  </table>

  <!-- SECCIÓN 6: FIRMAS DE ENTREGA Y ACEPTACIÓN -->
  <table class="signatures-table">
    <tr>
      <td>
        <div class="sign-line">
          <strong>ENTREGADO POR (SYD COLOMBIA)</strong><br>
          <span>Ing. Biomédico / Técnico de Soporte</span><br>
          <span style="font-size: 9px; color: #64748b;">Tarjeta Profesional N°: _____________________</span>
        </div>
      </td>
      <td>
        <div class="sign-line">
          <strong>RECIBIDO POR (INSTITUCIÓN HOSPITALARIA)</strong><br>
          <span>Jefe de Mantenimiento / Interventor / Líder Biomédico</span><br>
          <span style="font-size: 9px; color: #64748b;">C.C. N°: ___________________ Cargo: _________________</span>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generates an official Delivery & Installation Acceptance Act (Acta de Entrega Técnica e Instalación)
 */
export function generateActaEntregaHtml(data: HospitalDossierData): string {
  const { contract, item, serialRecord, equipmentMaster } = data;
  const todayStr = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const invimaNumber =
    equipmentMaster?.invimaRecordNumber ||
    item.notes?.match(/INVIMA[:\s]+([A-Z0-9-]+)/i)?.[1] ||
    'REGISTRO SANITARIO VIGENTE SYD';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acta de Entrega e Instalación - S/N ${serialRecord.serialNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.45;
      margin: 0;
      padding: 24px;
      font-size: 12px;
      background: #ffffff;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 1.5cm; size: letter; }
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      border: 1.5px solid #0f172a;
    }
    .header-table td {
      padding: 6px 10px;
      border: 1px solid #0f172a;
      vertical-align: middle;
    }
    .title-cell {
      text-align: center;
      font-weight: bold;
      font-size: 13px;
      background: #f8fafc;
    }
    .section-title {
      background: #0f172a;
      color: #ffffff;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 14px;
      margin-bottom: 4px;
      border-radius: 2px;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .grid-table td, .grid-table th {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      font-size: 11px;
    }
    .lbl {
      background: #f1f5f9;
      font-weight: bold;
      width: 25%;
      color: #334155;
    }
    .val {
      width: 25%;
      color: #0f172a;
    }
    .checklist-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .check-box {
      width: 14px;
      height: 14px;
      border: 1.5px solid #0284c7;
      background: #e0f2fe;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 11px;
      color: #0369a1;
    }
    .signatures-table {
      width: 100%;
      margin-top: 35px;
      border-collapse: collapse;
    }
    .signatures-table td {
      width: 50%;
      padding: 16px 24px 0 24px;
      text-align: center;
      vertical-align: top;
    }
    .sign-line {
      border-top: 1.5px solid #334155;
      padding-top: 6px;
      font-size: 11px;
    }
    .print-btn {
      background: #0284c7;
      color: white;
      border: none;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <div>
      <strong style="color: #0284c7;">ACTA DE ENTREGA TÉCNICA E INSTALACIÓN</strong>
      <span style="margin-left: 8px; color: #64748b;">SYD Colombia - Entrega Hospitalaria</span>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar en PDF</button>
  </div>

  <table class="header-table">
    <tr>
      <td style="width: 25%; text-align: center;">
        <strong style="font-size: 15px; color: #0284c7;">SYD COLOMBIA</strong><br>
        <span style="font-size: 9px; color: #64748b;">NIT: 900.854.120-3</span>
      </td>
      <td class="title-cell" style="width: 50%;">
        ACTA DE ENTREGA TÉCNICA, INSTALACIÓN Y RECIBIDO A SATISFACCIÓN<br>
        <span style="font-size: 10px; font-weight: normal; color: #475569;">DEPARTAMENTO DE INGENIERÍA BIOMÉDICA</span>
      </td>
      <td style="width: 25%; font-size: 10px;">
        <strong>Acta N°:</strong> ACT-${serialRecord.serialNumber.slice(-5)}<br>
        <strong>Fecha:</strong> ${todayStr}<br>
        <strong>Ciudad:</strong> ${contract.city || 'Bogotá D.C.'}
      </td>
    </tr>
  </table>

  <!-- SECCIÓN 1: DATOS DEL CONTRATO / CLIENTE -->
  <div class="section-title">1. Información del Cliente y Contrato</div>
  <table class="grid-table">
    <tr>
      <td class="lbl">Entidad / Cliente:</td>
      <td class="val" colspan="3"><strong>${contract.clientName}</strong></td>
    </tr>
    <tr>
      <td class="lbl">NIT / Identificación:</td>
      <td class="val">${contract.nit}</td>
      <td class="lbl">Ciudad / Sede:</td>
      <td class="val">${contract.city || 'Colombia'}</td>
    </tr>
    <tr>
      <td class="lbl">Contrato / Proceso:</td>
      <td class="val"><strong>${contract.contractNumber}</strong></td>
      <td class="lbl">Servicio Hospitalario:</td>
      <td class="val">${serialRecord.hospitalLocation || 'Área Asistencial'}</td>
    </tr>
  </table>

  <!-- SECCIÓN 2: DATOS DEL EQUIPO Y SERIAL -->
  <div class="section-title">2. Relación de Equipos y Seriales Entregados</div>
  <table class="grid-table">
    <tr>
      <td class="lbl">Descripción del Equipo:</td>
      <td class="val" colspan="3"><strong>${item.name}</strong></td>
    </tr>
    <tr>
      <td class="lbl">Marca / Fabricante:</td>
      <td class="val">${item.brand}</td>
      <td class="lbl">Modelo:</td>
      <td class="val"><strong>${item.model}</strong></td>
    </tr>
    <tr>
      <td class="lbl">Número de Serie (S/N):</td>
      <td class="val font-mono" style="font-weight: bold; color: #0284c7;">${serialRecord.serialNumber}</td>
      <td class="lbl">Placa Inventario IPS:</td>
      <td class="val font-mono">${serialRecord.inventoryPlate || 'Por fijar'}</td>
    </tr>
    <tr>
      <td class="lbl">Registro Sanitario INVIMA:</td>
      <td class="val">${invimaNumber}</td>
      <td class="lbl">Declaración Importación:</td>
      <td class="val font-mono">${serialRecord.dianDeclarationNumber || 'Trámite DIAN'}</td>
    </tr>
  </table>

  <!-- SECCIÓN 3: PROTOCOLO DE INSPECCIÓN Y VERIFICACIÓN -->
  <div class="section-title">3. Lista de Chequeo & Pruebas Técnicas Realizadas</div>
  <table class="grid-table">
    <tr>
      <td style="padding: 10px;">
        <div class="checklist-item">
          <span class="check-box">✓</span>
          <span><strong>Inspección Física:</strong> El equipo y sus accesorios se encuentran en perfecto estado estético, sin golpes ni averías de transporte.</span>
        </div>
        <div class="checklist-item">
          <span class="check-box">✓</span>
          <span><strong>Accesorios Completos:</strong> Se verificó la entrega de cables de poder, sensores, mangueras y accesorios estándar requeridos.</span>
        </div>
        <div class="checklist-item">
          <span class="check-box">✓</span>
          <span><strong>Pruebas Operativas & Encendido:</strong> Se realizaron pruebas de encendido, configuración inicial y verificación de software funcional.</span>
        </div>
        <div class="checklist-item">
          <span class="check-box">✓</span>
          <span><strong>Pruebas de Seguridad Eléctrica:</strong> Cumplimiento de normas de aislamiento y corriente de fuga según IEC 60601 / 62353.</span>
        </div>
        <div class="checklist-item">
          <span class="check-box">✓</span>
          <span><strong>Documentación Entregada:</strong> Manual de usuario en idioma español, copia de Registro INVIMA y Hoja de Vida Biomédica.</span>
        </div>
      </td>
    </tr>
  </table>

  <!-- SECCIÓN 4: CAPACITACIÓN AL PERSONAL ASISTENCIAL / BIOMÉDICO -->
  <div class="section-title">4. Constancia de Inducción & Capacitación</div>
  <table class="grid-table">
    <tr>
      <td style="padding: 8px;">
        Se certifica que en la fecha se brindó inducción y capacitación técnica/operativa sobre el manejo, precauciones de seguridad y limpieza del equipo médico al personal asistencial y técnico de la institución.
      </td>
    </tr>
  </table>

  <!-- SECCIÓN 5: FIRMAS -->
  <table class="signatures-table">
    <tr>
      <td>
        <div class="sign-line">
          <strong>ENTREGA (SYD COLOMBIA)</strong><br>
          <span>${serialRecord.technicianName || 'Ing. Biomédico Especialista'}</span><br>
          <span style="font-size: 9px; color: #64748b;">Firma y Sello de Soporte Técnico</span>
        </div>
      </td>
      <td>
        <div class="sign-line">
          <strong>RECIBE A CONFORMIDAD (HOSPITAL / CLÍNICA)</strong><br>
          <span>Interventor / Jefe Biomédico / Jefe de Servicio</span><br>
          <span style="font-size: 9px; color: #64748b;">Nombre, Firma, C.C. y Sello de la IPS</span>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generates an all-in-one Consolidated Hospital Delivery Dossier (Dossier Hospitalario Unificado)
 */
export function generateConsolidatedDossierHtml(data: HospitalDossierData): string {
  const { contract, item, serialRecord, generalDocs } = data;
  const hvHtml = generateHojaDeVidaHtml(data);
  const actaHtml = generateActaEntregaHtml(data);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Dossier Hospitalario Completo - S/N ${serialRecord.serialNumber}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .dossier-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .doc-preview-frame {
      width: 100%;
      height: 700px;
      border: 1px solid #475569;
      border-radius: 8px;
      background: white;
      margin-top: 12px;
    }
    .btn {
      background: #0284c7;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="dossier-card">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="margin: 0; color: #38bdf8;">Dossier Técnico Hospitalario - Serial: ${serialRecord.serialNumber}</h2>
          <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">
            ${item.name} (${item.brand} - ${item.model}) | Cliente: ${contract.clientName}
          </p>
        </div>
        <button class="btn" onclick="window.print()">🖨️ Imprimir Dossier Completo</button>
      </div>

      <!-- General Documents Linked from Ventana 6 -->
      <div style="margin-top: 16px; padding: 12px; background: #0f172a; border-radius: 8px; border: 1px solid #334155;">
        <h4 style="margin: 0 0 8px 0; color: #f8fafc;">Documentos Generales Vinculados (Ventana 6):</h4>
        ${
          generalDocs.length > 0
            ? generalDocs
                .map(
                  (d) => `
          <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 4px;">
            • <strong>${d.docType}:</strong> ${d.title} (${d.fileName || 'Archivo registrado'}) - <span style="color: #34d399;">${d.status}</span>
          </div>
        `
                )
                .join('')
            : '<div style="font-size: 12px; color: #94a3b8;">No se encontraron documentos generales vinculados en la Ventana 6 para este modelo.</div>'
        }
      </div>
    </div>

    <!-- DOCUMENT 1: HOJA DE VIDA -->
    <div class="dossier-card">
      <h3 style="margin: 0; color: #f8fafc;">1. Hoja de Vida Biomédica (MinSalud Res. 3100)</h3>
      <iframe class="doc-preview-frame" srcdoc="${hvHtml.replace(/"/g, '&quot;')}"></iframe>
    </div>

    <!-- DOCUMENT 2: ACTA DE ENTREGA -->
    <div class="dossier-card">
      <h3 style="margin: 0; color: #f8fafc;">2. Acta de Entrega Técnica e Instalación</h3>
      <iframe class="doc-preview-frame" srcdoc="${actaHtml.replace(/"/g, '&quot;')}"></iframe>
    </div>
  </div>
</body>
</html>
  `;
}
