import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, FileDown, Download, Loader2, Image as ImageIcon, LayoutList } from 'lucide-react';
import { QuoteHeader, QuoteItem } from '../../types';
import { formatCOP, numberToSpanishWords } from '../../utils/formatters';
import { exportQuoteToWord } from '../../utils/exportUtils';
import { exportQuoteToPdf, printQuoteDocument } from '../../utils/pdfAndPrintUtils';
import { DefaultDocumentSignature } from '../common/SyDLetterhead';
import { getOfficialSyDLetterheadDataUrl, OFFICIAL_SYD_LETTERHEAD_SVG_PATH } from '../../utils/sydDefaultLetterhead';
import { generateClinicalEquipmentGraphicDataUrl } from '../../utils/clinicalEquipmentGraphic';
import {
  getBiomedicalHeuristicSpecs,
  isGenericFiller,
  extractEquipmentAndAccessories,
} from '../../services/geminiEquipmentService';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteHeader: QuoteHeader;
  quoteItems: QuoteItem[];
  customLetterheadUrl?: string | null;
  marginSettings?: {
    subirBajar: number;
    izqDer: number;
    tableScale: number;
  };
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  quoteHeader,
  quoteItems,
  customLetterheadUrl,
  marginSettings,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [formatStyle, setFormatStyle] = useState<'standard' | 'with-images'>(
    quoteHeader.formatStyle || 'standard'
  );

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalQuantity = quoteItems.reduce((acc, it) => acc + it.quantity, 0);
  const subtotal = quoteItems.reduce((acc, it) => acc + it.totalSalePrice, 0);
  const iva = subtotal * (quoteHeader.taxRate || 0.19);
  const total = subtotal + iva;
  const totalWords = numberToSpanishWords(total);

  const effectiveLetterheadUrl = customLetterheadUrl && customLetterheadUrl !== 'none' && customLetterheadUrl.length > 20
    ? customLetterheadUrl
    : null;

  const padTop = marginSettings?.subirBajar ?? (effectiveLetterheadUrl ? 154 : 50);
  const padSide = marginSettings?.izqDer ?? 78;

  const canFitConditionsOnSameSheet =
    (formatStyle === 'with-images' && quoteItems.length <= 1) ||
    (formatStyle === 'standard' && quoteItems.length <= 3);

  const getSafeDisplayImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('http://localhost') || url.startsWith('blob:')) {
      return url;
    }
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const handlePrint = () => {
    printQuoteDocument();
  };

  const handlePdf = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await exportQuoteToPdf(quoteHeader.quoteNumber);
    } catch (e) {
      console.error(e);
      alert('Hubo un inconveniente al generar el PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#112237] border border-[#223d60] rounded-2xl max-w-5xl lg:max-w-6xl w-full p-4 sm:p-6 space-y-4 shadow-2xl animate-scaleUp max-h-[92vh] overflow-y-auto my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#223d60] no-print flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#38bdf8]" />
            <h3 className="text-sm sm:text-base font-bold text-white">Vista Previa de Impresión Oficial</h3>
          </div>

          {/* Toggle Formato Estándar vs Con Imágenes */}
          <div className="flex items-center bg-[#0a1526] p-0.5 rounded-lg border border-[#223d60]">
            <button
              type="button"
              onClick={() => setFormatStyle('standard')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                formatStyle === 'standard'
                  ? 'bg-[#0284c7] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Estándar</span>
            </button>
            <button
              type="button"
              onClick={() => setFormatStyle('with-images')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                formatStyle === 'with-images'
                  ? 'bg-[#0284c7] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Con Imágenes</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                exportQuoteToWord(quoteHeader, quoteItems, {
                  headerMarginTop: marginSettings?.subirBajar ?? 154,
                  sidePadding: marginSettings?.izqDer ?? 78,
                  companyLetterheadUrl: customLetterheadUrl || undefined,
                  formatStyle: formatStyle,
                })
              }
              className="inline-flex items-center gap-1 bg-[#15253d] hover:bg-[#1f375b] text-slate-200 border border-[#223d60] text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="hidden sm:inline">Word (.docx)</span>
              <span className="sm:hidden">Word</span>
            </button>
            <button
              onClick={handlePdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1 bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer shadow-xs"
            >
              {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-bold text-xs px-3 sm:px-3.5 py-1.5 rounded-lg cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
              title="Cerrar vista previa"
            >
              <X className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>

        {/* Printable 3-Page Document Container */}
        <div className="space-y-8">
          {/* ==================== HOJA 1: PRESENTACIÓN ==================== */}
          <div className="bg-white text-slate-900 rounded-sm shadow-xl font-sans relative overflow-hidden min-h-[1050px] flex flex-col justify-between print:shadow-none print:m-0 print:break-after-page">
            {effectiveLetterheadUrl ? (
              <img
                src={effectiveLetterheadUrl}
                alt="Membrete Oficial SyD Colombia"
                className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 select-none print:w-full print:h-full"
              />
            ) : null}
            <div
              className="relative z-10 space-y-6 text-[12.5px] leading-relaxed text-slate-800 flex-1 flex flex-col justify-between"
              style={{
                paddingTop: `${padTop}px`,
                paddingLeft: `${padSide}px`,
                paddingRight: `${padSide}px`,
                paddingBottom: '60px',
              }}
            >
              <div className="text-slate-800 font-normal mb-6">
                {quoteHeader.date || 'Barranquilla, 17 de Agosto de 2026'}
              </div>

                <div className="space-y-0.5 mb-6">
                  <div className="text-slate-700">Señor(es):</div>
                  <div className="text-base font-black text-slate-950 tracking-tight uppercase">
                    {quoteHeader.clientName || 'CLÍNICA LA COSTA S'}
                  </div>
                  <div className="text-slate-700 font-medium">
                    {quoteHeader.city || 'Barranquilla, Atlántico'}
                  </div>
                </div>

                <div className="text-right pt-2 space-y-0.5 mb-6">
                  <div className="font-bold text-slate-950 text-sm">
                    Asunto: Cotización Comercial
                  </div>
                  <div className="font-bold text-slate-950 font-mono text-sm">
                    {quoteHeader.quoteNumber || 'COTIZACIÓN'}
                  </div>
                </div>

                <div className="pt-2 mb-4">
                  <strong className="font-bold text-slate-950 text-sm">Cordial Saludo:</strong>
                </div>

                <div className="space-y-4 text-justify leading-relaxed text-slate-800 text-[13px]">
                  <p>
                    <strong>SUMINISTROS Y DOTACIONES COLOMBIA S.A.</strong> presentamos a su consideración la propuesta para la adquisición de equipos, insumos y material médico, cuya descripción y demás condiciones de venta están incorporadas a la presente cotización.
                  </p>

                  <p>
                    <strong>SYD COLOMBIA S.A.</strong> distribuye en el país a algunas de las más importantes empresas fabricantes de medicamentos, insumos y dispositivos médicos del mundo, situación que avala su seriedad y profesionalismo en este campo.
                  </p>

                  <p>
                    Contamos con personal calificado para brindarle una asesoría integral en todas las etapas de su adquisición, de manera que usted pueda satisfacer sus necesidades. Disponemos además de personal técnico, cuyos conocimientos incluyen una excelente preparación teórica y experiencia en el campo, lo que nos permite brindar una oportuna atención a todos nuestros clientes.
                  </p>

                  <p>
                    En caso de optar por nuestra propuesta, podrá estar seguro de que tendrá todo el respaldo que da nuestra amplia trayectoria a nivel nacional, bajo un marco de honestidad, calidad y profesionalismo. La expedición de la orden de compra mediante la cual se acepta la presente oferta mercantil supone el conocimiento y aceptación expresa de las condiciones contempladas en ella.
                  </p>
                </div>
            </div>
          </div>

          {/* ==================== HOJA 2: TABLA DE EQUIPOS ==================== */}
          <div className={`bg-white text-slate-900 rounded-sm shadow-xl font-sans relative overflow-hidden ${canFitConditionsOnSameSheet ? 'min-h-[1050px]' : 'min-h-[1050px] flex flex-col justify-between'} print:shadow-none print:m-0 print:break-after-page`}>
            {effectiveLetterheadUrl ? (
              <img
                src={effectiveLetterheadUrl}
                alt="Membrete Oficial SyD Colombia"
                className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 select-none print:w-full print:h-full"
              />
            ) : null}
            <div
              className={`relative z-10 ${canFitConditionsOnSameSheet ? 'space-y-4' : 'space-y-5 flex-1 flex flex-col justify-between'}`}
              style={{
                paddingTop: `${padTop}px`,
                paddingLeft: `${padSide}px`,
                paddingRight: `${padSide}px`,
                paddingBottom: '60px',
              }}
            >
              <div className="flex justify-between items-end border-b border-slate-300 pb-2 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                      Cuadro Técnico y Valorización Económica de Equipos
                    </h3>
                    <p className="text-[10.5px] text-slate-600">
                      Propuesta Comercial <strong className="text-slate-900 font-mono">{quoteHeader.quoteNumber}</strong> • {quoteHeader.clientName}
                    </p>
                  </div>
                  <div className="text-right text-[10px] text-slate-500 font-mono">
                    Valores expresados en COP
                  </div>
                </div>

              <div className="overflow-x-auto border border-black rounded-sm">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-[#d9e2f3] text-slate-950 font-bold border-b border-black">
                      <th className="p-2 border-r border-black text-center w-10 font-bold">Item</th>
                      <th className="p-2 border-r border-black font-bold">Descripción</th>
                      <th className="p-2 border-r border-black font-bold w-24">Marca</th>
                      <th className="p-2 border-r border-black font-bold w-24">Modelo</th>
                      <th className="p-2 border-r border-black text-center font-bold w-12">Cant.</th>
                      <th className="p-2 border-r border-black text-right font-bold w-28">Precio</th>
                      <th className="p-2 border-r border-black text-right font-bold w-28">Subtotal</th>
                      <th className="p-2 border-r border-black text-right font-bold w-24">Iva</th>
                      <th className="p-2 text-right font-bold w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-500 italic bg-slate-50">
                          No hay equipos en la propuesta.
                        </td>
                      </tr>
                    ) : (
                      quoteItems.map((item, index) => {
                        const itemSubtotal = item.totalSalePrice;
                        const itemTaxRate = item.taxExempt ? 0 : (item.taxRate !== undefined ? item.taxRate : (quoteHeader.taxRate || 0.19));
                        const itemIva = Math.round(itemSubtotal * itemTaxRate);
                        const itemTotal = itemSubtotal + itemIva;

                        const { cleanName, accessoriesText, hasAccessories } = extractEquipmentAndAccessories(item.name, item.accessories);
                        const heuristicSpecs = getBiomedicalHeuristicSpecs(cleanName || item.name, item.brand, item.model);

                        let cleanDesc = item.briefDescription;
                        if (!cleanDesc || isGenericFiller(cleanDesc)) {
                          cleanDesc = heuristicSpecs.description;
                        }

                        let rawSpecs = item.technicalFeatures;
                        const hasGenericFeatures = Array.isArray(rawSpecs) && rawSpecs.some((f) => isGenericFiller(f));
                        if (!rawSpecs || rawSpecs.length === 0 || hasGenericFeatures) {
                          rawSpecs = heuristicSpecs.features;
                        }

                        const displaySpecs = (rawSpecs || [])
                          .map((s) => s.trim())
                          .filter(
                            (s) =>
                              s.length > 0 &&
                              !s.toLowerCase().includes('invima') &&
                              !s.toLowerCase().includes('garantía') &&
                              !s.toLowerCase().includes('garantia') &&
                              !isGenericFiller(s)
                          )
                          .slice(0, 7);

                        return (
                          <React.Fragment key={item.id}>
                            <tr
                              className={`border-b border-black ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}
                            >
                              <td className="p-2 text-center font-normal text-slate-900 border-r border-black">
                                {index + 1}
                              </td>
                              <td className="p-2 border-r border-black">
                                <strong className="text-slate-900 block uppercase font-normal">
                                  {(formatStyle === 'with-images' ? cleanName : item.name).toUpperCase()}
                                </strong>
                                {formatStyle !== 'with-images' && hasAccessories && (
                                  <span className="text-[10px] text-slate-600 font-sans block mt-0.5">
                                    <strong>Accesorios:</strong> {accessoriesText}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 font-normal text-slate-900 border-r border-black uppercase">
                                {item.brand.toUpperCase()}
                              </td>
                              <td className="p-2 font-normal text-slate-900 border-r border-black uppercase">
                                {item.model.toUpperCase()}
                              </td>
                              <td className="p-2 text-center font-normal text-slate-900 border-r border-black">
                                {item.quantity}
                              </td>
                              <td className="p-2 text-center font-normal text-slate-900 border-r border-black">
                                {formatCOP(item.unitSalePrice)}
                              </td>
                              <td className="p-2 text-center font-normal text-slate-900 border-r border-black">
                                {formatCOP(itemSubtotal)}
                              </td>
                              <td className="p-2 text-center font-normal text-slate-900 border-r border-black">
                                {itemIva > 0 ? formatCOP(itemIva) : '$ -'}
                              </td>
                              <td className="p-2 text-center font-normal text-slate-900">
                                {formatCOP(itemTotal)}
                              </td>
                            </tr>
                            {formatStyle === 'with-images' && (
                              <tr className="border-b border-black bg-white">
                                <td className="border-r border-black bg-white"></td>
                                <td colSpan={3} className="p-2 border-r border-black text-center align-middle bg-white">
                                  {(() => {
                                    const fallbackGraphic = generateClinicalEquipmentGraphicDataUrl(cleanName || item.name, item.brand, item.model);
                                    const rawImg = item.imageUrl ? getSafeDisplayImageUrl(item.imageUrl) : '';
                                    const displayImgUrl = rawImg || fallbackGraphic;

                                    return (
                                      <div className="w-full h-full min-h-[190px] max-h-[250px] flex items-center justify-center p-1">
                                        <img
                                          src={displayImgUrl}
                                          alt={cleanName}
                                          onError={(e) => {
                                            const target = e.currentTarget;
                                            if (target.src !== fallbackGraphic) {
                                              target.src = fallbackGraphic;
                                            }
                                          }}
                                          className="max-h-[235px] max-w-full w-auto h-auto object-contain mx-auto"
                                        />
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td colSpan={5} className="p-3 align-middle text-left text-slate-900 bg-white">
                                  <div className="mb-2">
                                    <span className="text-[10px] font-bold text-[#0f2744] uppercase block mb-0.5">
                                      DESCRIPCIÓN Y FUNCIONALIDAD:
                                    </span>
                                    <p className="text-[9.5px] text-slate-800 leading-snug">
                                      {cleanDesc}
                                    </p>
                                  </div>
                                  {displaySpecs.length > 0 && (
                                    <div>
                                      <span className="text-[10px] font-bold text-[#0f2744] uppercase block mb-0.5">
                                        CARACTERÍSTICAS PRINCIPALES:
                                      </span>
                                      <ul className="text-[9px] text-slate-700 space-y-0.5 pl-3 list-disc">
                                        {displaySpecs.map((feat, fIdx) => (
                                          <li key={fIdx}>{feat.replace(/^[•\-\*]\s*/, '')}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {hasAccessories && (
                                    <div className="mt-2.5 pt-2 border-t border-slate-200">
                                      <span className="text-[10px] font-bold text-[#0f2744] uppercase block mb-0.5">
                                        ACCESORIOS INCLUIDOS:
                                      </span>
                                      <p className="text-[9px] text-slate-700 leading-snug uppercase">
                                        {accessoriesText}
                                      </p>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#d9e2f3] font-bold text-slate-950 border-t border-black">
                      <td colSpan={6} className="p-2.5 text-right font-bold uppercase text-[11px] border-r border-black">
                        Totales
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-950 border-r border-black">
                        {formatCOP(subtotal)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-950 border-r border-black">
                        {iva > 0 ? formatCOP(iva) : '$ -'}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-950">
                        {formatCOP(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {quoteItems.length > 0 && (
                <div className="p-3 bg-slate-50 border border-black rounded text-xs flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10.5px] text-slate-900 font-bold uppercase block">
                      VALOR TOTAL EN LETRAS (CON IVA {Math.round((quoteHeader.taxRate || 0.19) * 100)}%):
                    </span>
                    <strong className="text-slate-900 uppercase text-[11.5px] font-bold">
                      {totalWords}
                    </strong>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">TOTAL PROPUESTA:</span>
                    <span className="text-base font-black text-slate-950 font-mono">{formatCOP(total)} COP</span>
                  </div>
                </div>
              )}

              {/* EMBEDDED CONDICIONES Y FIRMAS WHEN TABLE FITS ON SAME SHEET */}
              {canFitConditionsOnSameSheet && (
                <div className="pt-3 border-t border-slate-300 space-y-3.5 text-slate-900 leading-relaxed text-[12.5px]">
                  <div className="font-extrabold text-slate-950 text-sm tracking-wide uppercase mb-2">
                    CONDICIONES COMERCIALES
                  </div>

                  <div>
                    <strong>Forma de pago:</strong> {quoteHeader.paymentTerms || '50% Anticipo y 50% Contra-entrega.'}
                  </div>

                  <div className="text-justify leading-relaxed">
                    <strong>Tiempo de entrega estimado:</strong> {quoteHeader.deliveryTime || '90D'}. El tiempo de entrega será confirmado al momento de suscribir el contrato o recibir el anticipo, teniendo en cuenta la disponibilidad de fábrica de los equipos contados a partir de la aceptación de la propuesta en mención. El tiempo de entrega será prorrogable por mutuo acuerdo entre las partes, o en caso de que se presente alguna eventualidad en la entrega por parte del fabricante.
                  </div>

                  <div>
                    <strong>Capacitación:</strong> {quoteHeader.trainingTerms || 'Un (1) día en la ubicación del equipo. Las fechas de las visitas serán acordadas entre las partes.'}
                  </div>

                  <div className="text-justify leading-relaxed">
                    <strong>Mantenimiento:</strong> {quoteHeader.maintenanceTerms || 'SYD COLOMBIA S.A. realizara un (1) mantenimiento preventivo por parte del Servicio Técnico de Nuestra Empresa por parte de un personal altamente calificado y entrenado, en apoyo de la marca para instalar y dar mantenimiento a esta clase de equipos.'}
                  </div>

                  <div className="space-y-1 pt-0.5">
                    <div>
                      <strong>Garantía:</strong> {quoteHeader.warrantyTerms || 'Doce (12) meses contados a partir de la fecha de instalación del equipo.'}
                    </div>
                    <div>
                      Quedan exceptuados de esta garantía los siguientes casos:
                    </div>
                    <ul className="list-disc list-inside pl-3 space-y-0.5 text-slate-850">
                      <li>Daños generados por la incorrecta operación, manipulación o cuidado de los sistemas.</li>
                      <li>Mal uso o abuso.</li>
                      <li>Omisión al seguir las instrucciones de operación del equipo.</li>
                      <li>Las anormalidades de energía eléctrica, instalación eléctrica inadecuada.</li>
                    </ul>
                  </div>

                  <div className="pt-0.5">
                    <strong>Transporte:</strong> SYD COLOMBIA asume los gastos del envío de los equipos adquiridos adjudicados en la oferta
                  </div>

                  <div>
                    <strong>Validez De La Oferta:</strong> Treinta {quoteHeader.validityDays || 30} días calendario a partir de la fecha de entrega de la oferta
                  </div>

                  <div className="pt-2 text-slate-900">
                    Atentamente,
                  </div>

                  <div className="pt-1">
                    <div className="h-16 flex items-center">
                      <DefaultDocumentSignature className="h-14" />
                    </div>
                    <div className="font-bold text-slate-950 text-xs uppercase tracking-tight mt-1">
                      SUMINISTROS Y DOTACIONES COLOMBIA S.A.
                    </div>
                    <div className="font-bold text-slate-900 text-xs">
                      Dpto. Mercadeo y Ventas
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ==================== HOJA 3: CONDICIONES Y FIRMAS (ONLY IF CANNOT FIT ON HOJA 2) ==================== */}
          {!canFitConditionsOnSameSheet && (
            <div className="bg-white text-slate-900 rounded-sm shadow-xl font-sans relative overflow-hidden min-h-[1050px] flex flex-col justify-between print:shadow-none print:m-0">
              {effectiveLetterheadUrl ? (
                <img
                  src={effectiveLetterheadUrl}
                  alt="Membrete Oficial SyD Colombia"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 select-none print:w-full print:h-full"
                />
              ) : null}
              <div
                className="relative z-10 space-y-4 text-slate-900 leading-relaxed text-[12.5px] flex-1 flex flex-col justify-between"
                style={{
                  paddingTop: `${padTop}px`,
                  paddingLeft: `${padSide}px`,
                  paddingRight: `${padSide}px`,
                  paddingBottom: '60px',
                }}
              >
                <div className="font-extrabold text-slate-950 text-sm tracking-wide uppercase mb-3">
                  CONDICIONES COMERCIALES
                </div>

                <div>
                  <strong>Forma de pago:</strong> {quoteHeader.paymentTerms || '50% Anticipo y 50% Contra-entrega.'}
                </div>

                <div className="text-justify leading-relaxed">
                  <strong>Tiempo de entrega estimado:</strong> {quoteHeader.deliveryTime || '90D'}. El tiempo de entrega será confirmado al momento de suscribir el contrato o recibir el anticipo, teniendo en cuenta la disponibilidad de fábrica de los equipos contados a partir de la aceptación de la propuesta en mención. El tiempo de entrega será prorrogable por mutuo acuerdo entre las partes, o en caso de que se presente alguna eventualidad en la entrega por parte del fabricante.
                </div>

                <div>
                  <strong>Capacitación:</strong> {quoteHeader.trainingTerms || 'Un (1) día en la ubicación del equipo. Las fechas de las visitas serán acordadas entre las partes.'}
                </div>

                <div className="text-justify leading-relaxed">
                  <strong>Mantenimiento:</strong> {quoteHeader.maintenanceTerms || 'SYD COLOMBIA S.A. realizara un (1) mantenimiento preventivo por parte del Servicio Técnico de Nuestra Empresa por parte de un personal altamente calificado y entrenado, en apoyo de la marca para instalar y dar mantenimiento a esta clase de equipos.'}
                </div>

                <div className="space-y-1.5 pt-1">
                  <div>
                    <strong>Garantía:</strong> {quoteHeader.warrantyTerms || 'Doce (12) meses contados a partir de la fecha de instalación del equipo.'}
                  </div>
                  <div>
                    Quedan exceptuados de esta garantía los siguientes casos:
                  </div>
                  <ul className="list-disc list-inside pl-3 space-y-1 text-slate-850">
                    <li>Daños generados por la incorrecta operación, manipulación o cuidado de los sistemas.</li>
                    <li>Mal uso o abuso.</li>
                    <li>Omisión al seguir las instrucciones de operación del equipo.</li>
                    <li>Las anormalidades de energía eléctrica, instalación eléctrica inadecuada.</li>
                  </ul>
                </div>

                <div className="pt-1">
                  <strong>Transporte:</strong> SYD COLOMBIA asume los gastos del envío de los equipos adquiridos adjudicados en la oferta
                </div>

                <div>
                  <strong>Validez De La Oferta:</strong> Treinta {quoteHeader.validityDays || 30} días calendario a partir de la fecha de entrega de la oferta
                </div>

                <div className="pt-3 text-slate-900">
                  Atentamente,
                </div>

                <div className="pt-2">
                  <div className="h-20 flex items-center">
                    <DefaultDocumentSignature className="h-16" />
                  </div>
                  <div className="font-bold text-slate-950 text-xs uppercase tracking-tight mt-1">
                    SUMINISTROS Y DOTACIONES COLOMBIA S.A.
                  </div>
                  <div className="font-bold text-slate-900 text-xs">
                    Dpto. Mercadeo y Ventas
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
