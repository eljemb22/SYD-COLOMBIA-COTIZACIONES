import React, { useState } from 'react';
import {
  FileText,
  Building2,
  PackageCheck,
  Truck,
  ReceiptText,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { ActiveTab } from '../Navigation';

interface WorkflowPipelineGuideProps {
  currentTab: ActiveTab;
  onNavigateToTab: (tab: ActiveTab) => void;
  compact?: boolean;
}

export const WorkflowPipelineGuide: React.FC<WorkflowPipelineGuideProps> = ({
  currentTab,
  onNavigateToTab,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Determine strictly ONE active step based on the current tab
  const activeStepNum = (() => {
    switch (currentTab) {
      case 'ventas':
      case 'historial':
        return 1;
      case 'licitaciones':
        return 2;
      case 'seguimiento_oc':
        return 3;
      case 'gmail_compras':
        return 4;
      case 'ordenes_venta':
        return 5;
      default:
        return null;
    }
  })();

  const steps = [
    {
      num: 1,
      id: 'step-quote',
      tab: 'ventas' as ActiveTab,
      title: '1. Cotización',
      subtitle: 'Propuesta comercial con equipos, accesorios y márgenes',
      icon: FileText,
      color: 'sky',
      activeBorder: 'border-[var(--syd-accent)]',
      activeBg: 'bg-[var(--syd-accent-light)]/20',
      activeText: 'text-[var(--syd-accent)]',
    },
    {
      num: 2,
      id: 'step-contract',
      tab: 'licitaciones' as ActiveTab,
      altTab: 'ordenes_venta' as ActiveTab,
      title: '2. Licitación u OV',
      subtitle: 'Pliegos de condiciones, specs o formalización en Orden de Venta',
      icon: Building2,
      color: 'purple',
      activeBorder: 'border-purple-400',
      activeBg: 'bg-purple-600/20',
      activeText: 'text-purple-300',
    },
    {
      num: 3,
      id: 'step-oc',
      tab: 'seguimiento_oc' as ActiveTab,
      title: '3. OC a Proveedores',
      subtitle: 'Generación de Órdenes de Compra por cada producto a su fabricante',
      icon: PackageCheck,
      color: 'amber',
      activeBorder: 'border-amber-400',
      activeBg: 'bg-amber-500/20',
      activeText: 'text-amber-300',
    },
    {
      num: 4,
      id: 'step-tracking',
      tab: 'seguimiento_oc' as ActiveTab,
      title: '4. Seguimiento & Entregas',
      subtitle: 'Fabricación, despacho, aduanas, seriales y entrega en hospital',
      icon: Truck,
      color: 'indigo',
      activeBorder: 'border-indigo-400',
      activeBg: 'bg-indigo-600/20',
      activeText: 'text-indigo-300',
    },
    {
      num: 5,
      id: 'step-invoicing',
      tab: 'ordenes_venta' as ActiveTab,
      title: '5. Facturación al Cliente',
      subtitle: 'Emisión de Factura Electrónica y radicación con soporte PDF',
      icon: ReceiptText,
      color: 'emerald',
      activeBorder: 'border-emerald-400',
      activeBg: 'bg-emerald-500/20',
      activeText: 'text-emerald-300',
    },
  ];

  return (
    <div className="bg-[#14233a] border border-[#2b4466] rounded-2xl p-3.5 sm:p-4 shadow-xl mb-4">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#2b4466]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-[var(--syd-accent-light)]/30 to-purple-600/30 text-[var(--syd-accent)] border border-[var(--syd-accent)]/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
              <span>Flujo Operativo &amp; Comercial SYD Colombia</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Proceso Continuo Integrado
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Cotización ➜ Conversión a Licitación / OV ➜ Generación Automática de OC por Producto ➜ Seguimiento ➜ Facturación
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-[#192b45] border border-[#334d6e] transition cursor-pointer"
        >
          {isExpanded ? 'Ocultar Guía' : 'Ver Guía del Proceso'}
        </button>
      </div>

      {isExpanded && (
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            // Only mark strictly one step as active at a time
            const isCurrent = activeStepNum !== null && step.num === activeStepNum;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onNavigateToTab(step.tab)}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                  isCurrent
                    ? `${step.activeBg} ${step.activeBorder} shadow-lg shadow-[var(--syd-accent-light)]/10 scale-[1.02]`
                    : 'bg-[#182a44]/60 border-[#2b4466] hover:bg-[#1f3554] hover:border-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded-md ${
                        isCurrent
                          ? 'bg-slate-950 text-white border border-white/20'
                          : 'bg-[#111e30] text-slate-400'
                      }`}
                    >
                      Paso {step.num}
                    </span>
                    <Icon
                      className={`w-4 h-4 ${
                        isCurrent ? step.activeText : 'text-slate-400 group-hover:text-white'
                      }`}
                    />
                  </div>

                  <h4
                    className={`text-xs font-bold ${
                      isCurrent ? 'text-white' : 'text-slate-200 group-hover:text-white'
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                    {step.subtitle}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#2b4466]/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="group-hover:text-[var(--syd-accent)] font-semibold transition">
                    Ir al módulo
                  </span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
