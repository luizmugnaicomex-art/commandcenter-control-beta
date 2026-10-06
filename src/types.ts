export type TruckStatus = 'Awaiting Call' | 'Called/In Transit' | 'Physical Line' | 'In Yard' | 'Operated' | 'NO SHOW';

export const YARD_ZONES = ['Warehouse A', 'Warehouse B', 'Dock 1', 'Dock 2'] as const;
export type YardZone = typeof YARD_ZONES[number];

export interface TruckAppointment {
  id: string;
  carrier: string;
  driver: string;
  driverCpf?: string;
  licensePlate: string;
  containerId: string;
  blNumber: string;
  status: TruckStatus;
  scheduledTime: string;
  slotId: string;
  targetDate?: string;
  gateInTime?: string;
  entryGate?: string;
  unloadingLocation?: string;
  gateOutTime?: string;
  isBitrem?: boolean;
  containerId2?: string;
  noShowCount?: number;
  isSpecialWindow?: boolean;
  freeTimeExpiration?: string;
  isEnRoute?: boolean;
  gatePin?: string;
}


export interface YardSlot {
  id: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  capacity: number;
  status: 'Completed' | 'Active' | 'Upcoming';
}

export interface BlacklistedDriver {
  cpf: string;
  name: string;
  reason: string;
}

export interface MasterPlanItem {
  id: string;
  containerId: string;
  blNumber: string;
  targetDate: string;
  carrierName: string;
  deliverySite: string;
  demurrageDate: string;
  operationType?: string;
  vessel?: string;
  shipowner?: string;
  materialType?: string;
  model?: string;
  containerCost?: string;
  excelStatus?: string;
  status: string;
}

export interface KPIStats {
  todayTotalScheduled: number;
  gateInCount: number;
  avgTurnaroundTimeMinutes: number;
}
