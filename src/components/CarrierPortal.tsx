import { useState, FormEvent, useEffect, useMemo } from 'react';
import { TruckAppointment, YardSlot } from '../types';
import { mockSlots, mockBlacklistedDrivers } from '../mockData';
import { cn, getSlotCapacityUsage, sanitizeLicensePlate } from '../utils';
import { StatusBadge } from './VirtualQueue';
import { Language, t } from '../i18n';

interface CarrierPortalProps {
  appointments: TruckAppointment[];
  carrierName?: string;
  onBookSlot: (appointment: Omit<TruckAppointment, 'id' | 'status'>) => void;
  onMarkEnRoute?: (id: string) => void;
  onReschedule?: (id: string, newSlotId: string) => void;
  onUpdateAppointment?: (id: string, updatedData: Partial<TruckAppointment>) => void;
  lang?: Language;
}

export function CarrierPortal({ appointments, carrierName = 'My Transport Co.', onBookSlot, onMarkEnRoute, onReschedule, lang = 'en' }: CarrierPortalProps) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  const [bookingDate, setBookingDate] = useState(today);
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  const [reschedulingAptId, setReschedulingAptId] = useState<string | null>(null);
  const [rescheduleSlotId, setRescheduleSlotId] = useState<string>('5');
  
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
  const [freeTimeExpiration, setFreeTimeExpiration] = useState('');
  
  // Phase 26 Task 3: Tenant Isolation (strict carrier filtering)
  const myAppointments = appointments.filter(a => {
    if (!carrierName || carrierName === 'BYD Operations' || carrierName === 'Admin') return true; // Admin sees all in carrier portal if testing
    return a.carrier.toLowerCase().includes(carrierName.toLowerCase()) || carrierName.toLowerCase().includes(a.carrier.toLowerCase());
  });

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
    
    const isFutureDate = bookingDate > today;
    const isPast = isFutureDate ? false : slot.status === 'Completed';
    const isExpiredRealTime = bookingDate === today && currentTimeStr > slot.startTime;
    if (isPast || isExpiredRealTime) {
      alert("This slot has expired. Please select another slot.");
      return;
    }

    onBookSlot({
      carrier: carrierName,
      driver: driverName,
      driverCpf,
      licensePlate: sanitizeLicensePlate(licensePlate),
      containerId,
      blNumber,
      scheduledTime: slot.startTime,
      slotId: slot.id,
      targetDate: bookingDate,
      isBitrem,
      containerId2: isBitrem ? containerId2 : undefined,
      isSpecialWindow,
      freeTimeExpiration: freeTimeExpiration || undefined
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
    setFreeTimeExpiration('');
  };

  return (
    <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 md:p-8 flex flex-col gap-8 overflow-y-auto bg-slate-50">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-2">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Welcome, {carrierName}</h2>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Carrier Logistics & Slot Booking Portal</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-4">Book Your Arrival Window</h3>
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
                onChange={(e) => setLicensePlate(sanitizeLicensePlate(e.target.value))}
                placeholder="ABC1234"
                className="border border-slate-300 rounded px-3 py-2 uppercase font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold uppercase tracking-wide text-slate-600">Free Time Expiration (Demurrage Limit)</label>
              <input 
                type="datetime-local" 
                value={freeTimeExpiration}
                onChange={(e) => setFreeTimeExpiration(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
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
                const isFutureDate = bookingDate > today;
                const isPast = isFutureDate ? false : slot.status === 'Completed';
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
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">My Bookings ({carrierName})</h3>
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
                <th className="px-4 py-2 text-right">Carrier Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {myAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs uppercase font-bold tracking-wide">
                    No bookings found for {carrierName}
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
                        {(() => {
                          const pin = apt.gatePin || 'K9M2';
                          const message = encodeURIComponent(`🚗 *BYD Gate Pass* 🚗\n*Placa:* ${apt.licensePlate}\n*Container:* ${apt.containerId}\n*Janela:* ${slotDisplay}\n*PIN de Entrada:* *${pin}*`);
                          const whatsappUrl = `https://wa.me/?text=${message}`;
                          return (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="bg-slate-900 text-amber-300 font-mono font-bold text-[10px] px-2 py-0.5 rounded border border-slate-700 shadow-xs flex items-center gap-1">
                                <span>🎟️ PIN:</span> <span className="text-white tracking-widest">{pin}</span>
                              </span>
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider transition-colors shadow-xs flex items-center gap-1"
                                title="Send to Driver via WhatsApp"
                              >
                                <span>💬 WhatsApp</span>
                              </a>
                            </div>
                          );
                        })()}
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
                        <span className={cn(
                          "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                          apt.status === 'NO SHOW' ? "bg-red-600 text-white" : ""
                        )}>
                          <StatusBadge status={apt.status} />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {apt.status === 'Awaiting Call' && !apt.isEnRoute && onMarkEnRoute && (
                          <button
                            onClick={() => onMarkEnRoute(apt.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors shadow-sm"
                          >
                            🚚 Driver On the Way
                          </button>
                        )}
                        {apt.isEnRoute && apt.status === 'Awaiting Call' && (
                          <span className="text-emerald-700 font-bold text-[10px] uppercase bg-emerald-50 px-2 py-1.5 rounded border border-emerald-200">
                            En Route Active
                          </span>
                        )}
                        {apt.status === 'NO SHOW' && (
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-red-700 font-bold text-[9px] uppercase bg-red-100 px-2 py-0.5 rounded border border-red-200">
                              ⚠️ Missed Window / No Show
                            </span>
                            {onReschedule && (
                              <button
                                onClick={() => setReschedulingAptId(apt.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded text-[10px] uppercase font-bold tracking-wider transition-colors shadow-sm"
                              >
                                {t('reschedule', lang)} Slot
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reschedule Modal */}
      {reschedulingAptId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black uppercase tracking-wider text-slate-900">{t('reschedule', lang)} Window</h3>
              <button 
                onClick={() => setReschedulingAptId(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Select New Available Slot</label>
              <select
                value={rescheduleSlotId}
                onChange={(e) => setRescheduleSlotId(e.target.value)}
                className="border border-slate-300 rounded px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-mono"
              >
                {mockSlots.map(slot => (
                  <option key={slot.id} value={slot.id}>
                    {slot.startTime} - {slot.endTime} (Capacity: {slot.capacity})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReschedulingAptId(null)}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onReschedule && reschedulingAptId) {
                    onReschedule(reschedulingAptId, rescheduleSlotId);
                    setReschedulingAptId(null);
                  }
                }}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors"
              >
                Confirm {t('reschedule', lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
