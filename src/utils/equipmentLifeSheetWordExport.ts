import { EquipmentLifeSheetData } from '../types';
import { formatCOP } from './formatters';

/**
 * Exports an Equipment Life Sheet (Hoja de Vida de Equipo Biomédico)
 * directly into an editable Microsoft Word document (.doc)
 * compliant with Colombian MinSalud Resolución 3100 requirements.
 */
export function exportLifeSheetToWord(data: EquipmentLifeSheetData): void {
  const sanitize = (val?: string | number | null) => {
    if (val === undefined || val === null || val === '') return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const equipName = sanitize(data.equipmentName) || 'Equipo_Biomedico';
  const serial = sanitize(data.serialNumber) || 'SIN_SERIAL';
  const fileName = `Hoja_de_Vida_${equipName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${serial.replace(/[^a-zA-Z0-9_-]/g, '_')}.doc`;

  // Logo handling: if base64 or url provided, embed it directly
  const logoHtml = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="Logo Institucional" style="max-height: 60px; max-width: 140px; object-fit: contain;" />`
    : `<div style="font-size: 14pt; font-weight: bold; color: #0284c7; text-align: center; border: 1px solid #0284c7; padding: 6px;">SyD<br/><span style="font-size: 8pt; color: #334155;">COLOMBIA</span></div>`;

  const interventionsRows = (data.interventions && data.interventions.length > 0)
    ? data.interventions.map((itv) => `
      <tr>
        <td style="padding: 4px; border: 1px solid #64748b; font-family: 'Courier New', monospace; font-size: 8.5pt;">${sanitize(itv.date)}</td>
        <td style="padding: 4px; border: 1px solid #64748b; font-weight: bold; color: #0369a1; font-size: 8.5pt;">${sanitize(itv.type)}</td>
        <td style="padding: 4px; border: 1px solid #64748b; font-size: 8.5pt;">
          ${sanitize(itv.description)}
          ${itv.partsReplaced && itv.partsReplaced !== 'N/A' ? `<br/><span style="color: #64748b; font-size: 7.5pt;">Repuestos: ${sanitize(itv.partsReplaced)}</span>` : ''}
        </td>
        <td style="padding: 4px; border: 1px solid #64748b; font-size: 8pt; font-family: 'Courier New', monospace;">${sanitize(itv.reportNumber || 'N/A')}</td>
        <td style="padding: 4px; border: 1px solid #64748b; font-size: 8.5pt;">
          <strong>${sanitize(itv.engineerName)}</strong>
          ${itv.professionalLicense ? `<br/><span style="font-size: 7.5pt; color: #64748b;">${sanitize(itv.professionalLicense)}</span>` : ''}
        </td>
        <td style="padding: 4px; border: 1px solid #64748b; text-align: center; font-size: 8.5pt; font-weight: bold;">
          ${sanitize(itv.status)}
        </td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="6" style="padding: 10px; border: 1px solid #64748b; text-align: center; color: #94a3b8; font-style: italic;">
          Sin intervenciones registradas. El equipo se encuentra en estado inicial de entrega / recepción.
        </td>
      </tr>
    `;

  const wordContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Hoja de Vida de Equipo Biomédico - ${equipName}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 8.5in 11.0in; /* Letter size */
          margin: 0.5in 0.5in 0.5in 0.5in;
          mso-header-margin: 0.3in;
          mso-footer-margin: 0.3in;
          mso-paper-source: 0;
        }
        div.Section1 { page: Section1; }
        body {
          font-family: Arial, Calibri, Helvetica, sans-serif;
          font-size: 9.5pt;
          line-height: 1.25;
          color: #0f172a;
          background-color: #ffffff;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 6px;
        }
        th, td {
          border: 1px solid #475569;
          padding: 4px 6px;
          vertical-align: middle;
        }
        .header-title-bar {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: bold;
          font-size: 9pt;
          padding: 4px 8px;
          text-transform: uppercase;
          margin-top: 6px;
          margin-bottom: 2px;
        }
        .label-cell {
          background-color: #f1f5f9;
          font-weight: bold;
          color: #334155;
          width: 25%;
          font-size: 8.5pt;
        }
        .value-cell {
          color: #0f172a;
          font-size: 9pt;
        }
        .signature-line {
          border-top: 1px solid #0f172a;
          margin-top: 40px;
          padding-top: 4px;
          font-size: 9pt;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        <!-- 1. TABLA ENCABEZADO INSTITUCIONAL -->
        <table style="border: 2px solid #0f172a; margin-bottom: 8px;">
          <tr>
            <td style="width: 22%; text-align: center; vertical-align: middle; border-right: 2px solid #0f172a; background-color: #f8fafc; padding: 6px;">
              ${logoHtml}
            </td>
            <td style="text-align: center; vertical-align: middle; border-right: 2px solid #0f172a; padding: 6px;">
              <div style="font-size: 10pt; font-weight: bold; text-transform: uppercase; color: #475569;">
                ${sanitize(data.institutionName) || 'SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.'}
              </div>
              <div style="font-size: 8pt; color: #64748b; font-family: 'Courier New', monospace;">
                NIT: ${sanitize(data.institutionNit) || '901.458.239-1'} • ${sanitize(data.departmentCity) || 'Bogotá D.C., Colombia'}
              </div>
              <div style="font-size: 12pt; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 3px 0;">
                HOJA DE VIDA DE EQUIPO BIOMÉDICO
              </div>
              <div style="font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #0284c7;">
                PROGRAMA DE GESTIÓN TECNOLÓGICA Y MANTENIMIENTO HOSPITALARIO
              </div>
            </td>
            <td style="width: 23%; vertical-align: middle; font-size: 8pt; background-color: #f8fafc; padding: 4px;">
              <strong>CÓDIGO:</strong> <span style="font-family: 'Courier New', monospace; font-weight: bold;">${sanitize(data.formatCode) || 'F-GHB-01'}</span><br/>
              <strong>VERSIÓN:</strong> ${sanitize(data.formatVersion) || 'Versión 04'}<br/>
              <strong>EMISIÓN:</strong> ${sanitize(data.acquisitionDate) || new Date().toISOString().slice(0, 10)}
            </td>
          </tr>
        </table>

        <!-- 2. IDENTIFICACIÓN Y UBICACIÓN -->
        <div class="header-title-bar">
          1. Identificación del Equipo Biomédico &amp; Clasificación (Res. 3100 de 2019)
        </div>
        <table>
          <tr>
            <td class="label-cell">Nombre del Equipo:</td>
            <td class="value-cell" colspan="3" style="font-weight: bold; font-size: 10pt; color: #0284c7;">
              ${sanitize(data.equipmentName) || '&nbsp;'}
            </td>
          </tr>
          <tr>
            <td class="label-cell">Marca:</td>
            <td class="value-cell" style="width: 25%; font-weight: bold;">${sanitize(data.brand) || '&nbsp;'}</td>
            <td class="label-cell">Modelo:</td>
            <td class="value-cell" style="width: 25%; font-weight: bold;">${sanitize(data.model) || '&nbsp;'}</td>
          </tr>
          <tr>
            <td class="label-cell">Número de Serie (S/N):</td>
            <td class="value-cell" style="font-family: 'Courier New', monospace; font-weight: bold; color: #0369a1;">
              ${sanitize(data.serialNumber) || '&nbsp;'}
            </td>
            <td class="label-cell">Placa Activo Fijo / Inv:</td>
            <td class="value-cell" style="font-family: 'Courier New', monospace; font-weight: bold;">
              ${sanitize(data.inventoryPlate) || '&nbsp;'}
            </td>
          </tr>
          <tr>
            <td class="label-cell">Servicio / Ubicación:</td>
            <td class="value-cell">${sanitize(data.serviceLocation) || '&nbsp;'}</td>
            <td class="label-cell">Registro Sanitario INVIMA:</td>
            <td class="value-cell" style="font-family: 'Courier New', monospace;">${sanitize(data.invimaRecord) || '&nbsp;'}</td>
          </tr>
          <tr>
            <td class="label-cell">Clasificación de Riesgo:</td>
            <td class="value-cell" style="font-weight: bold; color: #047857;">${sanitize(data.riskClassification) || '&nbsp;'}</td>
            <td class="label-cell">Clasificación Biomédica:</td>
            <td class="value-cell">${sanitize(data.biomedicalClassification) || '&nbsp;'}</td>
          </tr>
          <tr>
            <td class="label-cell">Tecnología Predominante:</td>
            <td class="value-cell">${sanitize(data.technologyType) || '&nbsp;'}</td>
            <td class="label-cell">Vida Útil Estimada:</td>
            <td class="value-cell">${data.usefulLifeYears ? `${data.usefulLifeYears} Años` : '&nbsp;'}</td>
          </tr>
        </table>

        <!-- 3. ADQUISICIÓN Y GARANTÍA -->
        <div class="header-title-bar">
          2. Registro de Adquisición, Garantía &amp; Proveedor
        </div>
        <table>
          <tr>
            <td class="label-cell">Fabricante / Proveedor:</td>
            <td class="value-cell" colspan="3">
              ${sanitize(data.supplier) || '&nbsp;'} ${data.supplierPhone ? `• Tel: ${sanitize(data.supplierPhone)}` : ''}
            </td>
          </tr>
          <tr>
            <td class="label-cell">Fecha de Adquisición:</td>
            <td class="value-cell" style="font-family: 'Courier New', monospace;">${sanitize(data.acquisitionDate) || '&nbsp;'}</td>
            <td class="label-cell">Fecha de Instalación:</td>
            <td class="value-cell" style="font-family: 'Courier New', monospace;">${sanitize(data.installationDate) || '&nbsp;'}</td>
          </tr>
          <tr>
            <td class="label-cell">Estado de Garantía:</td>
            <td class="value-cell">
              <strong>${sanitize(data.warrantyStatus) || '&nbsp;'}</strong>
              ${data.warrantyExpiration ? ` (Vence: ${sanitize(data.warrantyExpiration)})` : ''}
            </td>
            <td class="label-cell">Factura / Orden de Compra:</td>
            <td class="value-cell" style="font-family: 'Courier New', monospace;">${sanitize(data.purchaseInvoiceOrOC) || '&nbsp;'}</td>
          </tr>
          ${data.commercialValueCOP ? `
          <tr>
            <td class="label-cell">Valor Comercial (COP):</td>
            <td class="value-cell" colspan="3" style="font-weight: bold; color: #047857; font-family: 'Courier New', monospace;">
              ${formatCOP(data.commercialValueCOP)}
            </td>
          </tr>
          ` : ''}
        </table>

        <!-- 4. ESPECIFICACIONES TÉCNICAS Y ELÉCTRICAS -->
        <div class="header-title-bar">
          3. Especificaciones Técnicas, Eléctricas &amp; Ambientales
        </div>
        <table>
          <tr>
            <td class="label-cell">Voltaje de Alimentación:</td>
            <td class="value-cell">${sanitize(data.voltageVolts) || '&nbsp;'}</td>
            <td class="label-cell">Consumo de Corriente:</td>
            <td class="value-cell">${sanitize(data.currentAmperes) || '&nbsp;'}</td>
          </tr>
          <tr>
            <td class="label-cell">Frecuencia Eléctrica:</td>
            <td class="value-cell">${sanitize(data.frequencyHz) || '&nbsp;'}</td>
            <td class="label-cell">Potencia Máxima:</td>
            <td class="value-cell">${sanitize(data.powerWatts) || '&nbsp;'}</td>
          </tr>
          <tr>
            <td class="label-cell">Batería de Respaldo:</td>
            <td class="value-cell" colspan="3">${sanitize(data.batteryType) || '&nbsp;'}</td>
          </tr>
          <tr>
            <td class="label-cell">Rango Temp / Humedad:</td>
            <td class="value-cell">${sanitize(data.operatingTemperature) || ''} ${data.humidityRange ? `• ${sanitize(data.humidityRange)}` : ''}</td>
            <td class="label-cell">Dimensiones y Peso:</td>
            <td class="value-cell">${sanitize(data.weightDimensions) || '&nbsp;'}</td>
          </tr>
        </table>

        <!-- 5. PROTOCOLO DE MANTENIMIENTO Y CALIBRACIÓN -->
        <div class="header-title-bar">
          4. Protocolo de Mantenimiento Preventivo &amp; Aseguramiento Metrológico
        </div>
        <table>
          <tr>
            <td class="label-cell">Frecuencia Preventivo:</td>
            <td class="value-cell" style="font-weight: bold; color: #0284c7;">${sanitize(data.maintenanceFrequency) || '&nbsp;'}</td>
            <td class="label-cell">Requiere Calibración:</td>
            <td class="value-cell">
              ${data.requiresCalibration ? `<strong style="color: #6b21a8;">SÍ (${sanitize(data.calibrationFrequency || 'Anual')})</strong>` : 'NO APLICA'}
            </td>
          </tr>
          <tr>
            <td class="label-cell">Variable / Magnitud a Calibrar:</td>
            <td class="value-cell" colspan="3">${sanitize(data.calibrationVariable) || 'N/A'}</td>
          </tr>
          <tr>
            <td class="label-cell">Manuales Disponibles:</td>
            <td class="value-cell" colspan="3">
              [${data.manualsAvailable?.userManual ? 'X' : ' '}] Manual de Usuario en Español &nbsp;&nbsp;&nbsp;
              [${data.manualsAvailable?.serviceManual ? 'X' : ' '}] Manual de Servicio Técnico &nbsp;&nbsp;&nbsp;
              [${data.manualsAvailable?.technicalSheet ? 'X' : ' '}] Ficha Técnica Oficial
            </td>
          </tr>
          <tr>
            <td class="label-cell">Accesorios &amp; Consumibles:</td>
            <td class="value-cell" colspan="3">${sanitize(data.accessoriesIncluded) || '&nbsp;'}</td>
          </tr>
        </table>

        <!-- 6. HISTORIAL DE INTERVENCIONES -->
        <div class="header-title-bar">
          5. Historial Cronológico de Mantenimientos &amp; Calificaciones Técnicas
        </div>
        <table>
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="width: 12%; font-size: 8.5pt;">Fecha</th>
              <th style="width: 14%; font-size: 8.5pt;">Tipo</th>
              <th style="font-size: 8.5pt;">Descripción del Trabajo / Repuestos</th>
              <th style="width: 14%; font-size: 8.5pt;">Reporte N°</th>
              <th style="width: 22%; font-size: 8.5pt;">Técnico / Ingeniero</th>
              <th style="width: 12%; font-size: 8.5pt;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${interventionsRows}
          </tbody>
        </table>

        <!-- 7. FIRMAS OFICIALES -->
        <table style="border: none; margin-top: 25px;">
          <tr>
            <td style="border: none; width: 48%; text-align: center; vertical-align: bottom;">
              <div class="signature-line">
                <strong>${sanitize(data.biomedicalEngineerName) || 'Ingeniero Biomédico Responsable'}</strong><br/>
                <span style="font-size: 8pt; color: #475569;">${sanitize(data.biomedicalEngineerTitle) || 'Especialista en Mantenimiento Biomédico'}</span><br/>
                <span style="font-size: 7.5pt; color: #64748b; font-family: 'Courier New', monospace;">
                  Matrícula: ${sanitize(data.biomedicalEngineerLicense) || 'CNB-XXXXX'}
                </span>
              </div>
            </td>
            <td style="border: none; width: 4%;"></td>
            <td style="border: none; width: 48%; text-align: center; vertical-align: bottom;">
              <div class="signature-line">
                <strong>${sanitize(data.maintenanceManagerName) || 'Director de Calidad / Mantenimiento'}</strong><br/>
                <span style="font-size: 8pt; color: #475569;">${sanitize(data.maintenanceManagerTitle) || 'Gestión Tecnológica Institucional'}</span><br/>
                <span style="font-size: 7.5pt; color: #64748b;">
                  ${sanitize(data.institutionName) || 'Suministros y Dotaciones de Colombia S.A.S.'}
                </span>
              </div>
            </td>
          </tr>
        </table>

        <!-- PIE DE PÁGINA DOCUMENTAL -->
        <div style="margin-top: 15px; border-top: 1px solid #cbd5e1; padding-top: 4px; font-size: 7.5pt; color: #64748b; text-align: center; font-family: Arial, sans-serif;">
          Sistema de Gestión de la Calidad Biomédica • Habilitación en Salud según Resolución 3100 de 2019 MinSalud • Colombia
        </div>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + wordContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
