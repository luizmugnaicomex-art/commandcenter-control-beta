import { TruckAppointment } from '../types';

interface DailyReportProps {
  appointments: TruckAppointment[];
}

export function DailyReport({ appointments }: DailyReportProps) {
  const operatedAppointments = appointments.filter(a => a.status === 'Operated' || a.status === 'Completed' as string).sort((a, b) => (b.gateOutTime || '').localeCompare(a.gateOutTime || ''));

  return (
    <main className="flex-1 w-full mx-auto p-4 flex flex-col gap-4 overflow-hidden bg-slate-100">
      <div className="bg-white border border-slate-300 rounded shadow-sm flex flex-col min-h-0 flex-1">
        <div className="p-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800">Daily Operations Audit Log</h2>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Filtered: Completed Cycle (Operated)</p>
        </div>
        
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap">
            <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase tracking-wider text-slate-600 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2 border-r border-slate-200">Carrier</th>
                <th className="px-4 py-2 border-r border-slate-200">License Plate</th>
                <th className="px-4 py-2 border-r border-slate-200">Container ID(s)</th>
                <th className="px-4 py-2 border-r border-slate-200">BL Number</th>
                <th className="px-4 py-2 border-r border-slate-200 text-center">Slot</th>
                <th className="px-4 py-2 border-r border-slate-200 text-center">Gate-In</th>
                <th className="px-4 py-2 border-r border-slate-200 text-center">Gate-Out</th>
                <th className="px-4 py-2 text-right">Turnaround</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {operatedAppointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-bold uppercase tracking-widest">
                    No completed operations yet
                  </td>
                </tr>
              ) : (
                operatedAppointments.map(apt => {
                  let turnaround = '-';
                  if (apt.gateInTime && apt.gateOutTime) {
                    const [inH, inM] = apt.gateInTime.split(':').map(Number);
                    const [outH, outM] = apt.gateOutTime.split(':').map(Number);
                    let diff = (outH * 60 + outM) - (inH * 60 + inM);
                    if (diff < 0) diff += 24 * 60;
                    turnaround = `${diff}m`;
                  }

                  return (
                    <tr key={apt.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-2 border-r border-slate-100 font-medium">{apt.carrier}</td>
                      <td className="px-4 py-2 border-r border-slate-100 font-mono font-bold">{apt.licensePlate}</td>
                      <td className="px-4 py-2 border-r border-slate-100 font-mono font-bold">
                        <div className="flex flex-col">
                          <span>{apt.containerId}</span>
                          {apt.isBitrem && apt.containerId2 && (
                            <span className="text-amber-700">{apt.containerId2} <span className="text-[9px] uppercase border border-amber-300 bg-amber-50 px-1 rounded ml-1">Bitrem</span></span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 border-r border-slate-100 font-mono text-slate-500">{apt.blNumber}</td>
                      <td className="px-4 py-2 border-r border-slate-100 text-center font-mono">{apt.scheduledTime}</td>
                      <td className="px-4 py-2 border-r border-slate-100 text-center font-mono text-blue-700 bg-blue-50/30">{apt.gateInTime || '-'}</td>
                      <td className="px-4 py-2 border-r border-slate-100 text-center font-mono text-emerald-700 bg-emerald-50/30">{apt.gateOutTime || '-'}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold">{turnaround}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
