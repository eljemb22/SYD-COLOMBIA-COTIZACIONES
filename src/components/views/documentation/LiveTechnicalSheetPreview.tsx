import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Calendar,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import {
  TechnicalSheetData,
  detectDeviceCategory,
  getDefaultReferencesForProduct,
  getDeviceProtocol,
} from '../../../utils/technicalSheetPdfGenerator';

interface LiveTechnicalSheetPreviewProps {
  data: TechnicalSheetData;
  onDownloadPdf?: () => void;
  onPrint?: () => void;
  compactMode?: boolean;
}

export const LiveTechnicalSheetPreview: React.FC<LiveTechnicalSheetPreviewProps> = ({
  data,
  onDownloadPdf,
  onPrint,
  compactMode = false,
}) => {
  const [activePage, setActivePage] = useState<'1' | '2' | 'all'>('1');
  const [zoomLevel, setZoomLevel] = useState<number>(compactMode ? 0.75 : 1);
  const [copied, setCopied] = useState(false);

  const companyName = (data.companyName || '').trim();
  const headerSubtitle = (data.headerSubtitle || 'Ficha Técnica Oficial de Especificaciones').trim();
  const headerCertification = (data.headerCertification || 'Conformidad Técnica & Sanitaria').trim();
  const productName = (data.productName || 'PRODUCTO MÉDICO').toUpperCase();
  const brandName = (data.brand || '').toUpperCase();
  const modelName = (data.model || '').toUpperCase();
  const invima = data.invimaRegistration || '';
  const logoUrl = data.companyLogoUrl || data.logoBase64;

  const handleCopySummary = () => {
    const summary = `FICHA TÉCNICA OFICIAL
PRODUCTO: ${productName}
${companyName ? `EMPRESA: ${companyName}\n` : ''}${brandName ? `MARCA: ${brandName}\n` : ''}${modelName ? `MODELO: ${modelName}\n` : ''}${invima ? `REGISTRO INVIMA: ${invima}\n` : ''}ÁREA: ${data.areaDepartment || 'SERVICIOS HOSPITALARIOS'}
MATERIAL: ${data.fabricationMaterial || 'Grado Médico Certificado'}
FUNCIÓN: ${data.mainFunction || 'Soporte y atención clínica'}
GARANTÍA: ${data.warranty || 'Garantía oficial del fabricante'}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrintLocal = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  // Watermark component
  const renderWatermark = () => {
    if (!data.showWatermark || !logoUrl) return null;
    return (
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-0"
        style={{ opacity: data.watermarkOpacity ?? 0.08 }}
      >
        <img
          src={logoUrl}
          alt="Watermark"
          className="w-72 h-72 object-contain filter grayscale select-none"
        />
      </div>
    );
  };

  // Render Header for each page
  const renderOfficialHeader = (pageNum: number, totalPages: number = 2) => (
    <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4 relative z-10">
      {/* Brand / Company Logo & Info */}
      <div className="flex items-center gap-3">
        {data.showLogoInHeader !== false && (
          logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName || brandName || 'Logo'}
              className="w-12 h-12 object-contain rounded-md border border-slate-200 bg-white p-0.5 shadow-sm"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl border border-sky-300 bg-sky-50 flex flex-col items-center justify-center text-center p-1">
              <Building2 className="w-6 h-6 text-sky-600" />
            </div>
          )
        )}
        <div>
          <span className="text-sm font-black text-sky-800 tracking-wide block uppercase">
            {companyName || brandName || 'DOCUMENTACIÓN BIOMÉDICA'}
          </span>
          <span className="text-[9px] font-semibold text-slate-500 block">
            Ficha Técnica Oficial y Especificaciones Clínicas
          </span>
        </div>
      </div>

      {/* Right Title and Page Number */}
      <div className="text-right">
        <h2 className="text-base font-black text-slate-950 tracking-wider leading-none">
          FICHA TÉCNICA
        </h2>
        <span className="text-[10px] font-semibold text-slate-500 mt-1 block">
          Página {pageNum} de {totalPages}
        </span>
      </div>
    </div>
  );

  // Render Page 1 (Exact match with PDF structure and visual design)
  const renderPage1 = () => (
    <div
      id="sheet-page-1"
      data-technical-sheet="true"
      className="bg-white text-slate-900 p-6 sm:p-8 rounded-sm shadow-xl border border-slate-300 max-w-[800px] w-full mx-auto min-h-[1050px] flex flex-col justify-between relative overflow-hidden"
    >
      {renderWatermark()}
      <div className="relative z-10 space-y-2.5">
        {renderOfficialHeader(1, 2)}

        {/* Product Title */}
        <div className="text-center mt-2 mb-1">
          <h1 className="text-base sm:text-lg font-black text-slate-950 tracking-wide uppercase leading-tight">
            {productName}
          </h1>
        </div>

        {/* Centered Metadata Line */}
        <div className="text-center mb-2">
          <p className="text-[10px] font-bold text-slate-600">
            {brandName && <><span className="text-slate-900 font-black">MARCA:</span> {brandName} &nbsp;•&nbsp; </>}
            {modelName && <><span className="text-slate-900 font-black">MODELO / REF:</span> {modelName} &nbsp;•&nbsp; </>}
            <span className="text-slate-900 font-black">REGISTRO SANITARIO INVIMA:</span> {invima || 'DISPOSITIVO MÉDICO CLASE I/IIa'}
          </p>
        </div>

        {/* Centered Product Image Frame */}
        <div className="flex flex-col items-center justify-center my-1.5">
          <div className="w-80 h-44 border border-slate-300 rounded bg-white flex flex-col items-center justify-center p-1.5 relative shadow-xs">
            {data.productImageBase64 ? (
              <img
                src={data.productImageBase64}
                alt={productName}
                className="w-full h-full object-contain rounded"
              />
            ) : (
              <div className="text-center p-3">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                <span className="text-[10px] font-bold text-slate-700 block">{brandName || 'FOTOGRAFÍA TÉCNICA DEL PRODUCTO'}</span>
                <span className="text-[9px] text-slate-500 block font-mono">{modelName || 'VISTA TÉCNICA BIOMÉDICA'}</span>
                <span className="text-[8px] text-slate-400 block">[Dispositivo Médico Oficial]</span>
              </div>
            )}
          </div>
          {modelName && (
            <span className="text-[9px] font-bold text-slate-500 mt-1">
              Ref. Modelo: {modelName}
            </span>
          )}
        </div>

        {/* Technical Classification Strip (3 Balanced Columns) */}
        <div className="border-y border-slate-200 py-2 my-2">
          <div className="grid grid-cols-3 text-center divide-x divide-slate-200">
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Clasificación Riesgo</span>
              <span className="text-[9.5px] font-bold text-slate-900 block mt-0.5">Clase I / IIa (INVIMA)</span>
            </div>
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Condición Sanitaria</span>
              <span className="text-[9.5px] font-bold text-slate-900 block mt-0.5">Grado Médico Hospitalario</span>
            </div>
            <div>
              <span className="text-[8px] font-bold text-slate-500 uppercase block">Vida Útil Estimada</span>
              <span className="text-[9.5px] font-bold text-slate-900 block mt-0.5">5 Años (Uso Continuo)</span>
            </div>
          </div>
        </div>

        {/* Ámbito de Aplicación Clínica / Servicios Asistenciales */}
        <div className="border-b border-slate-200 pb-2 mb-2">
          <span className="text-[8px] font-bold text-slate-500 uppercase block">
            ÁMBITO DE APLICACIÓN CLÍNICA / SERVICIOS ASISTENCIALES:
          </span>
          <span className="text-[9.5px] font-bold text-sky-600 block mt-0.5 uppercase">
            {data.areaDepartment || 'Servicios Quirúrgicos, Clínicos y Asistenciales'}
          </span>
        </div>

        {/* Descripción Técnica General */}
        {data.description && (
          <div className="mb-2">
            <h3 className="text-[10px] font-black text-slate-900 uppercase mb-0.5">
              DESCRIPCIÓN TÉCNICA GENERAL:
            </h3>
            <p className="text-[9px] text-slate-700 leading-relaxed text-justify">
              {data.description}
            </p>
          </div>
        )}

        {/* Material de Fabricación del Producto */}
        <div className="mb-2">
          <h3 className="text-[10px] font-black text-slate-900 uppercase mb-0.5">
            MATERIAL DE FABRICACIÓN DEL PRODUCTO:
          </h3>
          <p className="text-[9px] text-slate-700 leading-relaxed text-justify">
            {data.fabricationMaterial ||
              'Acero Inoxidable de grado quirúrgico o componentes biomédicos certificados conforme a directivas INVIMA y normas internacionales aplicables, garantizando alta biocompatibilidad y resistencia química ante procesos hospitalarios.'}
          </p>
        </div>

        {/* Función Principal y Aplicación Clínica */}
        <div className="mb-2">
          <h3 className="text-[10px] font-black text-slate-900 uppercase mb-0.5">
            FUNCIÓN PRINCIPAL Y APLICACIÓN CLÍNICA:
          </h3>
          <p className="text-[9px] text-slate-700 leading-relaxed text-justify">
            {data.mainFunction ||
              'Soporte clínico, asistencial o quirúrgico seguro y confiable conforme a la técnica médica, facilitando intervenciones diagnósticas, terapéuticas o de soporte hospitalario continuo.'}
          </p>
        </div>

        {/* Características Técnicas Destacadas */}
        <div className="mb-2">
          <h3 className="text-[10px] font-black text-slate-900 uppercase mb-1">
            CARACTERÍSTICAS TÉCNICAS DESTACADAS:
          </h3>
          <ul className="space-y-1 text-[9px] text-slate-700 leading-relaxed">
            {(data.characteristics && data.characteristics.length > 0
              ? data.characteristics
              : [
                  data.dimensionsDescription || 'Dimensiones adaptadas para uso hospitalario seguro, de fácil movilidad y almacenamiento higiénico en bodegas o áreas de atención.',
                  data.designDescription || 'Acabados lisos, sin cantos vivos ni aristas cortantes, facilitando protocolos rigurosos de asepsia y limpieza institucional.',
                  'Material certificado de grado médico resistente a procesos continuos de desinfección y esterilización hospitalaria.',
                  'Diseño ergonómico que permite un accionamiento suave, seguro y confortable para el personal de salud.',
                  'Compatibilidad con protocolos institucionales de control de infecciones y esterilización central.',
                  'Cumple rigurosamente con requerimientos de calidad y bioseguridad según normatividad sanitaria vigente.'
                ]
            ).slice(0, 8).map((cItem, cIdx) => (
              <li key={cIdx} className="flex items-start gap-1.5">
                <span className="text-sky-600 font-bold leading-none shrink-0">•</span>
                <span>{cItem}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Ventajas Técnicas y Operativas Institucionales */}
        <div className="mb-1">
          <h3 className="text-[10px] font-black text-slate-900 uppercase mb-1">
            VENTAJAS TÉCNICAS Y OPERATIVAS INSTITUCIONALES:
          </h3>
          <ul className="space-y-1 text-[9px] text-slate-700 leading-relaxed">
            {[
              'Resistencia superior a agentes desinfectantes hospitalarios, cloro, alcoholes y soluciones enzimáticas.',
              'Superficies higiénicas no porosas que inhiben la formación de biofilm y adhesión de detritos biológicos.',
              'Excelente estabilidad dimensional y tolerancia ante ciclos repetidos de uso y termodesinfección.'
            ].map((adv, aIdx) => (
              <li key={aIdx} className="flex items-start gap-1.5">
                <span className="text-sky-600 font-bold leading-none shrink-0">•</span>
                <span>{adv}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Page 1 Footer */}
      <div className="pt-2 border-t border-slate-200 mt-auto flex items-center justify-between text-[8px] text-slate-400 relative z-10">
        <span>Continúa en Página 2 — Especificaciones Técnicas, Tabla de Medidas y Garantía</span>
        <span className="font-mono">FT-{modelName || 'PROD'}-P1</span>
        <span>Página 1 de 2</span>
      </div>
    </div>
  );

  // Render Page 2 (Unified: Medidas, Presentación, Garantía, Asepsia, Manipulación y Almacenamiento)
  const renderPage2 = () => {
    const cat = detectDeviceCategory(data);
    const refs = (data.referenceTable && data.referenceTable.length > 0)
      ? data.referenceTable
      : getDefaultReferencesForProduct(data.productName, modelName, cat);

    const designText = data.designDescription || data.dimensionsDescription;
    const proto = getDeviceProtocol(cat, data);

    return (
      <div
        id="sheet-page-2"
        data-technical-sheet="true"
        className="bg-white text-slate-900 p-6 sm:p-8 rounded-sm shadow-xl border border-slate-300 max-w-[800px] w-full mx-auto min-h-[1050px] flex flex-col justify-between relative overflow-hidden"
      >
        {renderWatermark()}
        <div className="relative z-10 space-y-3.5">
          {renderOfficialHeader(2, 2)}

          {/* Section 1: Tabla de Medidas, Configuraciones y Referencias */}
          <div>
            <h3 className="text-xs font-black text-slate-950 uppercase border-b border-slate-300 pb-1 mb-2">
              TABLA DE MEDIDAS, CONFIGURACIONES Y REFERENCIAS TÉCNICAS
            </h3>
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-slate-900 font-black">
                    <th className="py-1.5 px-3 border-r border-slate-300 w-1/3">MEDIDA / REFERENCIA</th>
                    <th className="py-1.5 px-3">DESCRIPCIÓN / APLICACIÓN TÉCNICA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {refs.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-1.5 px-3 font-mono font-bold text-slate-900 border-r border-slate-200 align-top">
                        {row.code}
                      </td>
                      <td className="py-1.5 px-3 text-slate-700 font-medium align-top leading-relaxed">
                        {row.dimension}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Two-column Row - Presentación Comercial & Garantía Oficial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Presentación Comercial */}
            <div className="p-3 rounded border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black text-slate-950 uppercase mb-1">
                  PRESENTACIÓN COMERCIAL Y ROTULADO:
                </h4>
                <p className="text-[9px] text-slate-700 leading-relaxed text-justify">
                  {data.presentation ||
                    'Suministrado en empaque individual sellado con barrera sanitaria de protección. Rotulado reglamentario INVIMA: Marca, Modelo, Lote, Fecha de Fabricación y Registro Sanitario según normativa colombiana vigente.'}
                </p>
              </div>
              {designText && (
                <div className="mt-2 pt-1.5 border-t border-slate-200 text-[8.5px] text-slate-600">
                  <strong className="text-slate-800">Diseño / Ergonomía:</strong> {designText}
                </div>
              )}
            </div>

            {/* Garantía Oficial */}
            <div className="p-3 rounded border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black text-slate-950 uppercase mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>GARANTÍA Y ASISTENCIA TÉCNICA OFICIAL:</span>
                </h4>
                <ul className="text-[9px] text-slate-700 space-y-1 mt-1">
                  {(
                    data.warrantyPoints || (data.warranty ? [data.warranty] : [
                      'Garantía oficial por defectos de fabricación y respaldo institucional.',
                      'Disponibilidad asegurada de repuestos y mano de obra calificada en Colombia.',
                      'Sustitución técnica inmediata ante cualquier anomalía comprobable.',
                      'Acompañamiento y asesoría biomédica permanente.',
                    ])
                  ).slice(0, 4).map((pt, pIdx) => (
                    <li key={pIdx} className="flex items-start gap-1">
                      <span className="text-sky-600 font-bold leading-none">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Section 3: Protocolo de Asepsia / Esterilización y Bioseguridad */}
          <div className="p-3 rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5">
              <h3 className="text-[10.5px] font-black text-slate-950 uppercase">
                {proto.title}
              </h3>
              <span className="text-[8.5px] font-bold text-sky-700 font-mono bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                BIOSEGURIDAD CLÍNICA
              </span>
            </div>
            <p className="text-[9.5px] text-slate-700 leading-relaxed mb-2">
              {proto.description}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[9px]">
              {proto.cards.map((card, cIdx) => (
                <div key={cIdx} className="p-2 rounded border border-slate-200 bg-slate-50/60">
                  <span className="font-black text-sky-900 block text-[9.5px]">{card.title}</span>
                  <span className="text-slate-700 block mt-0.5 font-medium leading-tight">{card.line1}</span>
                  <span className="text-[8px] text-slate-500 block mt-0.5 leading-tight">{card.line2}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Two-column Grid - Manipulación y Almacenamiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Manipulación y Operación */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black text-slate-950 uppercase border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
                  <span>{proto.handlingTitle}</span>
                  <span className="text-[8px] font-bold text-sky-600">USO SEGURO</span>
                </h4>
                <ul className="text-[9px] text-slate-700 space-y-1 leading-relaxed">
                  {proto.handling.slice(0, 4).map((hPoint, hIdx) => (
                    <li key={hIdx} className="flex items-start gap-1">
                      <span className="text-sky-600 font-bold leading-none">•</span>
                      <span>{hPoint}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-500 font-medium">
                <span>Personal: Asistencial / Biomédico</span>
                <span className="text-emerald-700 font-bold">✓ Protocolo institucional</span>
              </div>
            </div>

            {/* Almacenamiento y Conservación */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-black text-slate-950 uppercase border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
                  <span>{proto.storageTitle}</span>
                  <span className="text-[8px] font-bold text-sky-600">CONSERVACIÓN</span>
                </h4>
                <div className="space-y-1 text-[9px] text-slate-700 leading-relaxed">
                  {proto.storage.slice(0, 4).map((sPoint, sIdx) => (
                    <div key={sIdx} className="flex items-start gap-1">
                      <span className="text-sky-600 font-bold leading-none">•</span>
                      <span>{sPoint}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-500 font-medium">
                <span>Ambiente controlado</span>
                <span className="text-sky-700 font-bold">Sin condensación</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 Footer */}
        <div className="pt-3 border-t border-slate-200 mt-4 flex items-center justify-between text-[8px] text-slate-400 relative z-10">
          <span>{companyName || brandName || 'Documentación Técnica Hospitalaria'}</span>
          <span className="font-mono">FT-{modelName || 'PROD'}-P2</span>
          <span>Fin del Documento Técnico Oficial. Válido institucionalmente.</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a1526] rounded-2xl border border-[#22395d] overflow-hidden shadow-2xl">
      {/* Top Toolbar */}
      <div className="bg-[#12233e] border-b border-[#22395d] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {/* Page Switcher Tabs */}
        <div className="flex items-center gap-1 bg-[#0d1b30] p-1 rounded-xl border border-[#22395d]">
          <button
            type="button"
            onClick={() => setActivePage('1')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activePage === '1'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Hoja 1: Portada y Specs</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage('2')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activePage === '2'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Hoja 2: Medidas, Garantía & Bioseguridad</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activePage === 'all'
                ? 'bg-cyan-400 text-slate-950 shadow-sm font-black'
                : 'text-cyan-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ver Ambas Hojas (2 Hojas)</span>
          </button>
        </div>

        {/* Controls: Zoom & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom controls */}
          <div className="flex items-center bg-[#0d1b30] rounded-xl border border-[#22395d] px-1 py-0.5">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.1))}
              className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
              title="Reducir zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-cyan-300 px-1.5 font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
              className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy Summary */}
          <button
            type="button"
            onClick={handleCopySummary}
            className="bg-[#1a2f4e] hover:bg-[#25426c] text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-[#334d6e] transition flex items-center gap-1.5 cursor-pointer"
            title="Copiar texto de la ficha técnica"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrintLocal}
            className="bg-[#1a2f4e] hover:bg-[#25426c] text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-[#334d6e] transition flex items-center gap-1.5 cursor-pointer"
            title="Imprimir documento"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Imprimir</span>
          </button>

          {/* Download PDF button */}
          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              title="Descargar PDF Oficial Idéntico a la Vista Previa"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Canvas Viewport */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center bg-slate-900/90">
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="w-full flex flex-col items-center gap-8 pb-12"
        >
          {activePage === '1' && renderPage1()}
          {activePage === '2' && renderPage2()}
          {activePage === 'all' && (
            <>
              {renderPage1()}
              {renderPage2()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
