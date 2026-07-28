import React, { useState } from 'react';
import { TruckAppointment } from '../types';
import { cn } from '../utils';
import { Clock } from 'lucide-react';
import { mockSlots } from '../mockData';

interface ContainerCardProps {
  appointment: TruckAppointment;
  onCall?: (id: string) => void;
  onGateIn?: (id: string) => void;
  onAssignLocation?: (id: string, entryGate: string, unloadingLocation: string) => void;
  onGateOut?: (id: string) => void;
  onNoShow?: (id: string) => void;
  avgTurnaround?: number;
}

export const ContainerCard: React.FC<ContainerCardProps> = ({ appointment, onCall, onGateIn, onAssignLocation, onGateOut, onNoShow, avgTurnaround }) => {
  const [entryGate, setEntryGate] = useState(appointment.entryGate || '');
  const [unloadingLocation, setUnloadingLocation] = useState(appointment.unloadingLocation || '');

  // Fake current time for calculation: 10:05
  const getCurrentMinutes = () => 10 * 60 + 5; 

  const getDuration = (gateInTime?: string) => {
    if (!gateInTime) return 0;
    const [hours, minutes] = gateInTime.split(':').map(Number);
    const gateInMins = hours * 60 + minutes;
    const currentMins = getCurrentMinutes();
    return Math.max(0, currentMins - gateInMins);
  };

  const duration = getDuration(appointment.gateInTime);
  const isOverdue = avgTurnaround ? duration > avgTurnaround : false;
  const inYard = appointment.status === 'In Yard';
  
  const slot = mockSlots.find(s => s.id === appointment.slotId);
  const slotDisplay = slot ? `${slot.startTime} - ${slot.endTime}` : appointment.scheduledTime;

  const handleSaveLocation = () => {
    if (onAssignLocation && entryGate && unloadingLocation) {
      onAssignLocation(appointment.id, entryGate, unloadingLocation);
    }
  };

  return (
    <div className={cn(
      "bg-white border rounded shadow-sm p-2 flex flex-col gap-1.5 transition-all hover:shadow-md",
      appointment.isSpecialWindow ? "border-red-500 border-2" : inYard && isOverdue ? "border-red-300 bg-red-50/30" : "border-slate-200"
    )}>
      {appointment.status === 'Awaiting Call' && (
        <div className="text-[10px] font-mono font-bold text-slate-900 bg-amber-200 px-2 py-1 rounded-sm leading-none flex items-center gap-1.5 justify-center shadow-sm mb-1">
          <Clock className="w-3 h-3" />
          SLOT: {slotDisplay}
        </div>
      )}

      {appointment.isSpecialWindow && (
        <div className="text-[9px] font-black uppercase tracking-widest text-red-700 bg-red-100 border border-red-200 px-2 py-1 rounded text-center mb-1 shadow-sm">
          Special Window
        </div>
      )}

      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <div className="text-xs font-black text-slate-900 tracking-tight leading-none">{appointment.containerId}</div>
          {appointment.isBitrem && appointment.containerId2 && (
            <div className="text-xs font-black text-slate-900 tracking-tight leading-none mt-1">{appointment.containerId2}</div>
          )}
        </div>
        <div className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded leading-none text-right">
          {appointment.blNumber}
          {appointment.isBitrem && <div className="text-[8px] text-amber-600 mt-0.5 uppercase">Bitrem</div>}
        </div>
      </div>
      
      <div className="flex items-center mt-1 mb-0.5 gap-2">
        <div className="text-[11px] font-bold text-slate-700 leading-tight w-1/4">{appointment.licensePlate}</div>
        <div className="text-[10px] font-black text-blue-800 uppercase tracking-widest text-center flex-1 bg-blue-50 py-1 rounded shadow-sm border border-blue-100">
          {appointment.carrier}
        </div>
        <div className="w-1/4 flex flex-col items-end gap-1">
          {appointment.status !== 'Awaiting Call' && (
            <div className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded leading-none shadow-sm flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {appointment.scheduledTime}
            </div>
          )}
          {inYard && appointment.gateInTime && (
            <div className={cn(
              "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold leading-none",
              isOverdue ? "text-red-700 bg-red-100" : "text-slate-600 bg-slate-100"
            )}>
              <Clock className="w-2.5 h-2.5" />
              {duration}m
            </div>
          )}
        </div>
      </div>

      <div className="text-[9px] text-slate-400 pb-1.5 border-b border-slate-100 leading-none mt-0.5">
        Driver: <span className="font-medium text-slate-600">{appointment.driver}</span>
      </div>

      {appointment.status === 'Awaiting Call' && onCall && (
        <button
          onClick={() => onCall(appointment.id)}
          className="mt-0.5 w-full bg-slate-900 hover:bg-slate-800 text-white px-2 py-1.5 rounded text-[9px] uppercase font-bold tracking-wider transition-colors"
        >
          Call Truck
        </button>
      )}

      {appointment.status === 'Called/In Transit' && onGateIn && (
        <div className="mt-0.5 flex gap-1">
          <button
            onClick={() => onGateIn(appointment.id)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded text-[9px] uppercase font-bold tracking-wider transition-colors"
          >
            Gate-In
          </button>
          {onNoShow && (
            <button
              onClick={() => onNoShow(appointment.id)}
              className="bg-red-600 hover:bg-red-700 text-white px-2 py-1.5 rounded text-[9px] uppercase font-bold tracking-wider transition-colors shrink-0"
              title="No Show - Reschedule to next slot"
            >
              No Show
            </button>
          )}
        </div>
      )}

      {inYard && (
        <div className="pt-1 flex flex-col gap-1.5">
          {appointment.entryGate && appointment.unloadingLocation ? (
            <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-100">
              <div>
                <div className="text-[9px] font-bold text-slate-700 uppercase leading-none">{appointment.unloadingLocation}</div>
                <div className="text-[9px] text-slate-500 leading-none mt-1">{appointment.entryGate}</div>
              </div>
              {onGateOut && (
                <button
                  onClick={() => onGateOut(appointment.id)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-2 py-1 rounded text-[9px] uppercase font-bold tracking-wider transition-colors shrink-0"
                >
                  Gate-Out
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="Gate (e.g. Temp B)"
                  value={entryGate}
                  onChange={(e) => setEntryGate(e.target.value)}
                  className="w-full border border-slate-300 rounded px-1.5 py-1 text-[9px] bg-white focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLocation()}
                />
                <input
                  type="text"
                  placeholder="Location (e.g. Dock 4)"
                  value={unloadingLocation}
                  onChange={(e) => setUnloadingLocation(e.target.value)}
                  className="w-full border border-slate-300 rounded px-1.5 py-1 text-[9px] bg-white focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLocation()}
                />
              </div>
              <button
                onClick={handleSaveLocation}
                disabled={!entryGate || !unloadingLocation}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded text-[9px] uppercase font-bold tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
