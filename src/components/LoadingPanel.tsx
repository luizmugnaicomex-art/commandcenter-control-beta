import React, { useState, useEffect } from 'react';
import { TruckAppointment, YardSlot } from '../types';
import { cn } from '../utils';
import { Clock, Truck, ShieldAlert, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

interface LoadingPanelProps {
  appointments: TruckAppointment[];
  currentSlot: YardSlot;
  onGateOut: (id: string) => void;
  onCallTruck: (id: string) => void;
  onGateIn: (id: string) => void;
}

export function LoadingPanel({ appointments, currentSlot, onGateOut, onCallTruck, onGateIn }: LoadingPanelProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalVehicles = appointments.length;
  const inLoading = appointments.filter(a => a.status === 'In Yard').length;
  const awaiting = appointments.filter(a => a.status === 'Awaiting Call' || a.status === 'Called/In Transit').length;
  const operated = appointments.filter(a => a.status === 'Operated').length;

  const filteredAppointments = appointments.filter(a => {
    const matchesSearch = 
      a.containerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.carrier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.blNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'IN_YARD') return matchesSearch && a.status === 'In Yard';
    if (statusFilter === 'AWAITING') return matchesSearch && (a.status === 'Awaiting Call' || a.status === 'Called/In Transit');
    if (statusFilter === 'OPERATED') return matchesSearch && a.status === 'Operated';
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Operated':
        return <span className="bg-emerald-600 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">Operated</span>;
      case 'In Yard':
        return <span className="bg-blue-600 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">In Yard</span>;
      case 'Called/In Transit':
        return <span className="bg-amber-500 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">In Transit</span>;
      case 'Awaiting Call':
        return <span className="bg-slate-600 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">Queue</span>;
      default:
        return <span className="bg-red-600 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">Late / Alert</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0">
      {/* Left 70%: Dense Data Table */}
      <div className="xl:w-[70%] flex flex-col bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-0">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Active Schedules & Operations Table</h2>
            <p className="text-[11px] text-slate-500">Real-time enterprise gate and yard traffic management</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="text"
              placeholder="Search container, plate, carrier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-300 rounded px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500 w-full sm:w-64"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-700"
            >
              <option value="ALL">All Status</option>
              <option value="IN_YARD">In Yard</option>
              <option value="AWAITING">Awaiting</option>
              <option value="OPERATED">Operated</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-600 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Carrier / Corp</th>
                <th className="px-4 py-3">License Plate</th>
                <th className="px-4 py-3">Container ID</th>
                <th className="px-4 py-3">BL Number</th>
                <th className="px-4 py-3 text-center">Slot</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                    No matching appointments found
                  </td>
                </tr>
              ) : (
                filteredAppointments.map(apt => (
                  <tr key={apt.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">{apt.carrier}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{apt.licensePlate}</td>
                    <td className="px-4 py-3 font-mono font-medium text-blue-700">
                      {apt.containerId}
                      {apt.isBitrem && <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-sans">Bitrem</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{apt.blNumber}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">{apt.scheduledTime}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(apt.status)}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {apt.status === 'Awaiting Call' && onCallTruck && (
                        <button 
                          onClick={() => onCallTruck(apt.id)}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-wider"
                        >
                          Call
                        </button>
                      )}
                      {apt.status === 'Called/In Transit' && onGateIn && (
                        <button 
                          onClick={() => onGateIn(apt.id)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase tracking-wider"
                        >
                          Gate-In
                        </button>
                      )}
                      {apt.status === 'In Yard' && onGateOut && (
                        <button 
                          onClick={() => onGateOut(apt.id)}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold uppercase tracking-wider"
                        >
                          Finish
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right 30%: KPI Grid & Live Digital Clock */}
      <div className="xl:w-[30%] flex flex-col gap-4 shrink-0">
        {/* Prominent Live Digital Clock Tile */}
        <div className="bg-slate-900 text-white p-5 rounded-lg border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-xs uppercase tracking-widest font-bold">
            <span>Enterprise YMS Clock</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="my-3 text-3xl font-mono font-black tracking-wider text-emerald-400">
            {currentTime.toLocaleTimeString()}
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between items-center border-t border-slate-800 pt-2">
            <span>Active Slot: <strong className="text-white">{currentSlot.startTime} - {currentSlot.endTime}</strong></span>
            <span className="text-emerald-400 font-bold uppercase text-[10px]">Active</span>
          </div>
        </div>

        {/* KPI Summary Tiles */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Total Vehicles</span>
            <span className="text-2xl font-black text-slate-900 mt-2">{totalVehicles}</span>
            <span className="text-[10px] text-emerald-600 font-bold mt-1">100% Tracked</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">In Loading</span>
            <span className="text-2xl font-black text-blue-600 mt-2">{inLoading}</span>
            <span className="text-[10px] text-blue-600 font-bold mt-1">Active Yard</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Awaiting</span>
            <span className="text-2xl font-black text-amber-600 mt-2">{awaiting}</span>
            <span className="text-[10px] text-amber-600 font-bold mt-1">Queue & Transit</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Operated</span>
            <span className="text-2xl font-black text-emerald-600 mt-2">{operated}</span>
            <span className="text-[10px] text-emerald-600 font-bold mt-1">Completed Today</span>
          </div>
        </div>

        {/* Operational System Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-900 flex flex-col gap-2">
          <div className="font-bold flex items-center gap-1.5 uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            BYD Corporate YMS Standard
          </div>
          <p className="text-[11px] leading-relaxed text-blue-800">
            Automated gate tracking and real-time buffer optimization active. All container movements synced with yard occupancy rules.
          </p>
        </div>
      </div>
    </div>
  );
}
