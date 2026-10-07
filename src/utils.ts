import { YardSlot } from './types';
import { mockSlots } from './mockData';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from './firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCurrentSlot(): YardSlot {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const activeSlot = mockSlots.find(s => {
    const [startH, startM] = s.startTime.split(':').map(Number);
    const [endH, endM] = s.endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    
    return currentMinutes >= startMins && currentMinutes < endMins;
  });

  // If outside operating hours, return the very first slot of the day, or the last active one
  return activeSlot || mockSlots[0]; 
}

export function getNextOpenSlot(currentSlotId: string): YardSlot | undefined {
  const currentIndex = mockSlots.findIndex(s => s.id === currentSlotId);
  // Ensure we don't go out of bounds if it's the last slot of the day
  if (currentIndex === -1 || currentIndex >= mockSlots.length - 1) return undefined;
  return mockSlots[currentIndex + 1];
}

export function getSlotCapacityUsage(slotId: string, appointments: import('./types').TruckAppointment[]): number {
  return appointments
    .filter(a => a.slotId === slotId && a.status !== 'NO SHOW' && a.status !== 'Operated')
    .reduce((total, apt) => total + (apt.isBitrem ? 2 : 1), 0);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function sanitizeLicensePlate(plate: string): string {
  return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function isDemurrageRisk(freeTimeExpiration?: string): boolean {
  if (!freeTimeExpiration) return false;
  
  let expDate: number;
  
  // Check if it's in DD/MM/YYYY format
  if (freeTimeExpiration.includes('/')) {
    const parts = freeTimeExpiration.split('/');
    // Assuming DD/MM/YYYY
    if (parts.length === 3) {
      // Month is 0-indexed in JS Date
      expDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
    } else {
      expDate = new Date(freeTimeExpiration).getTime();
    }
  } else {
    expDate = new Date(freeTimeExpiration).getTime();
  }

  if (isNaN(expDate)) return false;
  
  const now = Date.now();
  const diffHours = (expDate - now) / (1000 * 60 * 60);
  
  // Flag as risk if expiring within 48 hours, or if it is already late (down to -24h)
  return diffHours <= 48 && diffHours >= -24;
}

export function cleanForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

export type PunctualityStatus = 'EARLY' | 'ON TIME' | 'LATE';

export function getPunctualityStatus(scheduledTime?: string): { status: PunctualityStatus; label: string; colorClass: string } {
  if (!scheduledTime) return { status: 'ON TIME', label: '✅ ON TIME', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' };

  const parts = scheduledTime.split('-').map(p => p.trim());
  const startStr = parts[0];
  const endStr = parts[1] || startStr;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const startMins = parseMinutes(startStr);
  const endMins = parseMinutes(endStr);

  if (startMins === null || endMins === null) {
    return { status: 'ON TIME', label: '✅ ON TIME', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  }

  if (currentMinutes < startMins - 15) {
    const diff = startMins - currentMinutes;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    const diffLabel = hrs > 0 ? `-${hrs}h ${mins}m` : `-${mins}m`;
    return { status: 'EARLY', label: `⏳ EARLY (${diffLabel})`, colorClass: 'bg-blue-100 text-blue-800 border-blue-200' };
  } else if (currentMinutes > endMins + 15) {
    const diff = currentMinutes - endMins;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    const diffLabel = hrs > 0 ? `+${hrs}h ${mins}m` : `+${mins}m`;
    return { status: 'LATE', label: `🚨 LATE (${diffLabel})`, colorClass: 'bg-red-100 text-red-800 border-red-200' };
  } else {
    return { status: 'ON TIME', label: `✅ ON TIME`, colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  }
}

export function generateGatePin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 4; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}



