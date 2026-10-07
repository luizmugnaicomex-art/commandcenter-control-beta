export type TruckStatus = 'Awaiting Call' | 'Called/In Transit' | 'Physical Line' | 'In Yard' | 'Operated' | 'NO SHOW';

// Updated to reflect the actual delivery sites from your Master Delivery Plan
export const YARD_ZONES = ['BUFFER 10', 'GABARDO', 'WAREHOUSE 27', 'Warehouse A', 'Warehouse B', 'Dock 1', 'Dock 2'] as const;
export type YardZone = typeof YARD_ZONES[number];

export type PunctualityState = 'EARLY' | 'ON TIME' | 'LATE';

export interface TruckAppointment {
  id: string;
  carrierId: string; // CRITICAL for Phase 26: Strict RBAC & Tenant Isolation
  carrier: string; // Company Name (Razão Social/Nome Fantasia)
  driver: string;
  driverCpf?: string;
  licensePlate: string;
  containerId: string;
  blNumber: string;
  status: TruckStatus;
  scheduledTime: string; // e.g., "10:15 - 11:00"
  slotId: string;
  targetDate?: string; // YYYY-MM-DD
  gateInTime?: string; // ISO string
  entryGate?: string;
  unloadingLocation?: YardZone | string; // Enforcing Smart Zoning
  gateOutTime?: string; // ISO string
  isBitrem?: boolean;
  containerId2?: string;
  noShowCount?: number;
  isSpecialWindow?: boolean;
  freeTimeExpiration?: string; // Demurrage limit date
  isEnRoute?: boolean; // Carrier signal before arriving
  gatePin?: string; // 4-digit Fast-Track PIN
  punctualityStatus?: PunctualityState; // Engine evaluation state
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
  status: string; // Mapped internal status (e.g., 'MISSING BOOKING', 'MATCHED')
}

export interface KPIStats {
  todayTotalScheduled: number;
  gateInCount: number;
  avgTurnaroundTimeMinutes: number;
}