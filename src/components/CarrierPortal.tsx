import { useState, FormEvent, useEffect, useMemo } from 'react';
import { TruckAppointment, YardSlot } from '../types';
import { mockSlots, mockBlacklistedDrivers } from '../mockData';
import { cn, getSlotCapacityUsage } from '../utils';
import { StatusBadge } from './VirtualQueue';

interface CarrierPortalProps {
  appointments: TruckAppointment[];
  carrierName?: string;
  onBookSlot: (appointment: Omit<TruckAppointment, 'id' | 'status'>) => void;
}

export function CarrierPortal({ appointments, carrierName = 'My Transport Co.', onBookSlot }: CarrierPortalProps) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  const [bookingDate, setBookingDate] = useState(today);
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      setCurrentTimeStr(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    };
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const [licensePlate, setLicensePlate] = useState('');
  const [isBitrem, setIsBitrem] = useState(false);
  const [isSpecialWindow, setIsSpecialWindow] = useState(false);
  const [containerId, setContainerId] = useState('');
  const [containerId2, setContainerId2] = useState('');
  const [blNumber, setBlNumber] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverCpf, setDriverCpf] = useState('');
  
  // For simplicity, we just show appointments booked by this carrier
  const myAppointments = appointments.filter(a => a.carrier === carrierName);

  const weight = isBitrem ? 2 : 1;
  
  const isBlacklisted = useMemo(() => {
    return mockBlacklistedDrivers.some(driver => driver.cpf === driverCpf.trim());
  }, [driverCpf]);
  
  const isFormValid = Boolean(
    bookingDate &&
    driverName.trim() &&
    driverCpf.trim() &&
    !isBlacklisted &&
    licensePlate.trim() &&
    containerId.trim() &&
    (!isBitrem || containerId2.trim()) &&
    blNumber.trim() &&
    selectedSlotId
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const slot = mockSlots.find(s => s.id === selectedSlotId);
    if (!slot) return;
    
    const isPast = slot.status === 'Completed';
    const isExpiredRealTime = bookingDate === today && currentTimeStr > slot.startTime;
    if (isPast || isExpiredRealTime) {
      alert("This slot has expired. Please select another slot.");
      return;
    }

    onBookSlot({
      carrier: carrierName,
      driver: driverName,
      driverCpf,
      licensePlate,
      containerId,
      blNumber,
      scheduledTime: slot.startTime,
      slotId: slot.id,
      isBitrem,
      containerId2: isBitrem ? containerId2 : undefined,
      isSpecialWindow
    });

    setLicensePlate('');
    setContainerId('');
    setContainerId2('');
    setIsBitrem(false);
    setIsSpecialWindow(false);
    setBlNumber('');
    setDriverName('');
    setDriverCpf('');
    setSelectedSlotId('');
  };

  return (
    <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 md:p-8 flex flex-col gap-8 overflow-y-auto bg-slate-50">
      <div className="text-center mb-4">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Book Your Arrival</h2>
        <p className="text-slate-500 mt-2">Reserve a time slot for container delivery or pickup.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="isBitrem"
                checked={isBitrem}
                onChange={(e) => setIsBitrem(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="isBitrem" className="text-sm font-bold uppercase tracking-wide text-slate-700">
                Bitrem (Double Trailer)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="isSpecialWindow"
                checked={isSpecialWindow}
                onChange={(e) => setIsSpecialWindow(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500"
              />
              <label htmlFor="isSpecialWindow" className="text-sm font-bold uppercase tracking-wide text-purple-700">
                Special Window Request
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold uppercase tracking-wide text-slate-600">Booking Date</label>
              <input 
                type="date" 
                value={bookingDate}
                min={today}
                max={tomorrow}
                onChange={(e) => setBookingDate(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold uppercase tracking-wide text-slate-600">Driver Name</label>
              <input 
                type="text" 
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="John Doe"
                className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold uppercase tracking-wide text-slate-600">Driver CPF</label>
              <input 
                type="text" 
                value={driverCpf}
                onChange={(e) => setDriverCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold uppercase tracking-wide text-slate-600">License Plate</label>
              <input 
                type="text" 
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="ABC-1234"
                className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold uppercase tracking-wide text-slate-600">Container ID {isBitrem ? '1' : ''}</label>
              <input 
                type="text" 
                value={containerId}
                onChange={(e) => setContainerId(e.target.value.toUpperCase())}
                placeholder="MSCU1234567"
                className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            {isBitrem && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold uppercase tracking-wide text-slate-600">Container ID 2</label>
                <input 
                  type="text" 
                  value={containerId2}
                  onChange={(e) => setContainerId2(e.target.value.toUpperCase())}
                  placeholder="HLXU9988776"
                  className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold uppercase tracking-wide text-slate-600">BL Number</label>
              <input 
                type="text" 
                value={blNumber}
                onChange={(e) => setBlNumber(e.target.value.toUpperCase())}
                placeholder="BL-123456"
                className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold uppercase tracking-wide text-slate-600">Select Available Slot</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               {mockSlots.map(slot => {
                const isPast = slot.status === 'Completed';
                const isExpiredRealTime = bookingDate === today && currentTimeStr > slot.startTime;
                const isExpired = isPast || isExpiredRealTime;
                const usage = getSlotCapacityUsage(slot.id, appointments);
                const available = slot.capacity - usage;
                const isFull = available < weight && !isSpecialWindow;
                const isDisabled = isExpired || isFull;
                
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded border text-sm font-bold transition-colors",
                      isDisabled 
                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60" 
                        : selectedSlotId === slot.id
                          ? "bg-blue-600 border-blue-700 text-white shadow-md"
                          : "bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                    )}
                  >
                    <span>{slot.startTime} - {slot.endTime}</span>
                    <span className={cn(
                      "text-[10px] uppercase mt-1",
                      selectedSlotId === slot.id ? "text-blue-100" : (isDisabled ? "text-slate-400" : (isSpecialWindow && available < weight ? "text-purple-600" : "text-green-600"))
                    )}>
                      {isExpired ? 'EXPIRED' : (isSpecialWindow && available < weight) ? 'Special Req.' : isFull ? 'Full' : `${available} Left`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isBlacklisted && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm font-bold">
              🚨 ACCESS DENIED: This driver is currently blocked from entering the facility due to security restrictions. Please assign a different driver or contact administration.
            </div>
          )}

          <button 
            type="submit"
            disabled={!isFormValid}
            className="mt-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm py-4 rounded shadow-md transition-colors"
          >
            Confirm Appointment
          </button>
        </form>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-white">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">My Appointments Today</h3>
        </div>
        <div className="overflow-auto">
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
              {myAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs uppercase font-bold tracking-wide">
                    No appointments scheduled yet
                  </td>
                </tr>
              ) : (
                myAppointments.map(apt => {
                  const slot = mockSlots.find(s => s.id === apt.slotId);
                  const slotDisplay = slot ? `${slot.startTime} - ${slot.endTime}` : apt.scheduledTime;
                  
                  return (
                    <tr key={apt.id} className="hover:bg-slate-50 transition-colors text-xs items-center">
                      <td className="px-4 py-3 font-medium truncate">
                        {apt.carrier}
                        <div className="text-[10px] text-slate-400 mt-0.5">Slot: {slotDisplay}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {apt.driver}
                        {apt.driverCpf && <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{apt.driverCpf}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold">{apt.licensePlate}</td>
                      <td className="px-4 py-3 font-mono font-bold">
                        <div className="flex flex-col">
                          <span>{apt.containerId}</span>
                          {apt.isBitrem && apt.containerId2 && (
                            <span className="text-amber-600 mt-0.5">{apt.containerId2} <span className="text-[9px] uppercase border border-amber-300 bg-amber-50 px-1 rounded text-amber-700 ml-1">Bitrem</span></span>
                          )}
                        </div>
                      </td>
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
    </main>
  );
}
