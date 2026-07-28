import { TruckAppointment } from '../types';
import { cn } from '../utils';

interface CarrierPerformanceKPIProps {
  appointments: TruckAppointment[];
}

function parseTime(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function CarrierPerformanceKPI({ appointments }: CarrierPerformanceKPIProps) {
  // Aggregate data by carrier
  const carrierStats = appointments.reduce((acc, apt) => {
    if (!acc[apt.carrier]) {
      acc[apt.carrier] = { name: apt.carrier, totalTurnaround: 0, completedCount: 0, noShows: 0, totalBooked: 0 };
    }
    
    const noShows = apt.noShowCount || 0;
    acc[apt.carrier].noShows += noShows;
    acc[apt.carrier].totalBooked += 1 + noShows; // Total times they occupied a slot

    if (apt.status === 'Operated' && apt.gateInTime && apt.gateOutTime) {
      const inMins = parseTime(apt.gateInTime);
      let outMins = parseTime(apt.gateOutTime);
      if (outMins < inMins) outMins += 24 * 60; // handle midnight crossing just in case
      const diff = outMins - inMins;
      
      acc[apt.carrier].totalTurnaround += diff;
      acc[apt.carrier].completedCount += 1;
    }
    
    return acc;
  }, {} as Record<string, { name: string; totalTurnaround: number; completedCount: number; noShows: number; totalBooked: number }>);

  const data = Object.values(carrierStats).map(c => {
    const successRate = c.totalBooked > 0 ? (c.completedCount / c.totalBooked) * 100 : 0;
    return {
      name: c.name,
      noShows: c.noShows,
      avgTurnaround: c.completedCount > 0 ? Math.round(c.totalTurnaround / c.completedCount) : 0,
      completed: c.completedCount,
      successRate: successRate,
      totalBooked: c.totalBooked
    };
  }).sort((a, b) => {
    // Sort by success rate (desc), then no shows (asc), then avg turnaround (asc)
    if (a.successRate !== b.successRate) return b.successRate - a.successRate;
    if (a.noShows !== b.noShows) return a.noShows - b.noShows;
    return a.avgTurnaround - b.avgTurnaround;
  });

  const maxTurnaround = Math.max(...data.map(d => d.avgTurnaround), 60); // Ensure at least 60m scale

  return (
    <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col shrink-0 mt-4 flex-1 min-h-[150px]">
      <div className="p-2 border-b border-slate-100 bg-slate-50 shrink-0 flex justify-between items-center">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-900">Carrier Performance</h3>
        <div className="flex gap-3 text-[9px] font-medium text-slate-500">
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-600 rounded-sm"></span> Success</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-300 rounded-sm"></span> Turnaround (min)</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm"></span> No Shows</div>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-3">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 font-bold uppercase text-[10px]">No data</div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.map(c => {
              const barWidth = c.completed > 0 ? Math.max((c.avgTurnaround / maxTurnaround) * 100, 2) : 0;
              const radius = 10;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (c.successRate / 100) * circumference;
              
              return (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
                    <svg width="32" height="32" className="-rotate-90">
                      <circle
                        cx="16" cy="16" r="10"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        fill="transparent"
                        className="text-slate-100"
                      />
                      <circle
                        cx="16" cy="16" r="10"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className={cn(
                          "transition-all duration-700 ease-out",
                          c.successRate >= 80 ? "text-blue-600" : c.successRate >= 50 ? "text-amber-500" : "text-red-500"
                        )}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-slate-700 tracking-tighter">{Math.round(c.successRate)}%</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1 text-[10px] flex-1">
                    <div className="flex justify-between items-end">
                      <span className="font-bold text-slate-700 uppercase truncate" title={c.name}>{c.name}</span>
                      <span className="font-mono text-slate-500">{c.completed > 0 ? `${c.avgTurnaround}m` : '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 h-2.5 rounded-sm overflow-hidden flex relative">
                        {c.completed > 0 && (
                          <div 
                            className={cn(
                              "h-full rounded-sm transition-all duration-500", 
                              c.avgTurnaround > 45 ? "bg-amber-400" : "bg-blue-300"
                            )} 
                            style={{ width: `${barWidth}%` }}
                          />
                        )}
                      </div>
                      {c.noShows > 0 && (
                        <div className="shrink-0 flex items-center gap-1 text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 font-bold leading-none" title={`${c.noShows} No Shows`}>
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                          {c.noShows}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
