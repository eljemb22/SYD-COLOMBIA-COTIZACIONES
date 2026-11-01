import React, { useState, useMemo } from 'react';
import {
  Minimize2,
  X,
  TrendingUp,
  DollarSign,
  Calculator,
  BarChart3,
  FileText,
  Copy,
} from 'lucide-react';
import { BotChatMessage, BotActionOption } from '../types';
import { getPriceStatsForEquipment } from '../../utils/priceHistory';

export interface ProfitabilityCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  quoteData?: {
    quoteNumber: string;
    clientName: string;
    items: Array<{
      name: string;
      brand: string;
      model: string;
      quantity: number;
      unitCostCOP: number;
      unitSalePrice: number;
    }>;
    subtotal: number;
    total: number;
  };
}

export const ProfitabilityCalculator: React.FC<ProfitabilityCalculatorProps> = ({
  isOpen,
  onClose,
  quoteData,
}) => {
  const [manualItems, setManualItems] = useState<Array<{
    id: string;
    name: string;
    brand: string;
    model: string;
    quantity: number;
    unitCostCOP: number;
    unitSalePriceCOP: number;
  }>>([]);

  const items = useMemo(() => {
    if (quoteData?.items?.length) {
      return quoteData.items.map((it, idx) => ({
        id: `q-${idx}`,
        name: it.name,
        brand: it.brand,
        model: it.model,
        quantity: it.quantity,
        unitCostCOP: it.unitCostCOP,
        unitSalePriceCOP: it.unitSalePrice,
      }));
    }
    return manualItems;
  }, [quoteData, manualItems]);

  const summary = useMemo(() => {
    if (!items.length) return null;

    const totalCost = items.reduce((acc, i) => acc + i.unitCostCOP * i.quantity, 0);
    const totalSale = items.reduce((acc, i) => acc + i.unitSalePriceCOP * i.quantity, 0);
    const totalProfit = totalSale - totalCost;
    const marginPercent = totalSale > 0 ? Math.round((totalProfit / totalSale) * 100) : 0;

    const itemDetails = items.map((i) => {
      const totalCost = i.unitCostCOP * i.quantity;
      const totalSale = i.unitSalePriceCOP * i.quantity;
      const profit = totalSale - totalCost;
      const margin = totalSale > 0 ? Math.round((profit / totalSale) * 100) : 0;

      return {
        name: i.name,
        brand: i.brand,
        model: i.model,
        quantity: i.quantity,
        unitCostCOP: i.unitCostCOP,
        unitSalePriceCOP: i.unitSalePriceCOP,
        totalCostCOP: totalCost,
        totalSalePriceCOP: totalSale,
        profitCOP: profit,
        marginPercent: margin,
      };
    });

    return {
      quoteNumber: quoteData?.quoteNumber || 'Manual',
      clientName: quoteData?.clientName || 'Manual',
      totalCostCOP: totalCost,
      totalSalePriceCOP: totalSale,
      totalProfitCOP: totalProfit,
      marginPercent: marginPercent,
      items: itemDetails,
    };
  }, [items, quoteData]);

  const addItem = () => {
    const newItem: typeof manualItems[0] = {
      id: `m-${Date.now()}`,
      name: '',
      brand: '',
      model: '',
      quantity: 1,
      unitCostCOP: 0,
      unitSalePriceCOP: 0,
    };
    setManualItems([...manualItems, newItem]);
  };

  const removeItem = (id: string) => {
    setManualItems(manualItems.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof typeof manualItems[0], value: string | number) => {
    setManualItems(
      manualItems.map((i) =>
        i.id === id ? { ...i, [field]: value } : i
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1a2e] border border-[#334d6e] rounded-2xl shadow-2xl w-[95%] sm:w-[90%] max-w-[1200px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-[#132238] border-b border-[#243b5a] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold text-white">Calculadora de Rentabilidad</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#1e314b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Resumen */}
          {summary && (
            <div className="bg-gradient-to-r from-[#0f1a2e] to-[#15243b] border border-[#334d6e] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Resumen Financiero</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#15243b] p-4 rounded-xl">
                  <div className="text-xs text-slate-500 uppercase font-bold">Costo Total</div>
                  <div className="text-2xl font-bold text-white">${summary.totalCostCOP.toLocaleString()}</div>
                </div>
                <div className="bg-[#15243b] p-4 rounded-xl">
                  <div className="text-xs text-slate-500 uppercase font-bold">Precio de Venta</div>
                  <div className="text-2xl font-bold text-white">${summary.totalSalePriceCOP.toLocaleString()}</div>
                </div>
                <div className="bg-[#15243b] p-4 rounded-xl">
                  <div className="text-xs text-slate-500 uppercase font-bold">Utilidad Neta</div>
                  <div className={`text-2xl font-bold ${summary.totalProfitCOP >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${summary.totalProfitCOP.toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#15243b] p-4 rounded-xl">
                  <div className="text-xs text-slate-500 uppercase font-bold">Margen de Utilidad</div>
                  <div className={`text-2xl font-bold ${summary.marginPercent >= 30 ? 'text-emerald-400' : summary.marginPercent >= 20 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {summary.marginPercent}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de items */}
          <div className="bg-[#15243b] border border-[#334d6e] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#2d4972] flex items-center justify-between bg-[#111c2e]">
              <span className="text-xs font-bold text-slate-400 uppercase">Detalle de Equipos</span>
              {quoteData ? null : (
                <button
                  type="button"
                  onClick={addItem}
                  className="px-3 py-2 text-sm font-bold text-cyan-400 hover:text-white bg-cyan-500/10 rounded-lg transition"
                >
                  <PlusCircle className="w-4 h-4 mr-1" />
                  Agregar Equipo
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111c2e] text-slate-400 text-[10px] uppercase">
                  <tr>
                    <th className="px-4 py-3 font-bold">Equipo</th>
                    <th className="px-4 py-3 font-bold text-center">Cant.</th>
                    <th className="px-4 py-3 font-bold text-right">Costo Unit.</th>
                    <th className="px-4 py-3 font-bold text-right">Precio Venta</th>
                    <th className="px-4 py-3 font-bold text-right">Costo Total</th>
                    <th className="px-4 py-3 font-bold text-right">Venta Total</th>
                    <th className="px-4 py-3 font-bold text-center">Utilidad</th>
                    <th className="px-4 py-3 font-bold text-center">Margen</th>
                    <th className="px-4 py-3 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d4972]">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-6 text-center text-slate-500">
                        No hay equipos agregados.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const totalCost = item.unitCostCOP * item.quantity;
                      const totalSale = item.unitSalePriceCOP * item.quantity;
                      const profit = totalSale - totalCost;
                      const margin = totalSale > 0 ? Math.round((profit / totalSale) * 100) : 0;

                      return (
                        <tr key={item.id} className="hover:bg-[#1e314b]/30 transition">
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{item.name}</div>
                            <div className="text-[10px] text-slate-500">{item.brand} {item.model}</div>
                          </td>
                          <td className="px-4 py-3 text-center text-white">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-white">${item.unitCostCOP.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-white">${item.unitSalePriceCOP.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-white">${totalCost.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-white">${totalSale.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                            >
                              ${profit.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                margin >= 30
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : margin >= 20
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-slate-500/20 text-slate-400'
                              }`}
                            >
                              {margin}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-1.5 text-rose-400 hover:text-white hover:bg-[#1e314b] rounded transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Controles de item manual */}
            {!quoteData && (
              <div className="p-4 border-t border-[#2d4972] bg-[#111c2e]/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre</label>
                    <input
                      type="text"
                      placeholder="Nombre del equipo"
                      className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Marca</label>
                    <input
                      type="text"
                      placeholder="Marca"
                      className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Modelo</label>
                    <input
                      type="text"
                      placeholder="Modelo"
                      className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value="1"
                      className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Costo Unit.</label>
                    <input
                      type="number"
                      min="0"
                      value="0"
                      className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Precio Venta</label>
                    <input
                      type="number"
                      min="0"
                      value="0"
                      className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[#38bdf8] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { PlusCircle, Trash2 } from 'lucide-react';