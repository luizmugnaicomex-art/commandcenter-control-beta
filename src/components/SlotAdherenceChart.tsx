import { YardSlot } from '../types';

interface SlotAdherenceChartProps {
  currentSlot: YardSlot;
  inYard: number;
  operated: number;
}

export function SlotAdherenceChart({ currentSlot, inYard, operated }: SlotAdherenceChartProps) {
  const capacity = currentSlot.capacity;
  const awaiting = capacity - inYard - operated;
  
  const operatedPct = Math.round((operated / capacity) * 100) || 0;
  const inYardPct = Math.round((inYard / capacity) * 100) || 0;
  const awaitingPct = Math.round((awaiting / capacity) * 100) || 0;

  return (
    <div className="bg-white border border-slate-200 p-3 rounded shadow-sm shrink-0">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Window Adherence</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Slot {currentSlot.startTime} - {currentSlot.endTime}</span>
      </div>
      
      <div className="mt-1 w-full space-y-2">
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
          <span>Capacity ({capacity})</span>
          <span className="text-blue-600">Filled ({inYard + operated})</span>
        </div>
        <div className="h-2.5 flex rounded-full overflow-hidden bg-slate-100 w-full shadow-inner">
          {operated > 0 && (
            <div 
              style={{ width: `${operatedPct}%` }} 
              className="bg-slate-400 transition-all duration-500"
              title={`Operated / Evacuated: ${operated}`}
            ></div>
          )}
          {inYard > 0 && (
            <div 
              style={{ width: `${inYardPct}%` }} 
              className="bg-blue-600 transition-all duration-500"
              title={`In Yard: ${inYard}`}
            ></div>
          )}
          {awaiting > 0 && (
            <div 
              style={{ width: `${awaitingPct}%` }} 
              className="bg-amber-400 transition-all duration-500"
              title={`Awaiting / Scheduled: ${awaiting}`}
            ></div>
          )}
        </div>
        
        <div className="flex gap-2 pt-1 text-[8px] font-bold text-slate-500 uppercase tracking-wide justify-between">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Operated
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> In Yard
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> Awaiting
          </div>
        </div>
      </div>
    </div>
  );
}
