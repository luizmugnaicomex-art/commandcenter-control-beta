/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { getCurrentSlot, getNextOpenSlot } from './utils';
import { mockAppointments, mockSlots } from './mockData';
import { TruckAppointment } from './types';
import { InternalDashboard } from './components/InternalDashboard';
import { CarrierPortal } from './components/CarrierPortal';
import { Login, UserRole, UserDetails } from './components/Login';
import { cn } from './utils';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

type ViewMode = 'coordinator' | 'carrier';

export default function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [appointments, setAppointments] = useState<TruckAppointment[]>([]);
  const [activeView, setActiveView] = useState<ViewMode>('coordinator');
  
  const currentSlot = getCurrentSlot();
  const nextSlot = getNextOpenSlot(currentSlot.id);

  // Sync appointments from Firestore
  useEffect(() => {
    if (!userRole) return;
    
    const q = query(collection(db, 'appointments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apts: TruckAppointment[] = [];
      snapshot.forEach((doc) => {
        apts.push({ id: doc.id, ...doc.data() } as TruckAppointment);
      });
      setAppointments(apts);
    });
    
    return () => unsubscribe();
  }, [userRole]);

  const handleLogin = (role: UserRole, user?: UserDetails) => {
    setUserRole(role);
    if (user) {
      setUserDetails(user);
    } else {
      // Mock admin user
      setUserDetails({
        uid: 'admin-luiz',
        email: 'luizmugnai.comex@gmail.com',
        role: 'Coordinator',
        razaoSocial: 'BYD Operations'
      });
    }
    setActiveView(role === 'Admin' ? 'coordinator' : 'carrier');
  };

  const handleLogout = () => {
    setUserRole(null);
    setUserDetails(null);
  };

  const handleCallNext = async () => {
    if (!nextSlot) return;
    
    const batch = writeBatch(db);
    appointments.forEach(apt => {
      if (apt.slotId === nextSlot.id && apt.status === 'Awaiting Call') {
        const aptRef = doc(db, 'appointments', apt.id);
        batch.update(aptRef, { status: 'Called/In Transit' });
      }
    });
    
    await batch.commit();
  };

  const handleBookSlot = async (newAppointmentData: Omit<TruckAppointment, 'id' | 'status'>) => {
    const id = `t${Date.now()}`;
    const newAppointment = {
      ...newAppointmentData,
      status: 'Awaiting Call',
      carrierUid: userDetails?.uid || '',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'appointments', id), newAppointment);
  };

  const handleCreateSpecialWindow = async (newAppointmentData: Omit<TruckAppointment, 'id' | 'status'>) => {
    const id = `t${Date.now()}`;
    const newAppointment = {
      ...newAppointmentData,
      status: 'Awaiting Call',
      isSpecialWindow: true,
      carrierUid: userDetails?.uid || '',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'appointments', id), newAppointment);
  };

  const handleAssignLocation = async (id: string, entryGate: string, unloadingLocation: string) => {
    const aptRef = doc(db, 'appointments', id);
    await updateDoc(aptRef, { entryGate, unloadingLocation });
  };

  const handleGateOut = async (id: string) => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const gateOutTime = `${hours}:${minutes}`;

    const aptRef = doc(db, 'appointments', id);
    await updateDoc(aptRef, { status: 'Operated', gateOutTime });
  };

  const handleNoShow = async (id: string) => {
    const apt = appointments.find(a => a.id === id);
    if (!apt) return;
    
    const weight = apt.isBitrem ? 2 : 1;
    const currentSlotIndex = mockSlots.findIndex(s => s.id === apt.slotId);
    
    let targetSlot = null;
    for (let i = currentSlotIndex + 1; i < mockSlots.length; i++) {
      const slot = mockSlots[i];
      const usage = appointments.filter(a => a.slotId === slot.id).reduce((sum, a) => sum + (a.isBitrem ? 2 : 1), 0);
      if (slot.capacity - usage >= weight) {
        targetSlot = slot;
        break;
      }
    }
    
    if (!targetSlot) return; // No capacity left today
    
    const aptRef = doc(db, 'appointments', id);
    await updateDoc(aptRef, {
      slotId: targetSlot.id,
      scheduledTime: targetSlot.startTime,
      noShowCount: (apt.noShowCount || 0) + 1,
      status: 'Awaiting Call',
    });
  };

  const handleCallTruck = async (id: string) => {
    const aptRef = doc(db, 'appointments', id);
    await updateDoc(aptRef, { status: 'Called/In Transit' });
  };

  const handleGateIn = async (id: string) => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const gateInTime = `${hours}:${minutes}`;

    const aptRef = doc(db, 'appointments', id);
    await updateDoc(aptRef, { status: 'In Yard', gateInTime });
  };

  if (!userRole) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className="h-12 md:h-14 bg-slate-900 text-white flex items-center justify-between px-4 border-b border-slate-700 shrink-0">
        <div className="flex items-center space-x-4">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/BYD_logo.svg/2560px-BYD_logo.svg.png" alt="BYD Logo" className="h-6 object-contain bg-white px-1.5 py-0.5 rounded-sm" />
          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>
          <h1 className="text-sm md:text-base font-medium tracking-tight uppercase truncate hidden sm:block">
            {activeView === 'coordinator' ? 'Command Center: Gate & Yard Control' : 'Carrier Booking Portal'}
          </h1>
          <span className="hidden md:inline-block ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-200 border border-blue-500/30 uppercase tracking-widest">
            Soft Launch
          </span>
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          {userRole === 'Admin' && (
            <div className="flex bg-slate-800 p-0.5 rounded border border-slate-700">
              <button
                onClick={() => setActiveView('coordinator')}
                className={cn(
                  "px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors",
                  activeView === 'coordinator' ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Coordinator
              </button>
              <button
                onClick={() => setActiveView('carrier')}
                className={cn(
                  "px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors",
                  activeView === 'carrier' ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Carrier
              </button>
            </div>
          )}
          
          {activeView === 'coordinator' && (
            <div className="hidden lg:flex items-center space-x-4 border-l border-slate-700 pl-4 ml-1">
              <div className="text-right">
                <div className="text-[9px] text-slate-400 uppercase tracking-widest">
                  BLOCO {mockSlots.findIndex(s => s.id === currentSlot.id) + 1} / {mockSlots.length} &bull; Current Slot
                </div>
                <div className="text-xs font-mono">{currentSlot.startTime} - {currentSlot.endTime}</div>
              </div>
              {currentSlot.status !== 'Active' ? (
                 <div className="px-2 py-1 bg-red-900/50 border border-red-500/50 rounded-full flex items-center space-x-1.5">
                   <span className="h-1.5 w-1.5 bg-red-500 rounded-full"></span>
                   <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">PAUSED</span>
                 </div>
              ) : (
                 <div className="px-2 py-1 bg-green-900/50 border border-green-500/50 rounded-full flex items-center space-x-1.5">
                   <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                   <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">System Active</span>
                 </div>
              )}
            </div>
          )}
          
          <button 
            onClick={handleLogout}
            className="text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-colors"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Content Area Routing */}
      {activeView === 'coordinator' ? (
        <InternalDashboard 
          appointments={appointments}
          currentSlot={currentSlot}
          nextSlot={nextSlot}
          onCallNext={handleCallNext}
          onAssignLocation={handleAssignLocation}
          onGateOut={handleGateOut}
          onCallTruck={handleCallTruck}
          onGateIn={handleGateIn}
          onNoShow={handleNoShow}
          onCreateSpecialWindow={handleCreateSpecialWindow}
        />
      ) : (
        <CarrierPortal 
          appointments={appointments}
          carrierName={userDetails?.razaoSocial || userDetails?.email || 'Carrier'}
          onBookSlot={handleBookSlot}
        />
      )}
    </div>
  );
}
