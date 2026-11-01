import React, { useState } from 'react';
import {
  BarChart3,
  CheckCheck,
  Calculator,
  FileText,
  Bell,
  Clock,
  ShieldAlert,
  RefreshCw,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { PriceHistoryModal } from '../modals/PriceHistoryModal';
import { DigitalSignatureModal } from '../modals/DigitalSignatureModal';
import { ProfitabilityCalculator } from '../modals/ProfitabilityCalculator';
import { TenderSpecGenerator } from '../modals/TenderSpecGenerator';
import { WarrantyAlertsWidget } from '../modals/WarrantyAlertsWidget';
import { getPriceHistory } from '../../utils/priceHistory';
import { getWarrantyAlerts } from '../../utils/warrantyAlerts';
import { getCriticalWarrantyAlerts } from '../../utils/warrantyAlerts';

export const AdvancedToolsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profitability' | 'price-history' | 'tender-spec' | 'signature' | 'warranty-alerts'>('profitability');
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [calculatorModalOpen, setCalculatorModalOpen] = useState(false);
  const [tenderModalOpen, setTenderModalOpen] = useState(false);
  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false);

  const priceHistory = getPriceHistory();
  const warrantyAlerts = getWarrantyAlerts();
  const criticalAlerts = getCriticalWarrantyAlerts();

  const tabs = [
    { id: 'profitability' as const, label: 'Rentabilidad por Proyecto', icon: Calculator },
    { id: 'price-history' as const, label: 'Historial de Precios', icon: Clock },
    { id: 'tender-spec' as const, label: 'Pliegos Técnicos', icon: FileText },
    { id: 'signature' as const, label: 'Firma Digital', icon: CheckCheck },
    { id: 'warranty-alerts' as const, label: 'Alertas de Garantía', icon: Bell },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#0f1a2e] border-b border-[#2d4972] p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Centro de Gestión Avanzada</h1>
          <p className="text-sm text-slate-400 mt-1">Herramientas de análisis, firma y gestión técnica para SYD Colombia</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPriceModalOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition cursor-pointer"
          >
            <Clock className="w-4 h-4 mr-1" /> Historial de Precios
          </button>
          <button
            type="button"
            onClick={() => setWarrantyModalOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition cursor-pointer"
          >
            <Bell className="w-4 h-4 mr-1" /> Alertas ({criticalAlerts.length})
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#2d4972] bg-[#0f1a2e]/50 sticky top-0 z-10">
        <div className="flex overflow-x-auto px-6 py-2 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition ${activeTab === tab.id
                ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#15243b]/50'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'profitability' && (
          <div className="bg-[#15243b] border border-[#334d6e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Calculadora de Rentabilidad</h2>
                <p className="text-sm text-slate-400 mt-1">Calcule márgenes y rentabilidad por proyecto o cotización</p>
              </div>
              <button
                type="button"
                onClick={() => setCalculatorModalOpen(true)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-linear-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 transition shadow shadow-cyan-500/20"
              >
                <Calculator className="w-4 h-4 mr-1" /> Abrir Calculadora
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase font-bold">Cotizaciones Analizadas</div>
                <div className="text-3xl font-bold text-white mt-2">0</div>
              </div>
              <div className="bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase font-bold">Margen Promedio</div>
                <div className="text-3xl font-bold text-emerald-400 mt-2">0%</div>
              </div>
              <div className="bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase font-bold">Utilidad Total</div>
                <div className="text-3xl font-bold text-white mt-2">$0</div>
              </div>
            </div>
            <div className="mt-6 bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
              <p className="text-sm text-slate-400">Abra la calculadora para analizar la rentabilidad de sus cotizaciones y proyectos.</p>
            </div>
          </div>
        )}

        {activeTab === 'price-history' && (
          <div className="bg-[#15243b] border border-[#334d6e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Historial de Precios</h2>
                <p className="text-sm text-slate-400 mt-1">Consulte el historial de precios de equipos médicos por nombre, marca y modelo</p>
              </div>
              <button
                type="button"
                onClick={() => setPriceModalOpen(true)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-linear-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 transition shadow shadow-cyan-500/20"
              >
                <BarChart3 className="w-4 h-4 mr-1" /> Ver Historial Completo
              </button>
            </div>
            <div className="bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
              <div className="text-sm text-slate-400">
                Total de registros de precios: <span className="text-white font-bold">{priceHistory.length}</span>
              </div>
              <div className="mt-3 text-sm text-slate-400">
                Abra el historial para ver el seguimiento de precios de todos sus equipos registrados.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tender-spec' && (
          <div className="bg-[#15243b] border border-[#334d6e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Generador de Pliegos Técnicos</h2>
                <p className="text-sm text-slate-400 mt-1">Genere pliegos técnicos para licitaciones SECOP II</p>
              </div>
              <button
                type="button"
                onClick={() => setTenderModalOpen(true)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-linear-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 transition shadow shadow-cyan-500/20"
              >
                <FileText className="w-4 h-4 mr-1" /> Generar Pliego
              </button>
            </div>
            <div className="bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
              <p className="text-sm text-slate-400">Cree pliegos técnicos profesionales para licitaciones hospitalarias basados en los equipos cotizados.</p>
            </div>
          </div>
        )}

        {activeTab === 'signature' && (
          <div className="bg-[#15243b] border border-[#334d6e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Firma Digital</h2>
                <p className="text-sm text-slate-400 mt-1">Firme digitalmente sus cotizaciones y documentos</p>
              </div>
              <button
                type="button"
                onClick={() => setSignatureModalOpen(true)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-linear-to-r from-emerald-400 to-green-600 hover:from-emerald-300 hover:to-green-500 transition shadow shadow-emerald-500/20"
              >
                <CheckCheck className="w-4 h-4 mr-1" /> Firmar Documento
              </button>
            </div>
            <div className="bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
              <p className="text-sm text-slate-400">Utilice la firma digital para validar cotizaciones y documentos oficiales.</p>
            </div>
          </div>
        )}

        {activeTab === 'warranty-alerts' && (
          <div className="bg-[#15243b] border border-[#334d6e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Alertas de Garantía</h2>
                <p className="text-sm text-slate-400 mt-1">Monitoree equipos con garantía próxima a vencer</p>
              </div>
              <button
                type="button"
                onClick={() => setWarrantyModalOpen(true)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-linear-to-r from-rose-400 to-rose-600 hover:from-rose-300 hover:to-rose-500 transition shadow shadow-rose-500/20"
              >
                <Bell className="w-4 h-4 mr-1" /> Ver Todas las Alertas
              </button>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase font-bold">Alertas Críticas</div>
                <div className={`text-3xl font-bold ${criticalAlerts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{criticalAlerts.length}</div>
                <p className="text-xs text-slate-400 mt-2">Equipos con garantía próxima a vencer (≤30 días)</p>
              </div>
              <div className="flex-1 bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase font-bold">Total Registradas</div>
                <div className="text-3xl font-bold text-white">{warrantyAlerts.length}</div>
                <p className="text-xs text-slate-400 mt-2">Equipos con fecha de garantía registrada</p>
              </div>
            </div>
            {criticalAlerts.length > 0 && (
              <div className="mt-6 bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
                <h3 className="text-sm font-bold text-rose-400 uppercase mb-3">Atención Inmediata</h3>
                <div className="space-y-2">
                  {criticalAlerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-center gap-3 p-3 bg-[#1e314b] rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{alert.equipmentName}</div>
                        <div className="text-[10px] text-slate-400">{alert.brand} {alert.model}</div>
                        <div className="text-[10px] text-slate-500 mt-1">Vence: {alert.warrantyEndDate} ({alert.daysRemaining} días)</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <PriceHistoryModal isOpen={priceModalOpen} onClose={() => setPriceModalOpen(false)} />
      <DigitalSignatureModal isOpen={signatureModalOpen} onClose={() => setSignatureModalOpen(false)} onSave={() => setSignatureModalOpen(false)} />
      <ProfitabilityCalculator isOpen={calculatorModalOpen} onClose={() => setCalculatorModalOpen(false)} />
      <TenderSpecGenerator isOpen={tenderModalOpen} onClose={() => setTenderModalOpen(false)} />
      <WarrantyAlertsWidget isOpen={warrantyModalOpen} onClose={() => setWarrantyModalOpen(false)} />
    </div>
  );
};

import { LayoutGrid } from 'lucide-react';