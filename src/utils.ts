import { YardSlot } from './types';
import { mockSlots } from './mockData';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
