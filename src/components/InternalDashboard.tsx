import { useState, FormEvent, useEffect } from 'react';
import { YardSlot, TruckAppointment } from '../types';
import { KPICard } from './KPICard';
import { SlotAdherenceChart } from './SlotAdherenceChart';
import { CarrierPerformanceKPI } from './CarrierPerformanceKPI';
import { ContainerCard } from './ContainerCard';
import { DailyReport } from './DailyReport';
import { cn } from '../utils';
import { mockBlacklistedDrivers } from '../mockData';
import { ShieldAlert, Zap } from 'lucide-react';

interface InternalDashboardProps {
  appointments: TruckAppointment[];
  currentSlot: YardSlot;
  nextSlot?: YardSlot;
  onCallNext: () => void;
  onAssignLocation: (id: string, entryGate: string, unloadingLocation: string) => void;
  onGateOut: (id: string) => void;
  onCallTruck: (id: string) => void;
  onGateIn: (id: string) => void;
  onNoShow: (id: string) => void;
  onCreateSpecialWindow: (data: Omit<TruckAppointment, 'id' | 'status'>) => void;
}

export function InternalDashboard({ appointments, currentSlot, nextSlot, onCallNext, onAssignLocation, onGateOut, onCallTruck, onGateIn, onNoShow, onCreateSpecialWindow }: InternalDashboardProps) {
  const [activeTab, setActiveTab] = useState<'kanban' | 'report'>('kanban');
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
  
  // Special Modal State
  const [swLicensePlate, setSwLicensePlate] = useState('');
  const [swCarrier, setSwCarrier] = useState('');
  const [swDriver, setSwDriver] = useState('');
  const [swContainerId, setSwContainerId] = useState('');
  const [swBlNumber, setSwBlNumber] = useState('');

  const handleSpecialSubmit = (e: FormEvent) => {
    e.preventDefault();
    onCreateSpecialWindow({
      carrier: swCarrier || 'Admin Override',
      driver: swDriver || 'N/A',
      licensePlate: swLicensePlate,
      containerId: swContainerId,
      blNumber: swBlNumber,
      scheduledTime: currentSlot.startTime,
      slotId: currentSlot.id,
      isSpecialWindow: true
    });
    setIsSpecialModalOpen(false);
    setSwLicensePlate('');
    setSwCarrier('');
    setSwDriver('');
    setSwContainerId('');
    setSwBlNumber('');
  };

  // Derived metrics for current slot
  const currentSlotAppointments = appointments.filter(a => a.slotId === currentSlot.id);
  const inYardCount = appointments.filter(a => a.status === 'In Yard').reduce((acc, a) => acc + (a.isBitrem ? 2 : 1), 0);
  const operatedCount = currentSlotAppointments.filter(a => a.status === 'Operated').reduce((acc, a) => acc + (a.isBitrem ? 2 : 1), 0);
  const awaitingCount = currentSlotAppointments.filter(a => a.status === 'Awaiting Call' || a.status === 'Called/In Transit').reduce((acc, a) => acc + (a.isBitrem ? 2 : 1), 0);

  const [isTimeToCall, setIsTimeToCall] = useState(false);
  
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      
      let shouldCall = false;
      if (currentSlot && currentSlot.endTime) {
        const [endH, endM] = currentSlot.endTime.split(':').map(Number);
        const diffMins = (endH * 60 + endM) - (currentHour * 60 + currentMin);
        if (diffMins <= 15 && diffMins > -15) {
          shouldCall = true;
        }
      }
      
      if (inYardCount < 5) {
        shouldCall = true;
      }
      
      setIsTimeToCall(shouldCall);
    };
    
    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [currentSlot, inYardCount]);

  const queueAppointments = appointments
    .filter(a => a.status === 'Awaiting Call')
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  let totalTurnaroundMins = 0;
  let completedCount = 0;
  appointments.forEach(apt => {
    if (apt.status === 'Operated' && apt.gateInTime && apt.gateOutTime) {
      const [inH, inM] = apt.gateInTime.split(':').map(Number);
      const [outH, outM] = apt.gateOutTime.split(':').map(Number);
      let diff = (outH * 60 + outM) - (inH * 60 + inM);
      if (diff < 0) diff += 24 * 60;
      totalTurnaroundMins += diff;
      completedCount++;
    }
  });
  const globalAvgTurnaround = completedCount > 0 ? Math.round(totalTurnaroundMins / completedCount) : 0;

  const transitAppointments = appointments
    .filter(a => a.status === 'Called/In Transit')
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const inYardAppointments = appointments
    .filter(a => a.status === 'In Yard')
    .sort((a, b) => (a.gateInTime || '').localeCompare(b.gateInTime || ''));

  return (
    <main className="flex-1 w-full mx-auto p-2 md:p-4 flex flex-col gap-2 md:gap-4 overflow-hidden">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 md:gap-4 shrink-0">
        {/* KPI Row */}
        <section className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 w-full">
          <KPICard 
            title="Total Scheduled" 
            value={appointments.length + 175} 
            subtitle="Today's bookings"
          />
          <KPICard 
            title="Gate-In Count" 
            value={inYardCount} 
            subtitle="Containers currently in yard"
            className="border-blue-200"
            valueClassName="text-blue-600"
          />
          <KPICard 
            title="Avg Turnaround" 
            value={globalAvgTurnaround} 
            unit="min"
            subtitle="Gate-in to Gate-out target: 34m"
          />
        </section>
        
        {/* Right side actions */}
        <div className="flex-shrink-0 flex items-center justify-end gap-3">
          <button
            onClick={() => setIsBlacklistModalOpen(true)}
            className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 md:py-2 rounded text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-sm transition-colors border border-red-300 self-stretch"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Security List
          </button>
          
          <button
            onClick={() => setIsSpecialModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 md:py-2 rounded text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-sm transition-colors border border-purple-800 self-stretch"
          >
            Create Special Window
          </button>
          
          <div className="flex bg-slate-200 p-0.5 rounded border border-slate-300">
            <button
              onClick={() => setActiveTab('kanban')}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors",
                activeTab === 'kanban' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Live Kanban
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={cn(
                "px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors",
                activeTab === 'report' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Daily Report
            </button>
          </div>

          <div className="relative h-full flex flex-col justify-end">
            {isTimeToCall && nextSlot && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-green-500 text-white text-[9px] font-bold uppercase px-2 py-1 rounded animate-pulse shadow-sm z-10 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-current" />
                Optimal Time to Call
              </div>
            )}
            <button 
              onClick={onCallNext}
              className={cn(
                "bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-[10px] md:text-xs px-4 py-2 md:px-6 md:py-3 rounded shadow-md transition-all flex flex-col items-center h-full justify-center min-h-[50px]",
                !nextSlot ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg hover:-translate-y-0.5",
                isTimeToCall && nextSlot ? "ring-2 ring-green-500 ring-offset-2" : ""
              )}
              disabled={!nextSlot}
            >
              <span>Call Next Window</span>
              {nextSlot && <span className="text-[9px] md:text-[10px] text-slate-400 mt-1">{nextSlot.startTime} - {nextSlot.endTime} ({nextSlot.capacity} slots)</span>}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'report' ? (
        <DailyReport appointments={appointments} />
      ) : (
        /* Analytics & Kanban Board */
        <section className="flex-1 flex flex-col xl:flex-row gap-2 md:gap-4 min-h-0">
          {/* Left: Charts (Optional depending on space, but useful to keep) */}
          <div className="xl:w-1/4 flex flex-col shrink-0">
          <SlotAdherenceChart 
            currentSlot={currentSlot} 
            inYard={inYardCount} 
            operated={operatedCount} 
          />
          <CarrierPerformanceKPI appointments={appointments} />
        </div>

        {/* Right: Kanban Columns */}
        <div className="xl:w-3/4 flex flex-col md:flex-row gap-2 md:gap-4 min-h-0 flex-1">
          
          {/* Column 1: Queue */}
          <div className="flex-1 flex flex-col bg-slate-200/50 rounded-lg border border-slate-200 overflow-hidden min-h-0">
            <div className="p-2 bg-amber-100 border-b border-amber-200 flex justify-between items-center shrink-0">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-900">Queue</h3>
              <span className="bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none">
                {queueAppointments.length}
              </span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2">
              {queueAppointments.map(apt => (
                <ContainerCard key={apt.id} appointment={apt} onCall={onCallTruck} />
              ))}
            </div>
          </div>

          {/* Column 2: In Transit */}
          <div className="flex-1 flex flex-col bg-slate-200/50 rounded-lg border border-slate-200 overflow-hidden min-h-0">
            <div className="p-2 bg-green-100 border-b border-green-200 flex justify-between items-center shrink-0">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-green-900">In Transit</h3>
              <span className="bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none">
                {transitAppointments.length}
              </span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2">
              {transitAppointments.map(apt => (
                <ContainerCard key={apt.id} appointment={apt} onGateIn={onGateIn} onNoShow={onNoShow} />
              ))}
            </div>
          </div>

          {/* Column 3: Active Yard */}
          <div className="flex-1 flex flex-col bg-slate-200/50 rounded-lg border border-slate-200 overflow-hidden min-h-0">
            <div className="p-2 bg-blue-100 border-b border-blue-200 flex justify-between items-center shrink-0">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-900">Active Yard</h3>
              <span className="bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none">
                {inYardAppointments.length}
              </span>
            </div>
            <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2">
              {inYardAppointments.map(apt => (
                <ContainerCard 
                  key={apt.id} 
                  appointment={apt} 
                  onAssignLocation={onAssignLocation}
                  onGateOut={onGateOut}
                  avgTurnaround={34}
                />
              ))}
            </div>
          </div>

        </div>
      </section>
      )}

      {isSpecialModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 bg-purple-600 border-b border-purple-700 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">Create Special Window</h2>
              <button 
                onClick={() => setIsSpecialModalOpen(false)}
                className="text-purple-200 hover:text-white transition-colors text-xl leading-none"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSpecialSubmit} className="p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-purple-50 border border-purple-100 p-3 rounded text-xs text-purple-800">
                <strong>Warning:</strong> Creating a special window bypasses slot capacity limits and advance booking restrictions. Use only for operational exceptions.
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600">License Plate *</label>
                <input 
                  type="text" 
                  value={swLicensePlate}
                  onChange={(e) => setSwLicensePlate(e.target.value.toUpperCase())}
                  className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Container ID *</label>
                <input 
                  type="text" 
                  value={swContainerId}
                  onChange={(e) => setSwContainerId(e.target.value.toUpperCase())}
                  className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600">BL Number *</label>
                <input 
                  type="text" 
                  value={swBlNumber}
                  onChange={(e) => setSwBlNumber(e.target.value.toUpperCase())}
                  className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors text-sm"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Carrier (Optional)</label>
                  <input 
                    type="text" 
                    value={swCarrier}
                    onChange={(e) => setSwCarrier(e.target.value)}
                    className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors text-sm"
                    placeholder="Admin Override"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Driver (Optional)</label>
                  <input 
                    type="text" 
                    value={swDriver}
                    onChange={(e) => setSwDriver(e.target.value)}
                    className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors text-sm"
                    placeholder="N/A"
                  />
                </div>
              </div>

              <div className="mt-2 pt-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSpecialModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!swLicensePlate || !swContainerId || !swBlNumber}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Authorize Window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBlacklistModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-red-600 border-b border-red-700 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-white w-5 h-5" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-white">Security Driver Blacklist</h2>
              </div>
              <button 
                onClick={() => setIsBlacklistModalOpen(false)}
                className="text-red-200 hover:text-white transition-colors text-xl leading-none"
              >
                &times;
              </button>
            </div>
            
            <div className="p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-red-50 border border-red-100 p-3 rounded text-xs text-red-800 font-medium">
                Drivers on this list are actively blocked from booking appointments and entering the facility. 
                Any attempt to book with these CPFs will be automatically rejected by the Carrier Portal.
              </div>
              
              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0">
                    <tr>
                      <th className="px-4 py-2">CPF</th>
                      <th className="px-4 py-2">Driver Name</th>
                      <th className="px-4 py-2">Reason for Block</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {mockBlacklistedDrivers.map(driver => (
                      <tr key={driver.cpf} className="hover:bg-red-50/50 transition-colors text-xs items-center">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{driver.cpf}</td>
                        <td className="px-4 py-3 font-medium">{driver.name}</td>
                        <td className="px-4 py-3 text-red-700">{driver.reason}</td>
                      </tr>
                    ))}
                    {mockBlacklistedDrivers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-xs uppercase font-bold tracking-wide">
                          No blacklisted drivers
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Add New Block</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder="CPF" className="border border-slate-300 rounded px-3 py-1.5 font-mono text-sm w-32 focus:outline-none focus:border-red-500" />
                  <input type="text" placeholder="Driver Name" className="border border-slate-300 rounded px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-red-500" />
                  <input type="text" placeholder="Reason" className="border border-slate-300 rounded px-3 py-1.5 text-sm flex-1 focus:outline-none focus:border-red-500" />
                  <button className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors shrink-0">
                    Add Block
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">Note: Addition is purely UI demonstration.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
