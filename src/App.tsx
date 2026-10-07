/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { getCurrentSlot, getNextOpenSlot, OperationType, handleFirestoreError, cleanForFirestore, generateGatePin } from './utils';
import { mockSlots, loadDailyPlan } from './mockData';
import { TruckAppointment, MasterPlanItem } from './types';
import { InternalDashboard } from './components/InternalDashboard';
import { CarrierPortal } from './components/CarrierPortal';
import { MobileClerkApp } from './components/MobileClerkApp';
import { Login, UserRole, UserDetails } from './components/Login';
import { Language, t } from './i18n';
import { cn } from './utils';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { LayoutDashboard, Kanban, Zap, Calendar, FileText, Bell, LogOut, Truck } from 'lucide-react';

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
  const [lang, setLang] = useState<Language>('en');

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

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
    
    let q;
    if (userRole === 'Carrier' && userDetails?.uid) {
      q = query(collection(db, 'appointments'), where('carrierId', '==', userDetails.uid));
    } else {
      q = query(collection(db, 'appointments'));
    }

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
  }, [userRole, userDetails?.uid]);

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
        const initial = loadDailyPlan().map(m => ({ ...m, targetDate: todayStr }));
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
      setMasterPlan(loadDailyPlan().map(m => ({ ...m, targetDate: todayStr })));
    });
    
    return () => unsubscribe();
  }, [userRole]);

  const filteredAppointments = appointments.filter(a => {
    const recordDate = a.targetDate || todayStr;
    return recordDate === selectedDate;
  });

  const filteredMasterPlan = masterPlan.filter(m => {
    const recordDate = m.targetDate || todayStr;
    return recordDate === selectedDate;
  });

  const handleUploadMasterPlan = async (items: MasterPlanItem[]) => {
    try {
      const batch = writeBatch(db);
      const updatedItems = items.map(item => ({ ...item, targetDate: selectedDate }));
      updatedItems.forEach(item => {
        const docRef = doc(db, 'masterPlan', item.id);
        batch.set(docRef, item);
      });
      await batch.commit();
      setMasterPlan(updatedItems);
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
        role: role,
        razaoSocial: role === 'Carrier' ? 'My Transport Co.' : 'BYD Operations'
      });
    }
    if (role === 'Carrier') {
      setActiveView('carrier');
    } else {
      setActiveView('coordinator');
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setUserDetails(null);
  };

  const handleCallNext = async () => {
    if (!nextSlot) return;
    
    try {
      const batch = writeBatch(db);
      filteredAppointments.forEach(apt => {
        if (apt.slotId === nextSlot.id && apt.status === 'Awaiting Call') {
          const aptRef = doc(db, 'appointments', apt.id);
          batch.update(aptRef, { status: 'Called/In Transit' });
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
      targetDate: selectedDate,
      gatePin: newAppointmentData.gatePin || generateGatePin(),
      carrierId: userDetails?.uid || '',
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'appointments', id), cleanForFirestore(newAppointment));
      alert("Booking confirmed successfully for " + selectedDate + "!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `appointments/${id}`);
    }
  };

  const handleCreateSpecialWindow = async (newAppointmentData: Omit<TruckAppointment, 'id' | 'status'>) => {
    const id = `t${Date.now()}`;
    const newAppointment = {
      ...newAppointmentData,
      status: 'Awaiting Call',
      targetDate: selectedDate,
      isSpecialWindow: true,
      gatePin: newAppointmentData.gatePin || generateGatePin(),
      carrierId: userDetails?.uid || '',
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

  const handleScheduleBacklog = async (item: MasterPlanItem) => {
    try {
      const slot = mockSlots[0];
      const appointmentId = `t${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const batch = writeBatch(db);

      const newAppointment = {
        carrier: item.carrierName || 'BYD Operations',
        driver: 'Assigned Driver',
        licensePlate: `BYD-${Math.floor(Math.random() * 9000 + 1000)}`,
        containerId: item.containerId,
        blNumber: item.blNumber,
        scheduledTime: slot.startTime,
        slotId: slot.id,
        unloadingLocation: item.deliverySite || 'Warehouse A',
        targetDate: selectedDate,
        status: 'Awaiting Call',
        gatePin: generateGatePin(),
        carrierId: userDetails?.uid || '',
        createdAt: new Date().toISOString()
      };

      const aptRef = doc(db, 'appointments', appointmentId);
      batch.set(aptRef, cleanForFirestore(newAppointment));

      const planRef = doc(db, 'masterPlan', item.id);
      batch.update(planRef, cleanForFirestore({ status: 'MATCHED', excelStatus: 'SCHEDULED' }));

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `appointments/masterPlan`);
    }
  };

  const handleAutoSchedulePending = async () => {
    try {
      const pendingItems = masterPlan.filter(item => 
        item.targetDate === selectedDate && 
        !appointments.some(a => a.containerId === item.containerId || a.blNumber === item.blNumber)
      );

      if (pendingItems.length === 0) {
        alert('No missing bookings found to auto-schedule for this date.');
        return;
      }

      const batch = writeBatch(db);
      let scheduledCount = 0;

      pendingItems.forEach((item, index) => {
        const slot = mockSlots[index % mockSlots.length];
        const appointmentId = `t${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;
        
        const newAppointment = {
          carrier: item.carrierName || 'BYD Operations',
          driver: 'Assigned Driver',
          licensePlate: `BYD-${Math.floor(Math.random() * 9000 + 1000)}`,
          containerId: item.containerId,
          blNumber: item.blNumber,
          scheduledTime: slot.startTime,
          slotId: slot.id,
          unloadingLocation: item.deliverySite || 'Warehouse A',
          targetDate: selectedDate,
          status: 'Awaiting Call',
          gatePin: generateGatePin(),
          carrierId: userDetails?.uid || '',
          createdAt: new Date().toISOString()
        };

        const aptRef = doc(db, 'appointments', appointmentId);
        batch.set(aptRef, cleanForFirestore(newAppointment));

        const planRef = doc(db, 'masterPlan', item.id);
        batch.update(planRef, cleanForFirestore({ status: 'MATCHED', excelStatus: 'AUTO-SCHEDULED' }));
        scheduledCount++;
      });

      await batch.commit();
      alert(`⚡ Successfully auto-scheduled ${scheduledCount} missing booking(s) into available yard slots!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'appointments/masterPlan');
    }
  };

  const handleFactoryReset = async () => {
    // 1. Double Confirmation
    const isSure = window.confirm("⚠️ DANGER: Are you absolutely sure you want to WIPE ALL system data? This will delete all appointments and master plan records from Firestore. This CANNOT be undone.");
    if (!isSure) return;
    
    const isDoubleSure = window.confirm("Please confirm one more time to execute the HARD RESET.");
    if (!isDoubleSure) return;

    try {
      let deletedCount = 0;
      let batch = writeBatch(db);
      let opCount = 0;

      // 2. Fetch and delete all appointments from Firestore
      const aptSnapshot = await getDocs(collection(db, 'appointments'));
      for (const d of aptSnapshot.docs) {
        batch.delete(d.ref);
        opCount++;
        deletedCount++;
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }

      // 3. Fetch and delete all masterPlan items from Firestore
      const planSnapshot = await getDocs(collection(db, 'masterPlan'));
      for (const d of planSnapshot.docs) {
        batch.delete(d.ref);
        opCount++;
        deletedCount++;
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }

      alert(`✅ System Reset Successful. Deleted ${deletedCount} records from Firestore.`);
      window.location.reload();
    } catch (error) {
      console.error("Reset failed: ", error);
      alert("Error wiping data: " + (error instanceof Error ? error.message : String(error)));
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

  const handleRevertBackward = async (id: string) => {
    const apt = appointments.find(a => a.id === id);
    if (!apt) return;

    let updateData: any = {};
    if (apt.status === 'Operated') {
      updateData = { status: 'In Yard', gateOutTime: null };
    } else if (apt.status === 'In Yard') {
      updateData = { status: 'Physical Line', gateInTime: null, entryGate: null, unloadingLocation: null };
    } else if (apt.status === 'Physical Line') {
      updateData = { status: 'Called/In Transit' };
    } else if (apt.status === 'Called/In Transit') {
      updateData = { status: 'Awaiting Call' };
    }

    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore(updateData));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleNoShow = async (id: string) => {
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({ status: 'NO SHOW' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleMarkEnRoute = async (id: string) => {
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({ isEnRoute: true }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleReschedule = async (id: string, newSlotId: string) => {
    const slot = mockSlots.find(s => s.id === newSlotId);
    if (!slot) return;
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({
        status: 'Awaiting Call',
        slotId: slot.id,
        scheduledTime: slot.startTime,
        isEnRoute: false
      }));
      alert("Appointment successfully rescheduled to slot " + slot.startTime + "!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  // Task 3: Carrier Edit Autonomy
  const handleUpdateAppointment = async (id: string, updatedData: Partial<TruckAppointment>) => {
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore(updatedData));
      alert("Booking updated successfully!");
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

  const handleArrivedAtLine = async (id: string) => {
    const aptRef = doc(db, 'appointments', id);
    try {
      await updateDoc(aptRef, cleanForFirestore({ status: 'Physical Line' }));
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

  const handleCloseDaySweep = async () => {
    if (!window.confirm(`Are you sure you want to close the day (${selectedDate}) and sweep all pending/unattended trucks to NO SHOW?`)) return;
    
    try {
      const batch = writeBatch(db);
      let count = 0;
      appointments.forEach(apt => {
        const isTargetDay = apt.targetDate === selectedDate || !apt.targetDate;
        const isPending = apt.status === 'Awaiting Call' || apt.status === 'Called/In Transit' || apt.status === 'Physical Line';
        if (isTargetDay && isPending) {
          const aptRef = doc(db, 'appointments', apt.id);
          batch.update(aptRef, { status: 'NO SHOW', noShowCount: (apt.noShowCount || 0) + 1 });
          count++;
        }
      });
      await batch.commit();
      alert(`✅ End-of-Day Sweep Complete: ${count} unattended appointment(s) moved to NO SHOW and capacity released.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  if (userRole === 'Clerk') {
    return (
      <MobileClerkApp 
        appointments={appointments}
        onArrivedAtLine={handleArrivedAtLine}
        onGateIn={handleGateIn}
        onLogout={handleLogout}
        clerkName={userDetails?.razaoSocial || userDetails?.email || 'Logistics Clerk'}
        selectedDate={selectedDate}
      />
    );
  }

  if (!userRole) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen w-screen bg-slate-50 flex font-sans text-slate-900 overflow-hidden">
      {/* Persistent Left Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div className="flex flex-col">
          {/* Brand Logo Header */}
          <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800 bg-slate-950/50">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/BYD_logo.svg/2560px-BYD_logo.svg.png" alt="BYD Logo" className="h-6 object-contain bg-white px-1.5 py-0.5 rounded-sm" />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-wider text-white">BYD YMS</span>
              <span className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">
                {userRole === 'Carrier' ? t('carrierPortalTitle', lang) : t('enterpriseYms', lang)}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {userRole === 'Admin' && (
              <>
                <button
                  onClick={() => { setActiveView('coordinator'); setActiveTab('dashboard'); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                    activeView === 'coordinator' && activeTab === 'dashboard' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {t('dashboard', lang)}
                </button>

                <button
                  onClick={() => { setActiveView('coordinator'); setActiveTab('kanban'); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                    activeView === 'coordinator' && activeTab === 'kanban' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                  <Kanban className="w-4 h-4" />
                  {t('kanban', lang)}
                </button>

                <button
                  onClick={() => { setActiveView('coordinator'); setActiveTab('loading'); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                    activeView === 'coordinator' && activeTab === 'loading' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                  <Zap className="w-4 h-4" />
                  {t('loading', lang)}
                </button>

                <button
                  onClick={() => { setActiveView('coordinator'); setActiveTab('masterPlan'); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                    activeView === 'coordinator' && activeTab === 'masterPlan' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  {t('masterPlan', lang)}
                </button>

                <button
                  onClick={() => { setActiveView('coordinator'); setActiveTab('report'); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors",
                    activeView === 'coordinator' && activeTab === 'report' ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                  <FileText className="w-4 h-4" />
                  {t('report', lang)}
                </button>

                <button
                  onClick={() => setActiveView(activeView === 'coordinator' ? 'carrier' : 'coordinator')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border-t border-slate-800 mt-4 pt-4",
                    activeView === 'carrier' ? "bg-purple-600 text-white shadow-sm" : "hover:bg-slate-800 text-purple-400 hover:text-purple-300"
                  )}
                >
                  <Truck className="w-4 h-4" />
                  {activeView === 'coordinator' ? t('switchToCarrier', lang) : t('switchToCoordinator', lang)}
                </button>
              </>
            )}

            {userRole === 'Carrier' && (
              <>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{t('carrierMenu', lang)}</div>
                <button
                  onClick={() => setActiveView('carrier')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-purple-600 text-white shadow-sm"
                >
                  <Truck className="w-4 h-4" />
                  {t('bookAndBookings', lang)}
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex items-center justify-between">
          <div className="flex flex-col truncate">
            <span className="text-xs font-bold text-white truncate">{userDetails?.razaoSocial || userDetails?.email || 'User'}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">{userRole}</span>
          </div>
          <button 
            onClick={handleLogout}
            title={t('logOut', lang)}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Right Column */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        {/* Clean White Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              {activeView === 'carrier' ? t('carrierPortalTitle', lang) : `${t('enterpriseYms', lang)} > ${activeTab.toUpperCase()}`}
            </h1>
            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-widest">
              {t('liveProduction', lang)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Toggle Button */}
            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors shadow-sm"
              title="Switch Language / 切换语言"
            >
              <span>🌐</span>
              <span>{lang === 'en' ? '中文 (简体)' : 'English'}</span>
            </button>

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
                {(userDetails?.email || userRole || 'C')[0].toUpperCase()}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-xs font-bold text-slate-800 leading-none">{userRole}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{userDetails?.razaoSocial || 'BYD Operations'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Canvas Area */}
        {userRole === 'Admin' && activeView === 'coordinator' ? (
          <InternalDashboard 
            appointments={filteredAppointments}
            masterPlan={filteredMasterPlan}
            onUploadMasterPlan={handleUploadMasterPlan}
            onUpdateMasterPlanItem={handleUpdateMasterPlanItem}
            currentSlot={currentSlot}
            nextSlot={nextSlot}
            onCallNext={handleCallNext}
            onAssignLocation={handleAssignLocation}
            onGateOut={handleGateOut}
            onRevertToYard={handleRevertBackward}
            onCallTruck={handleCallTruck}
            onGateIn={handleGateIn}
            onArrivedAtLine={handleArrivedAtLine}
            onNoShow={handleNoShow}
            onCreateSpecialWindow={handleCreateSpecialWindow}
            activeTab={activeTab}
            selectedDate={selectedDate}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onToday={handleToday}
            lang={lang}
            onCloseDaySweep={handleCloseDaySweep}
            onAutoSchedulePending={handleAutoSchedulePending}
            onScheduleBacklog={handleScheduleBacklog}
            onFactoryReset={handleFactoryReset}
            userRole={userRole}
          />
        ) : (
          <CarrierPortal 
            appointments={filteredAppointments}
            carrierName={userDetails?.razaoSocial || userDetails?.email || 'My Transport Co.'}
            onBookSlot={handleBookSlot}
            onMarkEnRoute={handleMarkEnRoute}
            onReschedule={handleReschedule}
            onUpdateAppointment={handleUpdateAppointment}
            lang={lang}
          />
        )}
      </div>
    </div>
  );
}
