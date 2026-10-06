import React, { useState } from 'react';
import { TruckAppointment, YARD_ZONES } from '../types';
import { cn, isDemurrageRisk, getPunctualityStatus } from '../utils';
import { Clock, MapPin } from 'lucide-react';
import { mockSlots } from '../mockData';

interface ContainerCardProps {
  appointment: TruckAppointment;
  appointments?: TruckAppointment[];
  onCall?: (id: string) => void;
  onGateIn?: (id: string) => void;
  onArrivedAtLine?: (id: string) => void;
  onAssignLocation?: (id: string, entryGate: string, unloadingLocation: string) => void;
  onGateOut?: (id: string) => void;
  onRevertToYard?: (id: string) => void;
  onNoShow?: (id: string) => void;
  avgTurnaround?: number;
}

export const ContainerCard: React.FC<ContainerCardProps> = ({ appointment, appointments = [], onCall, onGateIn, onArrivedAtLine, onAssignLocation, onGateOut, onRevertToYard, onNoShow, avgTurnaround }) => {
  const [entryGate, setEntryGate] = useState(appointment.entryGate || '');
  const [unloadingLocation, setUnloadingLocation] = useState(appointment.unloadingLocation || '');

  const hasDemurrageRisk = isDemurrageRisk(appointment.freeTimeExpiration);

  // Active trucks in selected zone
  const activeTrucksInZone = unloadingLocation ? appointments.filter(a => a.status === 'In Yard' && a.unloadingLocation === unloadingLocation).length : 0;
  const isHighTraffic = activeTrucksInZone > 5;

  // Fake current time for calculation: 10:05
  const getCurrentMinutes = () => 10 * 60 + 5; 

  const getDuration = (gateInTime?: string) => {
    if (!gateInTime) return 34; // default demo elapsed time
    const [hours, minutes] = gateInTime.split(':').map(Number);
    const gateInMins = hours * 60 + minutes;
    const currentMins = getCurrentMinutes();
    return Math.max(12, currentMins - gateInMins);
  };

  const duration = getDuration(appointment.gateInTime);
  const formatElapsed = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `0${h}h${m < 10 ? '0' : ''}${m}`;
  };

  const isOverdue = avgTurnaround ? duration > avgTurnaround : false;
  const inYard = appointment.status === 'In Yard';
  
  const slot = mockSlots.find(s => s.id === appointment.slotId);
  const slotDisplay = slot ? `${slot.startTime} - ${slot.endTime}` : appointment.scheduledTime;
  const punctuality = getPunctualityStatus(slotDisplay);

  const handleSaveLocation = () => {
    if (onAssignLocation && entryGate && unloadingLocation) {
      onAssignLocation(appointment.id, entryGate, unloadingLocation);
    }
  };

  const handleFinishDirectly = () => {
    const finalGate = entryGate || appointment.entryGate || 'Gate 1';
    const finalZone = unloadingLocation || appointment.unloadingLocation || 'Warehouse A';
    if (onAssignLocation) {
      onAssignLocation(appointment.id, finalGate, finalZone);
    }
    if (onGateOut) {
      onGateOut(appointment.id);
    }
  };

  return (
    <div className={cn(
      "bg-white border rounded-lg shadow-sm p-3 flex flex-col gap-2 transition-all hover:shadow-md",
      hasDemurrageRisk ? "animate-pulse border-red-600 border-2 bg-red-50/60" : appointment.isSpecialWindow ? "border-purple-500 border-2" : inYard && isOverdue ? "border-red-300 bg-red-50/30" : "border-slate-200"
    )}>
      {hasDemurrageRisk && (
        <div className="text-[9px] font-black uppercase tracking-widest text-red-700 bg-red-100 border border-red-200 px-2 py-1 rounded text-center shadow-sm flex items-center justify-center gap-1">
          <span>⚠️ DEMURRAGE RISK</span>
          {appointment.freeTimeExpiration && <span className="text-[8px] font-mono">({new Date(appointment.freeTimeExpiration).toLocaleString()})</span>}
        </div>
      )}

      {appointment.isEnRoute && appointment.status === 'Awaiting Call' && (
        <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded text-center shadow-sm animate-pulse flex items-center justify-center gap-1">
          <span>🚚 DRIVER EN ROUTE</span>
        </div>
      )}

      {appointment.status === 'NO SHOW' && (
        <div className="text-[9px] font-black uppercase tracking-widest text-red-700 bg-red-100 border border-red-200 px-2 py-1 rounded text-center shadow-sm flex items-center justify-center gap-1">
          <span>⚠️ NO SHOW / MISSED WINDOW</span>
        </div>
      )}

      {appointment.status !== 'Operated' && appointment.status !== 'NO SHOW' && (
        <div className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded text-center shadow-sm border flex items-center justify-center gap-1",
          punctuality.colorClass
        )}>
          <span>{punctuality.label}</span>
        </div>
      )}

      {appointment.status === 'Operated' && (
        <div className="flex flex-col gap-1">
          <div className="text-[9px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 border border-purple-200 px-2 py-1 rounded text-center shadow-sm">
            ✓ Operation Finished {appointment.gateOutTime && `(${appointment.gateOutTime})`}
          </div>
          {onRevertToYard && (
            <button
              onClick={() => onRevertToYard(appointment.id)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-2 py-1 rounded text-[9px] uppercase font-bold tracking-wider transition-colors shadow-sm cursor-pointer"
            >
              ↩ Return to Active Yard
            </button>
          )}
        </div>
      )}

      {appointment.status === 'Awaiting Call' && !hasDemurrageRisk && (
        <div className="text-[10px] font-mono font-bold text-slate-900 bg-amber-100 text-amber-900 border border-amber-200 px-2 py-1 rounded-md leading-none flex items-center gap-1.5 justify-center shadow-sm">
          <Clock className="w-3 h-3 text-amber-700" />
          SLOT: {slotDisplay}
        </div>
      )}

      {appointment.isSpecialWindow && !hasDemurrageRisk && (
        <div className="text-[9px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 border border-purple-200 px-2 py-1 rounded text-center shadow-sm">
          Special Window Request
        </div>
      )}

      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <div className="text-xs font-black text-slate-900 tracking-tight leading-none">{appointment.containerId}</div>
          {appointment.isBitrem && appointment.containerId2 && (
            <div className="text-xs font-black text-slate-900 tracking-tight leading-none mt-1">{appointment.containerId2}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[9px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded leading-none">
            {appointment.blNumber}
          </span>
          {inYard && (
            <span className="text-[9px] font-mono font-bold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
              <span>⏱️ {formatElapsed(duration)}</span>
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center mt-0.5 gap-2">
        <div className="text-[11px] font-bold text-slate-800 leading-tight font-mono">{appointment.licensePlate}</div>
        <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider text-center flex-1 bg-blue-50 py-1 px-2 rounded shadow-sm border border-blue-100 truncate">
          {appointment.carrier}
        </div>
      </div>

      <div className="text-[10px] text-slate-500 flex justify-between items-center border-t border-slate-100 pt-1.5 mt-0.5">
        <span>Driver: <strong className="text-slate-700">{appointment.driver}</strong></span>
        {appointment.unloadingLocation && (
          <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
            <MapPin className="w-3 h-3 text-blue-600" />
            {appointment.unloadingLocation} {appointment.entryGate && `(${appointment.entryGate})`}
          </span>
        )}
      </div>

      {appointment.status !== 'Awaiting Call' && appointment.status !== 'Operated' && onRevertToYard && (
        <button
          onClick={() => onRevertToYard(appointment.id)}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1 rounded text-[9px] uppercase font-bold tracking-wider transition-colors shadow-sm mt-1 flex items-center justify-center gap-1"
          title="Revert status backward"
        >
          ↩ Revert
        </button>
      )}

      {appointment.status === 'Awaiting Call' && onCall && (
        <button
          onClick={() => onCall(appointment.id)}
          className="mt-1 w-full bg-slate-900 hover:bg-slate-800 text-white px-2 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors"
        >
          Call Truck
        </button>
      )}

      {appointment.status === 'Called/In Transit' && onArrivedAtLine && (
        <div className="mt-1 flex gap-1.5">
          <button
            onClick={() => onArrivedAtLine(appointment.id)}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-2 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors shadow-sm"
          >
            Arrived at Line
          </button>
          {onNoShow && (
            <button
              onClick={() => onNoShow(appointment.id)}
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors shrink-0"
              title="No Show"
            >
              No Show
            </button>
          )}
        </div>
      )}

      {appointment.status === 'Physical Line' && onGateIn && (
        <div className="mt-1 flex gap-1.5">
          <button
            onClick={() => onGateIn(appointment.id)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors shadow-sm"
          >
            Gate-In (Enter Yard)
          </button>
          {onNoShow && (
            <button
              onClick={() => onNoShow(appointment.id)}
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors shrink-0"
              title="No Show"
            >
              No Show
            </button>
          )}
        </div>
      )}

      {inYard && (
        <div className="pt-1 flex flex-col gap-1.5">
          {appointment.entryGate && appointment.unloadingLocation ? (
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200">
              <div>
                <div className="text-[10px] font-bold text-slate-800 uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  {appointment.unloadingLocation}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">{appointment.entryGate}</div>
              </div>
              {onGateOut && (
                <button
                  onClick={() => onGateOut(appointment.id)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors shrink-0 shadow-sm"
                >
                  Finish Operation
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="Gate (e.g. Gate 1)"
                  value={entryGate}
                  onChange={(e) => setEntryGate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-[10px] bg-white focus:outline-none focus:border-blue-500 font-medium"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLocation()}
                />
                <select
                  value={unloadingLocation}
                  onChange={(e) => setUnloadingLocation(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-[10px] bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-700"
                >
                  <option value="">Select Zone...</option>
                  {YARD_ZONES.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              {isHighTraffic && (
                <div className="text-[9px] text-red-700 font-bold bg-red-50 border border-red-200 p-1.5 rounded animate-pulse">
                  ⚠️ High Traffic in {unloadingLocation} ({activeTrucksInZone} active).
                </div>
              )}

              <div className="flex gap-1.5">
                <button
                  onClick={handleSaveLocation}
                  disabled={!entryGate || !unloadingLocation}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign Zone
                </button>
                {onGateOut && (
                  <button
                    onClick={handleFinishDirectly}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-2 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors shadow-sm"
                  >
                    Finish Operation
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
