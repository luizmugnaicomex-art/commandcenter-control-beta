import { YardSlot } from './types';
import { mockSlots } from './mockData';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from './firebase';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCurrentSlot(): YardSlot {
  return mockSlots.find(s => s.status === 'Active') || mockSlots[3]; // Uses slot id 4 (10:15 - 11:00)
}

export function getNextOpenSlot(currentSlotId: string): YardSlot | undefined {
  const currentIndex = mockSlots.findIndex(s => s.id === currentSlotId);
  return mockSlots[currentIndex + 1];
}

export function getSlotCapacityUsage(slotId: string, appointments: import('./types').TruckAppointment[]): number {
  return appointments
    .filter(a => a.slotId === slotId)
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
  const expDate = new Date(freeTimeExpiration).getTime();
  if (isNaN(expDate)) return false;
  const now = Date.now();
  const diffHours = (expDate - now) / (1000 * 60 * 60);
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


