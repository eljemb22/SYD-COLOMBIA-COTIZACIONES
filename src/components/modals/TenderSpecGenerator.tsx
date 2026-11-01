import React, { useState } from 'react';
import {
  Minimize2,
  X,
  FileText,
  Sparkles,
  Copy,
  File,
  Printer,
} from 'lucide-react';

export interface TenderSpecGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TenderSpecGenerator: React.FC<TenderSpecGeneratorProps> = ({
  isOpen,
  onClose,
}) => {
  const [tenderNumber, setTenderNumber] = useState('');
  const [entityName, setEntityName] = useState('');
  const [processType, setProcessType] = useState('Licitación Pública');
  const [items, setItems] = useState<Array<{
    id: string;
    itemNumber: number;
    name: string;
    brand: string;
    model: string;
    quantity: number;
    technicalDescription: string;
    keyFeatures: string[];
    complianceRequirements: string[];
  }>>([]);
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const addItem = () => {
    setItems([...items, {
      id: `item-${Date.now()}`,
      itemNumber: items.length + 1,
      name: '',
      brand: '',
      model: '',
      quantity: 1,
      technicalDescription: '',
      keyFeatures: [],
      complianceRequirements: [],
    }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const generateSpec = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const text = generatePliegoText();
      setGeneratedText(text);
      setIsGenerating(false);
    }, 500);
  };

  const generatePliegoText = () => {
    const lines: string[] = [];

    lines.push('PLIEGO TÉCNICO DE CONDICIONES');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`ENTIDAD: ${entityName}`);
    lines.push(`PROCESO: ${processType}`);
    lines.push(`NÚMERO: ${tenderNumber}`);
    lines.push(`FECHA: ${new Date().toLocaleDateString('es-CO')}`);
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('1. OBJETO');
    lines.push('');
    lines.push(`Adquisición de equipos biomédicos y hospitalarios para ${entityName},`);
    lines.push('conforme a los requisitos técnicos especificados a continuación.');
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('2. ESPECIFICACIONES TÉCNICAS POR EQUIPO');
    lines.push('');

    items.forEach((item) => {
      lines.push(`2.${item.itemNumber} ${item.name.toUpperCase()}`);
      lines.push(`   Marca: ${item.brand}`);
      lines.push(`   Modelo: ${item.model}`);
      lines.push(`   Cantidad: ${item.quantity}`);
      if (item.technicalDescription) {
        lines.push(`   Descripción: ${item.technicalDescription}`);
      }
      if (item.keyFeatures.length > 0) {
        lines.push('   Características principales:');
        item.keyFeatures.forEach((f) => lines.push(`     - ${f}`));
      }
      if (item.complianceRequirements.length > 0) {
        lines.push('   Requisitos de cumplimiento:');
        item.complianceRequirements.forEach((r) => lines.push(`     - ${r}`));
      }
      lines.push('');
    });

    lines.push('='.repeat(60));
    lines.push('3. CRITERIOS DE EVALUACIÓN');
    lines.push('');
    lines.push('Las ofertas serán evaluadas conforme a:');
    lines.push('   a) Cumplimiento de especificaciones técnicas');
    lines.push('   b) Precio unitario ofrecido');
    lines.push('   c) Tiempo de entrega');
    lines.push('   d) Garantía y servicio post-venta');
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('4. GARANTÍA');
    lines.push('');
    lines.push('   Los equipos deberán contar con garantía mínima de doce (12) meses,');
    lines.push('   contados a partir de la fecha de instalación y puesta en servicio.');
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('5. FORMATO DE OFERTA');
    lines.push('');
    lines.push('   Los proponentes deberán presentar su oferta en sobre cerrado,');
    lines.push('   especificando claramente:');
    lines.push('   a) Nombre y modelo del equipo ofertado');
    lines.push('   b) Precio unitario y total');
    lines.push('   c) Tiempo de entrega');
    lines.push('   d) Términos de garantía');
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('FIRMADO: _________________________________');
    lines.push('   Comité de Adquisiciones');
    lines.push(`   ${entityName}`);
    lines.push(`   Fecha: ${new Date().toLocaleDateString('es-CO')}`);

    return lines.join('\n');
  };

  const copyText = () => {
    navigator.clipboard.writeText(generatedText);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1a2e] border border-[#334d6e] rounded-2xl shadow-2xl w-[95%] sm:w-[95%] max-w-[1400px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-[#132238] border-b border-[#243b5a] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold text-white">Generador de Pliegos Técnicos</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#1e314b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Izquierda: Formulario */}
          <div className="w-1/3 border-r border-[#2d4972] p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Número de Proceso</label>
                <input
                  type="text"
                  value={tenderNumber}
                  onChange={(e) => setTenderNumber(e.target.value)}
                  placeholder="Ej: SECOP-II-2026-001"
                  className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Entidad</label>
                <input
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder="Hospital, clínica o institución"
                  className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Tipo de Proceso</label>
                <select
                  value={processType}
                  onChange={(e) => setProcessType(e.target.value)}
                  className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                >
                  <option value="Licitación Pública">Licitación Pública</option>
                  <option value="Licitación Pública Abierta">Licitación Pública Abierta</option>
                  <option value="Convocatoria Abierta">Convocatoria Abierta</option>
                  <option value="Concurso Público">Concurso Público</option>
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                <File className="w-3 h-3" />
                Ítems del Pliego
              </h4>
              {items.map((item) => (
                <div key={item.id} className="p-3 bg-[#15243b] border border-[#2d4972] rounded-lg space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cyan-400">Ítem {item.itemNumber}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-rose-400 hover:text-white rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Nombre del equipo"
                    value={item.name}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems.find((i) => i.id === item.id)!.name = e.target.value;
                      setItems(newItems);
                    }}
                    className="w-full bg-[#14233a] border border-[#2d4972] rounded px-2 py-1 text-sm text-white focus:border-[#38bdf8] outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Marca"
                      value={item.brand}
                      onChange={(e) => {
                        const ni = [...items];
                        ni.find((i) => i.id === item.id)!.brand = e.target.value;
                        setItems(ni);
                      }}
                      className="w-1/3 bg-[#14233a] border border-[#2d4972] rounded px-2 py-1 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Modelo"
                      value={item.model}
                      onChange={(e) => {
                        const ni = [...items];
                        ni.find((i) => i.id === item.id)!.model = e.target.value;
                        setItems(ni);
                      }}
                      className="w-1/3 bg-[#14233a] border border-[#2d4972] rounded px-2 py-1 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Cant."
                      value={item.quantity}
                      onChange={(e) => {
                        const ni = [...items];
                        ni.find((i) => i.id === item.id)!.quantity = parseInt(e.target.value) || 1;
                        setItems(ni);
                      }}
                      className="w-1/3 bg-[#14233a] border border-[#2d4972] rounded px-2 py-1 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                  </div>
                  <div className="mt-2">
                    <label className="text-[10px] text-slate-500 uppercase block mb-1">Descripción Técnica</label>
                    <textarea
                      value={item.technicalDescription}
                      onChange={(e) => {
                        const ni = [...items];
                        ni.find((i) => i.id === item.id)!.technicalDescription = e.target.value;
                        setItems(ni);
                      }}
                      rows={2}
                      className="w-full bg-[#14233a] border border-[#2d4972] rounded px-2 py-1 text-xs text-white focus:border-[#38bdf8] outline-none"
                      placeholder="Especificaciones técnicas principales..."
                    ></textarea>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 block mb-1">Características Clave (separadas por coma)</label>
                      <input
                        type="text"
                        placeholder="Ej: Pantalla LCD, Batería recargable"
                        className="w-full bg-[#14233a] border border-[#2d4972] rounded px-2 py-1 text-xs text-white focus:border-[#38bdf8] outline-none"
                        onChange={(e) => {
                          const ni = [...items];
                          ni.find((i) => i.id === item.id)!.keyFeatures = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setItems(ni);
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 block mb-1">Requisitos de Cumplimiento</label>
                      <input
                        type="text"
                        placeholder="Ej: Registro INVIMA vigente"
                        className="w-full bg-[#14233a] border border-[#2d4972] rounded px-2 py-1 text-xs text-white focus:border-[#38bdf8] outline-none"
                        onChange={(e) => {
                          const ni = [...items];
                          ni.find((i) => i.id === item.id)!.complianceRequirements = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setItems(ni);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="w-full py-2 text-sm font-bold text-cyan-400 bg-cyan-500/10 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 mr-1" /> Agregar Ítem
              </button>
            </div>
          </div>

          {/* Derecha: Resultado */}
          <div className="w-2/3 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Pliego Técnico Generado</h3>
              <div className="flex gap-2">
                {generatedText ? (
                  <>
                    <button
                      type="button"
                      onClick={copyText}
                      className="px-3 py-2 text-sm font-bold text-cyan-400 bg-cyan-500/10 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 transition cursor-pointer"
                    >
                      <Copy className="w-4 h-4 mr-1" /> Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([generatedText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `pliego-tecnico-${tenderNumber || 'pliego'}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-2 text-sm font-bold text-white bg-linear-to-r from-cyan-400 to-blue-600 rounded-lg shadow shadow-cyan-500/20 hover:from-cyan-300 hover:to-blue-500 transition cursor-pointer"
                    >
                      <File className="w-4 h-4 mr-1" /> Descargar .txt
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={generateSpec}
                    disabled={items.length === 0 || !entityName || !tenderNumber}
                    className="px-4 py-2 text-sm font-bold text-white bg-linear-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow shadow-cyan-500/20"
                  >
                    {isGenerating ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generando...</span>
                      </div>
                    ) : (
                      <span>Generar Pliego Técnico</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {generatedText ? (
              <div className="bg-[#0f1a2e] border border-[#2d4972] rounded-xl p-5 font-mono text-xs text-slate-300 overflow-y-auto max-h-[400px]">
                {generatedText.split('\n').map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <FileText className="w-12 h-12 opacity-20" />
                <p className="mt-2">Configure los datos del pliego a la izquierda y haga clic en "Generar Pliego Técnico"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { Loader2 } from 'lucide-react';