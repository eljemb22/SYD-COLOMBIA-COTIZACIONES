import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  Minimize2,
  X,
  BellOff,
  Clock,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import {
  getWarrantyAlerts,
  getCriticalWarrantyAlerts,
  getUpcomingWarrantyAlerts,
  dismissWarrantyAlert,
} from '../../utils/warrantyAlerts';
import { WarrantyAlert } from '../../types';

export interface WarrantyAlertsWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WarrantyAlertsWidget: React.FC<WarrantyAlertsWidgetProps> = ({
  isOpen,
  onClose,
}) => {
  const [alerts, setAlerts] = useState<WarrantyAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'upcoming'>('all');

  useEffect(() => {
    setAlerts(getWarrantyAlerts());
  }, []);

  const criticalAlerts = getCriticalWarrantyAlerts();
  const upcomingAlerts = getUpcomingWarrantyAlerts();

  const filteredAlerts = useMemo(() => {
    if (filter === 'critical') return criticalAlerts;
    if (filter === 'upcoming') return upcomingAlerts;
    return alerts;
  }, [alerts, criticalAlerts, upcomingAlerts, filter]);

  const refreshAlerts = () => {
    setAlerts(getWarrantyAlerts());
  };

  const dismissAlert = (id: string) => {
    dismissWarrantyAlert(id);
    setAlerts(getWarrantyAlerts());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1a2e] border border-[#334d6e] rounded-2xl shadow-2xl w-[95%] sm:w-[90%] max-w-[1000px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-[#132238] border-b border-[#243b5a] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <span className="text-lg font-bold text-white">Centro de Alertas de Garantía</span>
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
          <div className="flex gap-3">
            <div className="flex-1 bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase font-bold">Total Alertas</div>
              <div className="text-2xl font-bold text-white">{alerts.length}</div>
            </div>
            <div className="flex-1 bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase font-bold">Críticas (≤30 días)</div>
              <div className={`text-2xl font-bold ${criticalAlerts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {criticalAlerts.length}
              </div>
            </div>
            <div className="flex-1 bg-[#15243b] border border-[#2d4972] rounded-xl p-4">
              <div className="text-xs text-slate-500 uppercase font-bold">Próximas (31-90 días)</div>
              <div className="text-2xl font-bold text-amber-400">{upcomingAlerts.length}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === 'all' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-[#15243b] text-slate-400 border border-transparent hover:text-slate-200'}`}
            >
              Todas ({alerts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('critical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-[#15243b] text-slate-400 border border-transparent hover:text-slate-200'}`}
            >
              Críticas ({criticalAlerts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === 'upcoming' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-[#15243b] text-slate-400 border border-transparent hover:text-slate-200'}`}
            >
              Próximas ({upcomingAlerts.length})
            </button>
            <button
              type="button"
              onClick={refreshAlerts}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 bg-[#15243b] border border-[#2d4972] hover:text-white hover:border-[var(--syd-accent)] transition"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar
            </button>
          </div>

          <div className="bg-[#15243b] border border-[#2d4972] rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111c2e] text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="px-4 py-3 font-bold">Equipo</th>
                  <th className="px-4 py-3 font-bold">Marca</th>
                  <th className="px-4 py-3 font-bold text-center">Modelo</th>
                  <th className="px-4 py-3 font-bold text-center">Serial</th>
                  <th className="px-4 py-3 font-bold text-center">Cliente</th>
                  <th className="px-4 py-3 font-bold text-center">Vencimiento</th>
                  <th className="px-4 py-3 font-bold text-center">Días</th>
                  <th className="px-4 py-3 font-bold text-center">Estado</th>
                  <th className="px-4 py-3 font-bold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="text-slate-300 divide-y divide-[#2d4972]">
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No hay alertas de garantía pendientes.
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-[#1e314b]/50 transition">
                      <td className="px-4 py-3 font-medium text-white">{alert.equipmentName}</td>
                      <td className="px-4 py-3 text-slate-400">{alert.brand}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{alert.model}</td>
                      <td className="px-4 py-3 text-center text-slate-400">{alert.serialNumber || 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-400">{alert.clientName}</td>
                      <td className="px-4 py-3 text-center text-slate-300 text-[10px]">{alert.warrantyEndDate}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${alert.severity === 'critica' ? 'bg-rose-500/20 text-rose-400' : alert.severity === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {alert.daysRemaining} días
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${alert.severity === 'critica' ? 'text-rose-400' : alert.severity === 'media' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => dismissAlert(alert.id)}
                          className="px-2 py-1 text-xs text-slate-400 hover:text-white bg-[#1e314b] rounded hover:bg-[#243b5a] transition"
                          title="Descartar alerta"
                        >
                          Descartar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};