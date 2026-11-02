import React from 'react';
import { EquipmentLifeSheetData } from '../../../types';
import { formatCOP } from '../../../utils/formatters';

interface LiveEquipmentLifeSheetPreviewProps {
  data: EquipmentLifeSheetData;
  companyLogoUrl?: string;
  zoomScale?: number;
}

export const LiveEquipmentLifeSheetPreview: React.FC<LiveEquipmentLifeSheetPreviewProps> = ({
  data,
  companyLogoUrl,
  zoomScale = 1,
}) => {
  const activeLogo = data.logoUrl || companyLogoUrl;

  return (
    <div
      id="printable-life-sheet-document"
      data-life-sheet="true"
      className="bg-white text-slate-900 rounded-lg shadow-2xl p-6 sm:p-8 mx-auto font-sans transition-all duration-150 border border-slate-300 print-paper max-w-[850px] w-full"
      style={{
        transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
        transformOrigin: 'top center',
        color: '#0f172a',
        backgroundColor: '#ffffff',
      }}
    >
      {/* 1. INSTITUTIONAL HEADER TABLE (Resolución 3100 / Circular 029 MinSalud) */}
      <table className="w-full border-collapse border-2 border-slate-900 mb-4 text-xs" style={{ borderColor: '#0f172a' }}>
        <tbody>
          <tr>
            <td className="w-32 p-2 border-r-2 border-slate-900 text-center align-middle bg-slate-50" style={{ borderColor: '#0f172a', backgroundColor: '#f8fafc' }}>
              {activeLogo ? (
                <img
                  src={activeLogo}
                  alt="Logo Institucional"
                  className="max-h-14 max-w-full mx-auto object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-1">
                  <div className="w-10 h-10 rounded-lg bg-sky-600 text-white font-black flex items-center justify-center text-sm shadow-xs" style={{ backgroundColor: 'var(--syd-accent-light)', color: '#ffffff' }}>
                    SyD
                  </div>
                  <span className="text-[9px] font-bold text-slate-800 tracking-tight mt-1" style={{ color: '#1e293b' }}>
                    COLOMBIA
                  </span>
                </div>
              )}
            </td>
            <td className="p-2 border-r-2 border-slate-900 text-center align-middle" style={{ borderColor: '#0f172a' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700" style={{ color: '#334155' }}>
                {data.institutionName || 'SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.'}
              </div>
              <div className="text-[9.5px] text-slate-600 font-mono" style={{ color: '#475569' }}>
                NIT: {data.institutionNit || '901.458.239-1'} • {data.departmentCity || 'Bogotá D.C., Colombia'}
              </div>
              <h1 className="text-sm sm:text-base font-black uppercase tracking-tight mt-0.5" style={{ color: '#0f172a' }}>
                HOJA DE VIDA DE EQUIPO BIOMÉDICO
              </h1>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0369a1' }}>
                PROGRAMA DE GESTIÓN TECNOLÓGICA Y MANTENIMIENTO HOSPITALARIO
              </div>
            </td>
            <td className="w-36 p-1.5 text-[10px] align-middle bg-slate-50" style={{ backgroundColor: '#f8fafc' }}>
              <div className="space-y-1">
                <div>
                  <span className="font-bold text-slate-600 block" style={{ color: '#475569' }}>CÓDIGO:</span>
                  <span className="font-mono font-bold" style={{ color: '#0f172a' }}>{data.formatCode || 'F-GHB-01'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-600 block" style={{ color: '#475569' }}>VERSIÓN:</span>
                  <span className="font-bold" style={{ color: '#0f172a' }}>{data.formatVersion || 'Versión 04'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-600 block" style={{ color: '#475569' }}>EMISIÓN:</span>
                  <span className="font-mono" style={{ color: '#0f172a' }}>{data.acquisitionDate || new Date().toISOString().slice(0, 10)}</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* 2. IDENTIFICACIÓN Y UBICACIÓN INSTITUCIONAL */}
      <div className="mb-3">
        <div 
          className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-xs flex items-center justify-between"
          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
        >
          <span style={{ color: '#ffffff' }}>1. Identificación del Equipo Biomédico &amp; Clasificación</span>
          <span className="text-[9.5px] font-mono font-bold" style={{ color: '#67e8f9' }}>MinSalud Res. 3100 / 2019</span>
        </div>
        <table className="w-full border-collapse border border-slate-300 text-[11px] mt-1" style={{ borderColor: '#cbd5e1' }}>
          <tbody>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold w-1/4" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Nombre del Equipo:</td>
              <td className="p-1.5 font-black w-1/4" colSpan={3} style={{ color: 'var(--syd-accent-light)' }}>
                {data.equipmentName || '—'}
              </td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Marca:</td>
              <td className="p-1.5 font-bold" style={{ color: '#0f172a' }}>{data.brand || '—'}</td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Modelo:</td>
              <td className="p-1.5 font-bold" style={{ color: '#0f172a' }}>{data.model || '—'}</td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Número de Serie (S/N):</td>
              <td className="p-1.5 font-mono font-bold" style={{ color: '#0369a1' }}>{data.serialNumber || '—'}</td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Placa Activo Fijo / Inv:</td>
              <td className="p-1.5 font-mono font-bold" style={{ color: '#0f172a' }}>{data.inventoryPlate || '—'}</td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Servicio / Ubicación:</td>
              <td className="p-1.5 font-bold" style={{ color: '#0f172a' }}>{data.serviceLocation || '—'}</td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Registro INVIMA:</td>
              <td className="p-1.5 font-bold text-[10.5px]" style={{ color: '#0f172a' }}>{data.invimaRecord || '—'}</td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Clasificación de Riesgo:</td>
              <td className="p-1.5 font-bold" style={{ color: '#047857' }}>
                <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 border border-emerald-300 font-black" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' }}>
                  {data.riskClassification || 'Clase I'}
                </span>
              </td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Clasificación Biomédica:</td>
              <td className="p-1.5 font-medium" style={{ color: '#0f172a' }}>{data.biomedicalClassification || '—'}</td>
            </tr>
            <tr>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Tecnología Predominante:</td>
              <td className="p-1.5" style={{ color: '#0f172a' }}>{data.technologyType || '—'}</td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Vida Útil Estimada:</td>
              <td className="p-1.5 font-bold" style={{ color: '#0f172a' }}>{data.usefulLifeYears ? `${data.usefulLifeYears} Años` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 3. DATOS DE ADQUISICIÓN Y GARANTÍA */}
      <div className="mb-3">
        <div 
          className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-xs flex items-center justify-between"
          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
        >
          <span style={{ color: '#ffffff' }}>2. Registro de Adquisición, Garantía &amp; Proveedor</span>
          <span className="text-[9.5px] font-mono font-bold" style={{ color: '#67e8f9' }}>Trazabilidad Comercial</span>
        </div>
        <table className="w-full border-collapse border border-slate-300 text-[11px] mt-1" style={{ borderColor: '#cbd5e1' }}>
          <tbody>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold w-1/4" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Fabricante / Proveedor:</td>
              <td className="p-1.5 font-bold" colSpan={3} style={{ color: '#0f172a' }}>
                {data.supplier || '—'} {data.supplierPhone ? `• Tel: ${data.supplierPhone}` : ''}
              </td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Fecha de Adquisición:</td>
              <td className="p-1.5 font-mono" style={{ color: '#0f172a' }}>{data.acquisitionDate || '—'}</td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Fecha de Instalación:</td>
              <td className="p-1.5 font-mono" style={{ color: '#0f172a' }}>{data.installationDate || '—'}</td>
            </tr>
            <tr>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Estado de Garantía:</td>
              <td className="p-1.5">
                <span 
                  className={`px-1.5 py-0.5 rounded-sm font-bold text-[10px] ${
                    data.warrantyStatus === 'Vigente'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                  style={{
                    backgroundColor: data.warrantyStatus === 'Vigente' ? '#d1fae5' : '#fef3c7',
                    color: data.warrantyStatus === 'Vigente' ? '#065f46' : '#92400e',
                  }}
                >
                  {data.warrantyStatus || 'Vigente'}
                </span>
                {data.warrantyExpiration && (
                  <span className="ml-2 font-mono text-[10px]" style={{ color: '#475569' }}>
                    Vence: {data.warrantyExpiration}
                  </span>
                )}
              </td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Factura / Orden de Compra:</td>
              <td className="p-1.5 font-mono font-bold" style={{ color: '#0f172a' }}>{data.purchaseInvoiceOrOC || '—'}</td>
            </tr>
            {Boolean(data.commercialValueCOP && data.commercialValueCOP > 0) && (
              <tr className="border-t border-slate-300" style={{ borderColor: '#cbd5e1' }}>
                <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Valor Comercial (COP):</td>
                <td className="p-1.5 font-mono font-bold text-emerald-700" colSpan={3} style={{ color: '#047857' }}>
                  {formatCOP(data.commercialValueCOP)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. ESPECIFICACIONES TÉCNICAS Y REQUERIMIENTOS ELÉCTRICOS */}
      <div className="mb-3">
        <div 
          className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-xs flex items-center justify-between"
          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
        >
          <span style={{ color: '#ffffff' }}>3. Especificaciones Técnicas, Eléctricas &amp; Ambientales</span>
          <span className="text-[9.5px] font-mono font-bold" style={{ color: '#67e8f9' }}>Parámetros Operativos</span>
        </div>
        <table className="w-full border-collapse border border-slate-300 text-[11px] mt-1" style={{ borderColor: '#cbd5e1' }}>
          <tbody>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold w-1/4" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Voltaje de Alimentación:</td>
              <td className="p-1.5 font-mono" style={{ color: '#0f172a' }}>{data.voltageVolts || '—'}</td>
              <td className="p-1.5 font-bold w-1/4" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Consumo de Corriente:</td>
              <td className="p-1.5 font-mono" style={{ color: '#0f172a' }}>{data.currentAmperes || '—'}</td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Frecuencia Eléctrica:</td>
              <td className="p-1.5 font-mono" style={{ color: '#0f172a' }}>{data.frequencyHz || '—'}</td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Potencia Máxima:</td>
              <td className="p-1.5 font-mono" style={{ color: '#0f172a' }}>{data.powerWatts || '—'}</td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Batería de Respaldo:</td>
              <td className="p-1.5" colSpan={3} style={{ color: '#0f172a' }}>
                {data.batteryType || '—'}
              </td>
            </tr>
            <tr>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Rango Temp / Humedad:</td>
              <td className="p-1.5" style={{ color: '#0f172a' }}>
                {data.operatingTemperature || '—'} {data.humidityRange ? `• ${data.humidityRange}` : ''}
              </td>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Dimensiones y Peso:</td>
              <td className="p-1.5" style={{ color: '#0f172a' }}>{data.weightDimensions || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. PROTOCOLO DE MANTENIMIENTO, METROLOGÍA Y ACCESORIOS */}
      <div className="mb-3">
        <div 
          className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-xs flex items-center justify-between"
          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
        >
          <span style={{ color: '#ffffff' }}>4. Protocolo de Mantenimiento Preventivo &amp; Calibración</span>
          <span className="text-[9.5px] font-mono font-bold" style={{ color: '#67e8f9' }}>Plan de Aseguramiento Metrológico</span>
        </div>
        <table className="w-full border-collapse border border-slate-300 text-[11px] mt-1" style={{ borderColor: '#cbd5e1' }}>
          <tbody>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold w-1/4" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Frecuencia Preventivo:</td>
              <td className="p-1.5 font-black" style={{ color: 'var(--syd-accent-light)' }}>{data.maintenanceFrequency || 'Semestral'}</td>
              <td className="p-1.5 font-bold w-1/4" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Requiere Calibración:</td>
              <td className="p-1.5 font-bold">
                {data.requiresCalibration ? (
                  <span className="px-1.5 py-0.5 rounded-sm border" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', borderColor: '#d8b4fe' }}>
                    SÍ ({data.calibrationFrequency || 'Anual'})
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-sm" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>NO APLICA</span>
                )}
              </td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Variable / Magnitud Calibrable:</td>
              <td className="p-1.5" colSpan={3} style={{ color: '#0f172a' }}>
                {data.calibrationVariable || '—'}
              </td>
            </tr>
            <tr className="border-b border-slate-300" style={{ borderColor: '#cbd5e1' }}>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Manuales Disponibles:</td>
              <td className="p-1.5" colSpan={3} style={{ color: '#0f172a' }}>
                <div className="flex items-center gap-4 text-[10.5px]">
                  <span>{data.manualsAvailable?.userManual ? '☑' : '☐'} Manual de Usuario (Español)</span>
                  <span>{data.manualsAvailable?.serviceManual ? '☑' : '☐'} Manual de Servicio / Técnico</span>
                  <span>{data.manualsAvailable?.technicalSheet ? '☑' : '☐'} Ficha Técnica Oficial</span>
                </div>
              </td>
            </tr>
            <tr>
              <td className="p-1.5 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>Accesorios &amp; Consumibles:</td>
              <td className="p-1.5 text-[10.5px] leading-relaxed" colSpan={3} style={{ color: '#0f172a' }}>
                {data.accessoriesIncluded || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. HISTORIAL DE INTERVENCIONES Y MANTENIMIENTOS */}
      <div className="mb-4">
        <div 
          className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-xs flex items-center justify-between"
          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
        >
          <span style={{ color: '#ffffff' }}>5. Historial de Mantenimientos &amp; Calificaciones Técnicas</span>
          <span className="text-[9.5px] font-mono font-bold" style={{ color: '#67e8f9' }}>Registro Cronológico</span>
        </div>
        <table className="w-full border-collapse border border-slate-300 text-[10px] mt-1" style={{ borderColor: '#cbd5e1' }}>
          <thead>
            <tr className="border-b border-slate-300 font-bold" style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderColor: '#cbd5e1' }}>
              <th className="p-1.5 text-left border-r border-slate-300 w-20" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>Fecha</th>
              <th className="p-1.5 text-left border-r border-slate-300 w-24" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>Tipo</th>
              <th className="p-1.5 text-left border-r border-slate-300" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>Descripción del Trabajo / Repuestos</th>
              <th className="p-1.5 text-left border-r border-slate-300 w-24" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>Reporte N°</th>
              <th className="p-1.5 text-left border-r border-slate-300 w-36" style={{ borderColor: '#cbd5e1', color: '#1e293b' }}>Técnico / Ingeniero</th>
              <th className="p-1.5 text-center w-20" style={{ color: '#1e293b' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.interventions && data.interventions.length > 0 ? (
              data.interventions.map((itv, idx) => (
                <tr key={itv.id || idx} className="border-b border-slate-200" style={{ borderColor: '#e2e8f0' }}>
                  <td className="p-1.5 border-r border-slate-200 font-mono" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>{itv.date}</td>
                  <td className="p-1.5 border-r border-slate-200 font-bold" style={{ borderColor: '#e2e8f0', color: '#0369a1' }}>{itv.type}</td>
                  <td className="p-1.5 border-r border-slate-200" style={{ borderColor: '#e2e8f0', color: '#1e293b' }}>
                    <div>{itv.description}</div>
                    {itv.partsReplaced && itv.partsReplaced !== 'N/A' && (
                      <div className="text-[9px] font-mono mt-0.5" style={{ color: '#64748b' }}>
                        Repuestos: {itv.partsReplaced}
                      </div>
                    )}
                  </td>
                  <td className="p-1.5 border-r border-slate-200 font-mono" style={{ borderColor: '#e2e8f0', color: '#475569' }}>{itv.reportNumber || '—'}</td>
                  <td className="p-1.5 border-r border-slate-200" style={{ borderColor: '#e2e8f0', color: '#0f172a' }}>
                    <div className="font-bold">{itv.engineerName}</div>
                    {itv.professionalLicense && (
                      <div className="text-[8.5px] font-mono" style={{ color: '#64748b' }}>{itv.professionalLicense}</div>
                    )}
                  </td>
                  <td className="p-1.5 text-center">
                    <span 
                      className="px-1.5 py-0.5 rounded-xs font-bold text-[9px]"
                      style={{
                        backgroundColor: itv.status === 'Operativo' ? '#d1fae5' : itv.status === 'Fuera de Servicio' ? '#ffe4e6' : '#fef3c7',
                        color: itv.status === 'Operativo' ? '#065f46' : itv.status === 'Fuera de Servicio' ? '#9f1239' : '#92400e',
                      }}
                    >
                      {itv.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-3 text-center italic" style={{ color: '#94a3b8' }}>
                  Sin intervenciones registradas. El equipo se encuentra en estado inicial de entrega.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 7. FIRMAS OFICIALES DE HABILITACIÓN HOSPITALARIA */}
      <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-center text-xs mt-6" style={{ borderColor: '#0f172a' }}>
        <div>
          <div className="h-12 border-b border-slate-700 flex items-end justify-center pb-1" style={{ borderColor: '#334155' }}>
            <span className="font-serif italic text-sm" style={{ color: '#94a3b8' }}>Firma Digital Verificada</span>
          </div>
          <div className="mt-1 font-bold uppercase" style={{ color: '#0f172a' }}>
            {data.biomedicalEngineerName || 'Ingeniero Biomédico Responsable'}
          </div>
          <div className="text-[10px]" style={{ color: '#475569' }}>
            {data.biomedicalEngineerTitle || 'Especialista en Mantenimiento'}
          </div>
          <div className="text-[9.5px] font-mono" style={{ color: '#64748b' }}>
            {data.biomedicalEngineerLicense ? `Matrícula: ${data.biomedicalEngineerLicense}` : ''}
          </div>
        </div>

        <div>
          <div className="h-12 border-b border-slate-700 flex items-end justify-center pb-1" style={{ borderColor: '#334155' }}>
            <span className="font-serif italic text-sm" style={{ color: '#94a3b8' }}>Firma y Sello Institucional</span>
          </div>
          <div className="mt-1 font-bold uppercase" style={{ color: '#0f172a' }}>
            {data.maintenanceManagerName || 'Director de Calidad / Mantenimiento'}
          </div>
          <div className="text-[10px]" style={{ color: '#475569' }}>
            {data.maintenanceManagerTitle || 'Gestión Tecnológica Institucional'}
          </div>
          <div className="text-[9.5px] font-mono" style={{ color: '#64748b' }}>
            {data.institutionName || 'SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.'}
          </div>
        </div>
      </div>

      {/* FOOTER DOCUMENTAL */}
      <div className="mt-6 pt-2 border-t border-slate-300 text-[9px] flex items-center justify-between font-mono" style={{ borderColor: '#cbd5e1', color: '#64748b' }}>
        <span>Sistema de Gestión de Calidad Biomédica • SYD Colombia S.A.S.</span>
        <span>Resolución 3100 de 2019 • Habilitación en Salud</span>
        <span>Página 1 de 1</span>
      </div>
    </div>
  );
};
