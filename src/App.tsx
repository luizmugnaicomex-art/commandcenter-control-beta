/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { getCurrentSlot, getNextOpenSlot, OperationType, handleFirestoreError, cleanForFirestore } from './utils';
import { mockSlots, loadDailyPlan } from './mockData';
import { TruckAppointment, MasterPlanItem } from './types';
import { InternalDashboard } from './components/InternalDashboard';
import { CarrierPortal } from './components/CarrierPortal';
import { Login, UserRole, UserDetails } from './components/Login';
import { cn } from './utils';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { LayoutDashboard, Kanban, Zap, Calendar, FileText, Bell, LogOut, ShieldCheck, Truck } from 'lucide-react';

type ViewMode = 'coordinator' | 'carrier';
type SidebarTab = 'dashboard' | 'kanban' | 'loading' | 'masterPlan' | 'report';

export default function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [appointments, setAppointments] = useState<TruckAppointment[]>([]);
  const [masterPlan, setMasterPlan] = useState<MasterPlanItem[]>([]);
  const [activeView, setActiveView] = useState<ViewMode>('coordinator');
  const [activeTab, setActiveTab] = useState<SidebarTab>('kanban');
  const [clockStr, setClockStr] = useState<string>('');

  const currentSlot = getCurrentSlot();
  const nextSlot = getNextOpenSlot(currentSlot.id);

  // Live Digital Clock timer
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockStr(now.toLocaleTimeString());
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global handler for AbortError unhandled rejections
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'AbortError' || String(event.reason)?.includes('AbortError')) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });
    
    return () => unsubscribe();
  }, [userRole]);

  // Sync masterPlan from Firestore
  useEffect(() => {
    if (!userRole) return;
    
    const q = query(collection(db, 'masterPlan'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: MasterPlanItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as MasterPlanItem);
      });
      if (items.length === 0) {
        const initial = loadDailyPlan();
        initial.forEach(async (item) => {
          try {
            await setDoc(doc(db, 'masterPlan', item.id), item);
          } catch (e) {}
        });
        setMasterPlan(initial);
      } else {
        setMasterPlan(items);
      }
    }, (error) => {
      console.warn("Master plan sync warning:", error);
      setMasterPlan(loadDailyPlan());
    });
    
    return () => unsubscribe();
  }, [userRole]);

  const handleUploadMasterPlan = async (items: MasterPlanItem[]) => {
    try {
      const batch = writeBatch(db);
      items.forEach(item => {
        const docRef = doc(db, 'masterPlan', item.id);
        batch.set(docRef, item);
      });
      await batch.commit();
      setMasterPlan(items);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'masterPlan');
    }
  };

  const handleUpdateMasterPlanItem = async (updatedItem: MasterPlanItem) => {
    try {
      const docRef = doc(db, 'masterPlan', updatedItem.id);
      await setDoc(docRef, updatedItem, { merge: true });
      setMasterPlan(prev => prev.map(p => p.id === updatedItem.id ? updatedItem : p));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `masterPlan/${updatedItem.id}`);
    }
  };

  const handleLogin = (role: UserRole, user?: UserDetails) => {
    setUserRole(role);
    if (user) {
      setUserDetails(user);
    } else {
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
    
    try {
      const batch = writeBatch(db);
      const calledApts: TruckAppointment[] = [];
      appointments.forEach(apt => {
        if (apt.slotId === nextSlot.id && apt.status === 'Awaiting Call') {
          const aptRef = doc(db, 'appointments', apt.id);
          batch.update(aptRef, { status: 'Called/In Transit' });
          calledApts.push(apt);
        }
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const handleBookSlot = async (newAppointmentData: Omit<TruckAppointment, 'id' | 'status'>) => {
    const id = `t${Date.now()}`;
    const newAppointment = {
      ...newAppointmentData,
      status: 'Awaiting Call',
      carrierUid: userDetails?.uid || '',
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'appointments', id), cleanForFirestore(newAppointment));
      alert("Booking confirmed successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `appointments/${id}`);
    }
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
    try {
      await setDoc(doc(db, 'appointments', id), cleanForFirestore(newAppointment));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `appointments/${id}`);
    }
  };

  const handleAssignLocation = async (id: string, entryGate: string, unloadingLocation: string) => {
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({ entryGate, unloadingLocation }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleGateOut = async (id: string) => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const gateOutTime = `${hours}:${minutes}`;

    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({ status: 'Operated', gateOutTime }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleRevertToYard = async (id: string) => {
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({ status: 'In Yard', gateOutTime: null }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
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
    
    if (!targetSlot) return;
    
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({
        slotId: targetSlot.id,
        scheduledTime: targetSlot.startTime,
        noShowCount: (apt.noShowCount || 0) + 1,
        status: 'Awaiting Call',
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleCallTruck = async (id: string) => {
    const apt = appointments.find(a => a.id === id);
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({ status: 'Called/In Transit' }));
      if (apt) {
        try {
          await fetch('https://api.fake-whatsapp-gateway.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: '+5511999999999',
              licensePlate: apt.licensePlate,
              message: `Luz Verde! Dirija-se ao Gate para a janela das ${apt.scheduledTime}.`
            })
          });
        } catch (webhookErr) {
          console.warn('Webhook simulation failed:', webhookErr);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleGateIn = async (id: string) => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const gateInTime = `${hours}:${minutes}`;

    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, { status: 'In Yard', gateInTime });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  if (!userRole) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen w-screen bg-slate-50 flex font-sans text-slate-900 overflow-hidden">
      {/* Task 1: Persistent Dark-Themed Left Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div className="flex flex-col">
          {/* Brand Logo Header */}
          <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800 bg-slate-950/50">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/BYD_logo.svg/2560px-BYD_logo.svg.png" alt="BYD Logo" className="h-6 object-contain bg-white px-1.5 py-0.5 rounded-sm" />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-wider text-white">BYD YMS</span>
              <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">Enterprise Command</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setActiveView('coordinator'); setActiveTab('dashboard'); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                activeView === 'coordinator' && activeTab === 'dashboard' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard & Analytics
            </button>

            <button
              onClick={() => { setActiveView('coordinator'); setActiveTab('kanban'); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                activeView === 'coordinator' && activeTab === 'kanban' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              <Kanban className="w-4 h-4" />
              Yard Management (Kanban)
            </button>

            <button
              onClick={() => { setActiveView('coordinator'); setActiveTab('loading'); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                activeView === 'coordinator' && activeTab === 'loading' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              <Zap className="w-4 h-4" />
              Loading Panel (Table & KPIs)
            </button>

            <button
              onClick={() => { setActiveView('coordinator'); setActiveTab('masterPlan'); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                activeView === 'coordinator' && activeTab === 'masterPlan' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              <Calendar className="w-4 h-4" />
              Master Plan & Schedule
            </button>

            <button
              onClick={() => { setActiveView('coordinator'); setActiveTab('report'); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                activeView === 'coordinator' && activeTab === 'report' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              <FileText className="w-4 h-4" />
              Audit Report (Finished)
            </button>

            {userRole === 'Admin' && (
              <button
                onClick={() => setActiveView('carrier')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border-t border-slate-800 mt-4 pt-4",
                  activeView === 'carrier' ? "bg-purple-600 text-white shadow-sm" : "hover:bg-slate-800 text-purple-400 hover:text-purple-300"
                )}
              >
                <Truck className="w-4 h-4" />
                Carrier Portal View
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex items-center justify-between">
          <div className="flex flex-col truncate">
            <span className="text-xs font-bold text-white truncate">{userDetails?.razaoSocial || userDetails?.email || 'Coordinator'}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">{userDetails?.role || 'Operator'}</span>
          </div>
          <button 
            onClick={handleLogout}
            title="Log Out"
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Right Column */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        {/* Task 1: Clean White Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              {activeView === 'carrier' ? 'Carrier Booking Portal' : `Enterprise YMS > ${activeTab.toUpperCase()}`}
            </h1>
            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-widest">
              Live Production
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Prominent Digital Clock */}
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-mono font-bold text-slate-800 tracking-wider">{clockStr}</span>
            </div>

            <button className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {(userDetails?.email || 'C')[0].toUpperCase()}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-xs font-bold text-slate-800 leading-none">{userDetails?.role || 'Coordinator'}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">BYD Operations</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Canvas Area */}
        {activeView === 'coordinator' ? (
          <InternalDashboard 
            appointments={appointments}
            masterPlan={masterPlan}
            onUploadMasterPlan={handleUploadMasterPlan}
            onUpdateMasterPlanItem={handleUpdateMasterPlanItem}
            currentSlot={currentSlot}
            nextSlot={nextSlot}
            onCallNext={handleCallNext}
            onAssignLocation={handleAssignLocation}
            onGateOut={handleGateOut}
            onRevertToYard={handleRevertToYard}
            onCallTruck={handleCallTruck}
            onGateIn={handleGateIn}
            onNoShow={handleNoShow}
            onCreateSpecialWindow={handleCreateSpecialWindow}
            activeTab={activeTab}
          />
        ) : (
          <CarrierPortal 
            appointments={appointments}
            carrierName={userDetails?.razaoSocial || userDetails?.email || 'Carrier'}
            onBookSlot={handleBookSlot}
          />
        )}
      </div>
    </div>
  );
}
