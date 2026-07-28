export type TruckStatus = 'Awaiting Call' | 'Called/In Transit' | 'In Yard' | 'Operated';

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
  gateInTime?: string;
  entryGate?: string;
  unloadingLocation?: string;
  gateOutTime?: string;
  isBitrem?: boolean;
  containerId2?: string;
  noShowCount?: number;
  isSpecialWindow?: boolean;
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

export interface KPIStats {
  todayTotalScheduled: number;
  gateInCount: number;
  avgTurnaroundTimeMinutes: number;
}
