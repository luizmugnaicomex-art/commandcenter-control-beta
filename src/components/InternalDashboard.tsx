import { useState, FormEvent, useEffect } from 'react';
import { YardSlot, TruckAppointment, MasterPlanItem } from '../types';
import { KPICard } from './KPICard';
import { SlotAdherenceChart } from './SlotAdherenceChart';
import { CarrierPerformanceKPI } from './CarrierPerformanceKPI';
import { ContainerCard } from './ContainerCard';
import { DailyReport } from './DailyReport';
import { MasterPlanReconciliation } from './MasterPlanReconciliation';
import { LoadingPanel } from './LoadingPanel';
import { cn, sanitizeLicensePlate, getPunctualityStatus } from '../utils';
import { mockBlacklistedDrivers } from '../mockData';
import { ShieldAlert, Zap, Truck, ClipboardList, BarChart3, LayoutDashboard } from 'lucide-react';

interface InternalDashboardProps {
  appointments: TruckAppointment[];
  masterPlan: MasterPlanItem[];
  onUploadMasterPlan: (items: MasterPlanItem[]) => void;
  onUpdateMasterPlanItem: (item: MasterPlanItem) => void;
  currentSlot: YardSlot;
  nextSlot?: YardSlot;
  onCallNext: () => void;
  onAssignLocation: (id: string, entryGate: string, unloadingLocation: string) => void;
  onGateOut: (id: string) => void;
  onRevertToYard: (id: string) => void;
  onCallTruck: (id: string) => void;
  onGateIn: (id: string) => void;
  onArrivedAtLine: (id: string) => void;
  onNoShow: (id: string) => void;
  onCreateSpecialWindow: (data: Omit<TruckAppointment, 'id' | 'status'>) => void;
  activeTab: 'dashboard' | 'kanban' | 'loading' | 'masterPlan' | 'report';
  selectedDate: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onCloseDaySweep?: () => void;
}

