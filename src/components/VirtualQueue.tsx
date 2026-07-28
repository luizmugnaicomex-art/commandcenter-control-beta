import { TruckAppointment, YardSlot } from '../types';
import { cn } from '../utils';

interface VirtualQueueProps {
  appointments: TruckAppointment[];
  slots: YardSlot[];
  onCallNext: () => void;
  nextSlotTime?: string;
}

export function VirtualQueue({ appointments, slots, onCallNext, nextSlotTime }: VirtualQueueProps) {
  return (
    <div className="bg-white border border-slate-200 rounded flex flex-col h-full shadow-sm">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white rounded-t">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Virtual Queue Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">Live gate status and operations flow</p>
        </div>
        <button
          onClick={onCallNext}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-green-200/50 transition-colors focus:outline-none"
        >
          Call Next Window {nextSlotTime && `(${nextSlotTime})`}
        </button>
      </div>
      
      <div className="overflow-auto flex-1">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0">
            <tr>
              <th className="px-4 py-2">Carrier</th>
              <th className="px-4 py-2">Driver Name</th>
              <th className="px-4 py-2">License Plate</th>
              <th className="px-4 py-2">Container ID</th>
              <th className="px-4 py-2">BL Number</th>
              <th className="px-4 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs uppercase font-bold tracking-wide">
                  No pending appointments
                </td>
              </tr>
            ) : (
              appointments.map((apt) => {
                const slot = slots.find(s => s.id === apt.slotId);
                const slotDisplay = slot ? `${slot.startTime} - ${slot.endTime}` : apt.scheduledTime;
                
                return (
                  <tr key={apt.id} className="hover:bg-slate-50 transition-colors text-xs items-center">
                    <td className="px-4 py-3 font-medium truncate">
                      {apt.carrier}
                      <div className="text-[10px] text-slate-400 mt-0.5">Slot: {slotDisplay}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">{apt.driver}</td>
                    <td className="px-4 py-3 font-mono font-bold">{apt.licensePlate}</td>
                    <td className="px-4 py-3 font-mono font-bold">{apt.containerId}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-500">{apt.blNumber}</td>
                    <td className="px-4 py-3 text-center flex justify-center">
                      <StatusBadge status={apt.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: TruckAppointment['status'] }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      {
        'bg-amber-100 text-amber-700 border-amber-200': status === 'Awaiting Call',
        'bg-green-100 text-green-700 border-green-200': status === 'Called/In Transit',
        'bg-blue-100 text-blue-700 border-blue-200': status === 'In Yard',
        'bg-slate-100 text-slate-600 border-slate-200': status === 'Operated',
      }
    )}>
      {status}
    </span>
  );
}
