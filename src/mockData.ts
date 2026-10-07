import { TruckAppointment, YardSlot, BlacklistedDriver, MasterPlanItem } from './types';

export const mockBlacklistedDrivers: BlacklistedDriver[] = [
  { cpf: '123.456.789-00', name: 'James Doe', reason: 'Security violation / Aggression' }
];

export function loadDailyPlan(): MasterPlanItem[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    { id: 'mp1', containerId: 'HLXU1234567', blNumber: 'BL-100293', targetDate: today, carrierName: 'FastLogistics', deliverySite: 'Warehouse A', demurrageDate: '2026-10-07', operationType: 'UNLOAD', vessel: 'MSC MARIE', shipowner: 'MSC', materialType: 'PBP-SC3H', model: 'ATTO -2', containerCost: '$1,250', excelStatus: 'PENDENTE', status: 'PENDENTE' },
    { id: 'mp2', containerId: 'MSCU7654321', blNumber: 'BL-200938', targetDate: today, carrierName: 'PortHaulers', deliverySite: 'Dock 4', demurrageDate: '2026-10-06', operationType: 'SWAP', vessel: 'CMA CGM TRIXIE', shipowner: 'CMA CGM', materialType: 'BATTERY', model: 'BYD SONG', containerCost: '$1,400', excelStatus: 'PENDENTE', status: 'PENDENTE' },
    { id: 'mp3', containerId: 'CMAU1122334', blNumber: 'BL-300485', targetDate: today, carrierName: 'GlobalFreight', deliverySite: 'Warehouse B', demurrageDate: '2026-10-08', operationType: 'PUT DOWN', vessel: 'COSCO HELLAS', shipowner: 'COSCO', materialType: 'MODULE', model: 'HAN-99', containerCost: '$980', excelStatus: 'PENDENTE', status: 'PENDENTE' },
    { id: 'mp4', containerId: 'ZIMU8899001', blNumber: 'BL-400991', targetDate: today, carrierName: 'CityTransport', deliverySite: 'Dock 1', demurrageDate: '2026-10-06', operationType: 'UNLOAD', vessel: 'EVER GIVEN', shipowner: 'EVERGREEN', materialType: 'PBP-SC3H', model: 'ATTO -2', containerCost: '$1,150', excelStatus: 'PENDENTE', status: 'PENDENTE' },
    { id: 'mp5', containerId: 'OOLC9988776', blNumber: 'BL-500112', targetDate: today, carrierName: 'OceanicMovers', deliverySite: 'Warehouse A', demurrageDate: '2026-10-09', operationType: 'SWAP', vessel: 'HAPAG LLOYD', shipowner: 'HAPAG', materialType: 'CHASSIS', model: 'DOLPHIN', containerCost: '$1,600', excelStatus: 'PENDENTE', status: 'PENDENTE' }
  ];
}

export const mockAppointments: TruckAppointment[] = [
  // Current slot (id: '4')
  { id: 't1', carrier: 'FastLogistics', driver: 'John Doe', licensePlate: 'ABC-1234', containerId: 'HLXU1234567', blNumber: 'BL-100293', status: 'In Yard', scheduledTime: '09:15', slotId: '4', gateInTime: '09:20', entryGate: 'Gate North', unloadingLocation: 'Warehouse A' },
  { id: 't2', carrier: 'PortHaulers', driver: 'Jane Smith', licensePlate: 'XYZ-9876', containerId: 'MSCU7654321', blNumber: 'BL-200938', status: 'In Yard', scheduledTime: '09:15', slotId: '4', gateInTime: '09:45', entryGate: 'Gate 2', unloadingLocation: 'Dock 4' },
  { id: 't3', carrier: 'GlobalFreight', driver: 'Carlos Ruiz', licensePlate: 'LMN-4567', containerId: 'CMAU1122334', blNumber: 'BL-300485', status: 'Called/In Transit', scheduledTime: '09:15', slotId: '4' },
  { id: 't4', carrier: 'FastLogistics', driver: 'Sarah Lee', licensePlate: 'DEF-5678', containerId: 'HLXU9988776', blNumber: 'BL-100294', status: 'Awaiting Call', scheduledTime: '09:15', slotId: '4', isSpecialWindow: true },
  { id: 't5', carrier: 'CityTransport', driver: 'Mike Tyson', licensePlate: 'GHI-9012', containerId: 'ZIMU5544332', blNumber: 'BL-400112', status: 'Awaiting Call', scheduledTime: '09:15', slotId: '4' },
  
  // Next slot (id: '5')
  { id: 't6', carrier: 'OceanicMovers', driver: 'Paul Rudd', licensePlate: 'QWE-1111', containerId: 'OOCL8877665', blNumber: 'BL-500667', status: 'Awaiting Call', scheduledTime: '10:15', slotId: '5' },
  { id: 't7', carrier: 'OceanicMovers', driver: 'Alice Eve', licensePlate: 'RTY-2222', containerId: 'OOCL2233445', blNumber: 'BL-500668', status: 'Awaiting Call', scheduledTime: '10:15', slotId: '5' },
  { id: 't8', carrier: 'FastLogistics', driver: 'Bob Dylan', licensePlate: 'UIO-3333', containerId: 'HLXU3344556', blNumber: 'BL-100295', status: 'Awaiting Call', scheduledTime: '10:15', slotId: '5' },
  
  // Completed in earlier slots
  { id: 't9', carrier: 'PortHaulers', driver: 'Jim Halpert', licensePlate: 'PAS-1234', containerId: 'MSCU9900112', blNumber: 'BL-200937', status: 'Operated', scheduledTime: '07:00', slotId: '1', gateInTime: '07:05', gateOutTime: '07:39' },
  { id: 't10', carrier: 'CityTransport', driver: 'Alice Cooper', licensePlate: 'QWE-9999', containerId: 'ZIMU1122334', containerId2: 'ZIMU5566778', isBitrem: true, blNumber: 'BL-400115', status: 'Operated', scheduledTime: '08:15', slotId: '2', gateInTime: '08:20', gateOutTime: '09:05' },
];

export const mockSlots: YardSlot[] = [
  { id: '0', startTime: '06:00', endTime: '07:00', capacity: 28, status: 'Completed' },
  { id: '1', startTime: '07:00', endTime: '08:00', capacity: 28, status: 'Completed' },
  { id: '2', startTime: '08:15', endTime: '09:15', capacity: 28, status: 'Completed' },
  { id: '3', startTime: '09:15', endTime: '10:15', capacity: 28, status: 'Completed' },
  { id: '4', startTime: '10:15', endTime: '11:00', capacity: 21, status: 'Active' },
  { id: '5', startTime: '12:40', endTime: '13:40', capacity: 28, status: 'Upcoming' },
  { id: '6', startTime: '13:40', endTime: '14:40', capacity: 28, status: 'Upcoming' },
  { id: '7', startTime: '14:40', endTime: '15:00', capacity: 9, status: 'Upcoming' },
  { id: '8', startTime: '16:15', endTime: '17:15', capacity: 28, status: 'Upcoming' },
  { id: '9', startTime: '17:15', endTime: '18:15', capacity: 28, status: 'Upcoming' },
  { id: '10', startTime: '18:15', endTime: '19:15', capacity: 28, status: 'Upcoming' },
  { id: '11', startTime: '19:15', endTime: '20:00', capacity: 21, status: 'Upcoming' },
  { id: '12', startTime: '21:00', endTime: '22:00', capacity: 28, status: 'Upcoming' },
  { id: '13', startTime: '22:00', endTime: '22:40', capacity: 19, status: 'Upcoming' }
];