export function InternalDashboard({ appointments, masterPlan, onUploadMasterPlan, onUpdateMasterPlanItem, currentSlot, nextSlot, onCallNext, onAssignLocation, onGateOut, onRevertToYard, onCallTruck, onGateIn, onArrivedAtLine, onNoShow, onCreateSpecialWindow, activeTab, selectedDate, onPrevDay, onNextDay, onToday, onCloseDaySweep }: InternalDashboardProps) {
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
  
  // Special Modal State
  const [swLicensePlate, setSwLicensePlate] = useState('');
  const [swCarrier, setSwCarrier] = useState('');
  const [swDriver, setSwDriver] = useState('');
  const [swContainerId, setSwContainerId] = useState('');
  const [swBlNumber, setSwBlNumber] = useState('');
  const [fastTrackPin, setFastTrackPin] = useState('');

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
  const awaitingCount = currentSlotAppointments.filter(a => a.status === 'Awaiting Call' || a.status === 'Called/In Transit' || a.status === 'Physical Line').reduce((acc, a) => acc + (a.isBitrem ? 2 : 1), 0);

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
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [currentSlot, inYardCount]);

  const getPunctualityRank = (scheduledTime?: string) => {
    const p = getPunctualityStatus(scheduledTime);
    if (p.status === 'LATE') return 0;
    if (p.status === 'ON TIME') return 1;
    return 2; // EARLY
  };

  const queueAppointments = appointments
    .filter(a => a.status === 'Awaiting Call' || a.status === 'NO SHOW')
    .sort((a, b) => {
      if (a.isEnRoute && !b.isEnRoute) return -1;
      if (!a.isEnRoute && b.isEnRoute) return 1;
      const rankA = getPunctualityRank(a.scheduledTime);
      const rankB = getPunctualityRank(b.scheduledTime);
      if (rankA !== rankB) return rankA - rankB;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

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
    .sort((a, b) => {
      const rankA = getPunctualityRank(a.scheduledTime);
      const rankB = getPunctualityRank(b.scheduledTime);
      if (rankA !== rankB) return rankA - rankB;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

  const physicalLineAppointments = appointments
    .filter(a => a.status === 'Physical Line')
    .sort((a, b) => {
      const rankA = getPunctualityRank(a.scheduledTime);
      const rankB = getPunctualityRank(b.scheduledTime);
      if (rankA !== rankB) return rankA - rankB;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

  const inYardAppointments = appointments
    .filter(a => a.status === 'In Yard')
    .sort((a, b) => (a.gateInTime || '').localeCompare(b.gateInTime || ''));

  const finishedAppointments = appointments
    .filter(a => a.status === 'Operated')
    .sort((a, b) => (b.gateOutTime || '').localeCompare(a.gateOutTime || ''));

  return (
    <main className="flex-1 w-full mx-auto p-4 md:p-6 flex flex-col gap-4 overflow-hidden bg-slate-50">
      {/* Top Header Action & KPI Strip */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full md:w-auto flex-1">
          <KPICard 
            title="Total Scheduled" 
            value={appointments.length + 175} 
            subtitle="Bookings for Date"
            icon="truck"
            trend="+12% vs yesterday"
          />
          <KPICard 
            title="Gate-In Count" 
            value={inYardAppointments.length} 
            subtitle="Containers Currently in Yard"
            icon="users"
            alert={inYardAppointments.length > 15}
          />
          <KPICard 
            title="Avg Turnaround" 
            value={`${globalAvgTurnaround || 34} min`} 
            subtitle="Gate-In to Gate-Out Target: 34m"
            icon="clock"
          />
        </section>

        <div className="flex items-center gap-3 shrink-0 self-stretch md:self-auto justify-end">
          {onCloseDaySweep && (
            <button
              onClick={onCloseDaySweep}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5"
              title="End of Shift / Midnight Sweep"
            >
              <span>🌙 Close Day Sweep</span>
            </button>
          )}

          <button
            onClick={() => setIsBlacklistModalOpen(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-red-600" />
            Security List ({mockBlacklistedDrivers.length})
          </button>
          
          <button
            onClick={() => setIsSpecialModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-purple-200" />
            Create Special Window
          </button>

          <button 
            onClick={onCallNext}
            className={cn(
              "bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-xs px-5 py-2.5 rounded-lg shadow-md transition-all flex flex-col items-center justify-center",
              !nextSlot ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg hover:-translate-y-0.5",
              isTimeToCall && nextSlot ? "ring-2 ring-emerald-500 ring-offset-2" : ""
            )}
            disabled={!nextSlot}
          >
            <span>Call Next Window</span>
            {nextSlot && <span className="text-[10px] text-slate-400 mt-0.5">{nextSlot.startTime} - {nextSlot.endTime}</span>}
          </button>
        </div>
      </div>

      {/* Main Tab Content Routing */}
      {activeTab === 'dashboard' ? (
        <section className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0 overflow-y-auto">
          <div className="xl:w-1/2 flex flex-col gap-4">
            <SlotAdherenceChart currentSlot={currentSlot} inYard={inYardCount} operated={operatedCount} />
          </div>
          <div className="xl:w-1/2 flex flex-col gap-4">
            <CarrierPerformanceKPI appointments={appointments} />
          </div>
        </section>
      ) : activeTab === 'masterPlan' ? (
        <MasterPlanReconciliation 
          appointments={appointments} 
          masterPlan={masterPlan} 
          onUploadMasterPlan={onUploadMasterPlan} 
          onUpdateMasterPlanItem={onUpdateMasterPlanItem} 
          selectedDate={selectedDate}
          onPrevDay={onPrevDay}
          onNextDay={onNextDay}
          onToday={onToday}
        />
      ) : activeTab === 'report' ? (
        <DailyReport appointments={appointments} />
      ) : activeTab === 'loading' ? (
        <LoadingPanel 
          appointments={appointments} 
          currentSlot={currentSlot} 
          onGateOut={onGateOut} 
          onCallTruck={onCallTruck} 
          onGateIn={onGateIn} 
          selectedDate={selectedDate}
          onPrevDay={onPrevDay}
          onNextDay={onNextDay}
          onToday={onToday}
        />
      ) : (
        /* Kanban Board (Gestão de Pátio) with 5 Columns & Date Navigation Bar */
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Phase 29 Task 3: Fast-Track Gate Pass Scanner Bar */}
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-lg p-3 shadow-md flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2 text-white">
              <span className="text-lg">🔍</span>
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wider">Fast-Track Gate Pass Scanner</span>
                <span className="text-[10px] text-slate-300">Scan QR or Type 4-Digit PIN to Gate-In instantly</span>
              </div>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const cleanPin = fastTrackPin.trim().toUpperCase();
                if (!cleanPin) return;
                const foundApt = appointments.find(a => a.gatePin?.toUpperCase() === cleanPin);
                if (foundApt) {
                  onGateIn(foundApt.id);
                  alert(`✅ Fast-Track Success! Truck [${foundApt.licensePlate}] / Container [${foundApt.containerId}] successfully Gated-In.`);
                  setFastTrackPin('');
                } else {
                  alert(`❌ Gate PIN "${cleanPin}" not found among active bookings.`);
                }
              }}
              className="flex items-center gap-2 flex-1 max-w-md"
            >
              <input
                type="text"
                value={fastTrackPin}
                onChange={(e) => setFastTrackPin(e.target.value)}
                placeholder="Scan QR or Type 4-Digit PIN (e.g. K9M2)..."
                maxLength={6}
                className="w-full bg-white text-slate-900 font-mono font-bold text-sm px-3 py-2 rounded border border-slate-300 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded shadow transition-colors shrink-0"
              >
                Gate-In ⚡
              </button>
            </form>
          </div>

          {/* Task 1: Date Navigation Bar */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">Operational Date:</span>
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onPrevDay}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors"
                title="Previous Day"
              >
                &larr; Prev Day
              </button>
              <button
                onClick={onToday}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                Today
              </button>
              <button
                onClick={onNextDay}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors"
                title="Next Day"
              >
                Next Day &rarr;
              </button>
            </div>
          </div>

          <section className="flex-1 flex flex-col xl:flex-row gap-2.5 min-h-0 flex-1">
            {/* Column 1: Queue */}
            <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm min-h-0">
              <div className="p-3 bg-amber-500 text-white font-bold flex justify-between items-center shrink-0 shadow-sm">
                <h3 className="text-xs uppercase tracking-widest">Queue</h3>
                <span className="bg-amber-600 text-white px-2 py-0.5 rounded-full text-xs font-mono">
                  {queueAppointments.length}
                </span>
              </div>
              <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2 bg-slate-50">
                {queueAppointments.map(apt => (
                  <ContainerCard key={apt.id} appointment={apt} appointments={appointments} onCall={onCallTruck} onRevertToYard={onRevertToYard} />
                ))}
              </div>
            </div>

            {/* Column 2: In Transit */}
            <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm min-h-0">
              <div className="p-3 bg-emerald-600 text-white font-bold flex justify-between items-center shrink-0 shadow-sm">
                <h3 className="text-xs uppercase tracking-widest">In Transit</h3>
                <span className="bg-emerald-700 text-white px-2 py-0.5 rounded-full text-xs font-mono">
                  {transitAppointments.length}
                </span>
              </div>
              <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2 bg-slate-50">
                {transitAppointments.map(apt => (
                  <ContainerCard key={apt.id} appointment={apt} appointments={appointments} onArrivedAtLine={onArrivedAtLine} onNoShow={onNoShow} onRevertToYard={onRevertToYard} />
                ))}
              </div>
            </div>

            {/* Column 3: Physical Line (Fila Externa) */}
            <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm min-h-0">
              <div className="p-3 bg-orange-600 text-white font-bold flex justify-between items-center shrink-0 shadow-sm">
                <h3 className="text-xs uppercase tracking-widest">Physical Line</h3>
                <span className="bg-orange-700 text-white px-2 py-0.5 rounded-full text-xs font-mono">
                  {physicalLineAppointments.length}
                </span>
              </div>
              <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2 bg-slate-50">
                {physicalLineAppointments.map(apt => (
                  <ContainerCard key={apt.id} appointment={apt} appointments={appointments} onGateIn={onGateIn} onNoShow={onNoShow} onRevertToYard={onRevertToYard} />
                ))}
              </div>
            </div>

            {/* Column 4: Active Yard */}
            <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm min-h-0">
              <div className="p-3 bg-blue-600 text-white font-bold flex justify-between items-center shrink-0 shadow-sm">
                <h3 className="text-xs uppercase tracking-widest">Active Yard</h3>
                <span className="bg-blue-700 text-white px-2 py-0.5 rounded-full text-xs font-mono">
                  {inYardAppointments.length}
                </span>
              </div>
              <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2 bg-slate-50">
                {inYardAppointments.map(apt => (
                  <ContainerCard 
                    key={apt.id} 
                    appointment={apt} 
                    appointments={appointments}
                    onAssignLocation={onAssignLocation}
                    onGateOut={onGateOut}
                    onRevertToYard={onRevertToYard}
                    avgTurnaround={globalAvgTurnaround || 34}
                  />
                ))}
              </div>
            </div>

            {/* Column 5: Finished */}
            <div className="flex-1 flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm min-h-0">
              <div className="p-3 bg-purple-600 text-white font-bold flex justify-between items-center shrink-0 shadow-sm">
                <h3 className="text-xs uppercase tracking-widest">Finished</h3>
                <span className="bg-purple-700 text-white px-2 py-0.5 rounded-full text-xs font-mono">
                  {finishedAppointments.length}
                </span>
              </div>
              <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-2 bg-slate-50">
                {finishedAppointments.map(apt => (
                  <ContainerCard key={apt.id} appointment={apt} appointments={appointments} onRevertToYard={onRevertToYard} />
                ))}
              </div>
            </div>
          </section>
        </div>
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
                  onChange={(e) => setSwLicensePlate(sanitizeLicensePlate(e.target.value))}
                  placeholder="ABC1234"
                  className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Container ID *</label>
                <input 
                  type="text" 
                  list="masterplan-containers"
                  value={swContainerId}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setSwContainerId(val);
                    const found = masterPlan.find(m => m.containerId === val || m.containerId2 === val);
                    if (found) {
                      if (found.blNumber) setSwBlNumber(found.blNumber);
                      if (found.carrierName) setSwCarrier(found.carrierName);
                    }
                  }}
                  placeholder="e.g. TGBU6801189"
                  className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors text-sm"
                  required
                />
                <datalist id="masterplan-containers">
                  {masterPlan.map(m => (
                    <option key={m.id} value={m.containerId}>
                      {m.carrierName} - BL: {m.blNumber}
                    </option>
                  ))}
                </datalist>
                <span className="text-[10px] text-slate-500">Auto-fills BL Number & Carrier from Daily Schedule.</span>
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
                    placeholder="Driver Name"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSpecialModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                  Create Window
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBlacklistModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Security & Restricted Drivers List
              </h2>
              <button 
                onClick={() => setIsBlacklistModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
              >
                &times;
              </button>
            </div>
            
            <div className="p-4 flex flex-col gap-3 overflow-y-auto max-h-[60vh]">
              <div className="bg-red-50 border border-red-200 p-3 rounded text-xs text-red-800">
                Drivers on this list are automatically blocked from booking time slots or entering the yard gates.
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="p-2.5">CPF</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mockBlacklistedDrivers.map(driver => (
                    <tr key={driver.cpf} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-slate-800">{driver.cpf}</td>
                      <td className="p-2.5 font-medium text-slate-900">{driver.name}</td>
                      <td className="p-2.5 text-red-600 font-bold">{driver.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsBlacklistModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
