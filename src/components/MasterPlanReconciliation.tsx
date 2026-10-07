import React, { useState, DragEvent, ChangeEvent } from 'react';
import { TruckAppointment, MasterPlanItem } from '../types';
import { cn } from '../utils';
import { mockSlots } from '../mockData';
import { AlertCircle, CheckCircle2, AlertTriangle, Send, Upload, FileSpreadsheet, Loader2, Check, Calendar, Search, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MasterPlanReconciliationProps {
  appointments: TruckAppointment[];
  masterPlan: MasterPlanItem[];
  onUploadMasterPlan: (items: MasterPlanItem[]) => void;
  onUpdateMasterPlanItem: (item: MasterPlanItem) => void;
  onBookSlot?: (appointment: Omit<TruckAppointment, 'id' | 'status'>) => void;
  onAutoSchedulePending?: () => Promise<void> | void;
  onScheduleBacklog?: (item: MasterPlanItem) => Promise<void> | void;
  selectedDate: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
}

export const MasterPlanReconciliation: React.FC<MasterPlanReconciliationProps> = ({ appointments, masterPlan, onUploadMasterPlan, onUpdateMasterPlanItem, onBookSlot, onAutoSchedulePending, onScheduleBacklog, selectedDate, onPrevDay, onNextDay, onToday }) => {
  const [alertedCarriers, setAlertedCarriers] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoScheduling, setIsAutoScheduling] = useState(false);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [containerSearch, setContainerSearch] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleAlertCarrier = (carrierName: string, containerId: string) => {
    setAlertedCarriers(prev => ({ ...prev, [containerId]: true }));
    showToast(`📢 Webhook alert successfully sent to carrier "${carrierName}" regarding missing booking for container ${containerId}. Reminder dispatched via WhatsApp & Email.`);
  };

  const handleScheduleBacklogItem = async (item: MasterPlanItem) => {
    if (onScheduleBacklog) {
      setSchedulingId(item.id);
      try {
        await onScheduleBacklog(item);
      } finally {
        setSchedulingId(null);
      }
      return;
    }

    if (!onBookSlot) {
      showToast('Booking function not available.');
      return;
    }

    const slot = mockSlots[0];
    onBookSlot({
      carrier: item.carrierName || 'BYD Operations',
      driver: 'Assigned Driver',
      licensePlate: `BYD-${Math.floor(Math.random() * 9000 + 1000)}`,
      containerId: item.containerId,
      blNumber: item.blNumber,
      scheduledTime: slot.startTime,
      slotId: slot.id,
      unloadingLocation: item.deliverySite || 'Warehouse A',
      targetDate: selectedDate,
      gatePin: Math.random().toString(36).substring(2, 6).toUpperCase()
    });

    onUpdateMasterPlanItem({
      ...item,
      status: 'MATCHED',
      excelStatus: 'SCHEDULED'
    });

    showToast(`⚡ Container ${item.containerId} successfully scheduled into slot ${slot.startTime} - ${slot.endTime} for ${selectedDate}!`);
  };

  const handleBulkAlertCarriers = () => {
    let count = 0;
    const newAlerts = { ...alertedCarriers };
    filteredMasterPlan.forEach(item => {
      const hasBooking = appointments.some(a => a.containerId === item.containerId || a.blNumber === item.blNumber);
      if (!hasBooking && !newAlerts[item.containerId]) {
        newAlerts[item.containerId] = true;
        count++;
      }
    });
    setAlertedCarriers(newAlerts);
    showToast(`📢 Bulk Alert Dispatched: Successfully alerted ${count} carrier(s) with missing bookings via WhatsApp & Email webhooks.`);
  };

  const handleBulkRescheduleBacklog = () => {
    let count = 0;
    filteredMasterPlan.forEach(item => {
      const hasBooking = appointments.some(a => a.containerId === item.containerId || a.blNumber === item.blNumber);
      if (!hasBooking) {
        onUpdateMasterPlanItem({
          ...item,
          targetDate: selectedDate,
          excelStatus: 'RESCHEDULED BACKLOG'
        });
        count++;
      }
    });
    showToast(`📅 Successfully rescheduled ${count} backlog container(s) to today (${selectedDate})!`);
  };

  const handleAutoSchedulePending = async () => {
    if (onAutoSchedulePending) {
      setIsAutoScheduling(true);
      try {
        await onAutoSchedulePending();
      } finally {
        setIsAutoScheduling(false);
      }
      return;
    }

    if (!onBookSlot) return;
    const unbookedItems = filteredMasterPlan.filter(item => {
      return !appointments.some(a => a.containerId === item.containerId || a.blNumber === item.blNumber);
    });

    if (unbookedItems.length === 0) {
      showToast('No missing bookings found to auto-schedule for this date.');
      return;
    }

    let scheduledCount = 0;
    unbookedItems.forEach((item, index) => {
      const slotIndex = index % mockSlots.length;
      const slot = mockSlots[slotIndex];
      
      onBookSlot({
        carrier: item.carrierName || 'BYD Operations',
        driver: 'Assigned Driver',
        licensePlate: `BYD-${Math.floor(Math.random() * 9000 + 1000)}`,
        containerId: item.containerId,
        blNumber: item.blNumber,
        scheduledTime: slot.startTime,
        slotId: slot.id,
        unloadingLocation: item.deliverySite || 'Warehouse A',
        targetDate: selectedDate,
        gatePin: Math.random().toString(36).substring(2, 6).toUpperCase()
      });

      onUpdateMasterPlanItem({
        ...item,
        status: 'MATCHED',
        excelStatus: 'AUTO-SCHEDULED'
      });
      scheduledCount++;
    });

    showToast(`⚡ Successfully auto-scheduled ${scheduledCount} missing booking(s) into available yard slots!`);
  };

  const processWorkbookData = (data: any[]) => {
    const parsedItems: MasterPlanItem[] = [];
    data.forEach((row, idx) => {
      const excelStatus = String(row['STATUS'] || row['Status'] || row['status'] || 'PENDENTE').trim().toUpperCase();
      
      if (excelStatus && (excelStatus.includes('CONCL') || excelStatus.includes('FINI') || excelStatus.includes('COMPL') || excelStatus.includes('DONE'))) {
        return;
      }

      const containerId = String(row['CONTAINER'] || row['Container'] || row['containerId'] || '').trim().toUpperCase();
      const blNumber = String(row['BL'] || row['Bl'] || row['blNumber'] || '').trim().toUpperCase();
      const carrierName = String(row['TRANSPORTATION COMPANY'] || row['Transportation Company'] || row['carrierName'] || 'Unknown Carrier').trim();
      const deliverySite = String(row['DELIVERY SITE'] || row['Delivery Site'] || row['deliverySite'] || 'Warehouse A').trim();
      const demurrageDate = String(row['DEMURRAGE'] || row['Demurrage'] || row['demurrageDate'] || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]).trim();
      
      const operationScope = String(row['OPERATION SCOPE'] || row['Operation Scope'] || row['operationType'] || 'UNLOAD').trim();
      const vessel = String(row['VESSEL'] || row['Vessel'] || row['vessel'] || 'MSC MARIE').trim();
      const shipowner = String(row['SHIPOWNER'] || row['Shipowner'] || row['shipowner'] || 'MSC').trim();
      const materialType = String(row['TYPE OF MATERIAL'] || row['Type of Material'] || row['materialType'] || 'PBP-SC3H').trim();
      const model = String(row['MODEL'] || row['Model'] || row['model'] || 'ATTO -2').trim();
      const containerCost = String(row['CONTAINER COST'] || row['Container Cost'] || row['containerCost'] || '$1,250').trim();

      if (containerId) {
        parsedItems.push({
          id: `mp-excel-${idx}-${Date.now()}`,
          containerId,
          blNumber: blNumber || `BL-${Math.floor(Math.random() * 900000 + 100000)}`,
          targetDate: selectedDate,
          carrierName,
          deliverySite,
          demurrageDate,
          operationType: operationScope,
          vessel,
          shipowner,
          materialType,
          model,
          containerCost,
          excelStatus,
          status: excelStatus || 'PENDENTE'
        });
      }
    });

    if (parsedItems.length > 0) {
      onUploadMasterPlan(parsedItems);
      showToast(`Successfully imported and saved ${parsedItems.length} active delivery plan items for ${selectedDate}!`);
    } else {
      showToast('No valid active container records found matching the required schema.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          alert("The uploaded Excel sheet is empty.");
          return;
        }

        // Map Excel rows to the MasterPlanItem interface
        const parsedItems: MasterPlanItem[] = data.map((row, index) => {
          // Handle various potential column names (Portuguese or English) from the BYD spreadsheet
          const container = row['CONTAINER'] || row['Container'] || row['Nº Container'] || `UNKNOWN-${index}`;
          const bl = row['BL'] || row['MBL'] || row['HBL'] || 'N/A';
          const carrier = row['TRANSPORTADORA'] || row['Transportadora'] || row['Carrier'] || 'BYD Operations';
          const site = row['DESTINO'] || row['Destino'] || row['Warehouse'] || 'Warehouse A';
          const demurrage = row['FREE TIME'] || row['Free Time'] || row['Demurrage'] || '';
          const model = row['MODELO'] || row['Modelo'] || row['Model'] || '';
          
          return {
            id: `mp_${Date.now()}_${index}`,
            containerId: String(container).replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
            blNumber: String(bl).toUpperCase(),
            targetDate: selectedDate, // Bind to the currently selected date in the UI
            carrierName: String(carrier).toUpperCase(),
            deliverySite: String(site).toUpperCase(),
            demurrageDate: String(demurrage),
            model: String(model),
            status: 'MISSING BOOKING',
            excelStatus: 'PENDING'
          };
        });

        // Pass the parsed array up to App.tsx
        onUploadMasterPlan(parsedItems);
        alert(`✅ Successfully parsed ${parsedItems.length} containers from Excel!`);
        
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        alert("Failed to read the Excel file. Please ensure it is a valid .xlsx or .xls file.");
      } finally {
        setIsLoading(false);
      }
    };
    
    reader.readAsBinaryString(file);
    
    // Reset the input so the same file can be uploaded again if needed
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Task 2: Filter masterPlan by selectedDate and containerSearch
  const filteredMasterPlan = masterPlan.filter(item => {
    const itemDate = item.targetDate || new Date().toISOString().split('T')[0];
    const matchesDate = itemDate === selectedDate;
    const matchesSearch = item.containerId.toLowerCase().includes(containerSearch.toLowerCase()) || 
                          item.blNumber.toLowerCase().includes(containerSearch.toLowerCase()) || 
                          item.carrierName.toLowerCase().includes(containerSearch.toLowerCase());
    return matchesDate && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
      {toastMessage && (
        <div className="bg-blue-600 text-white p-3 rounded-lg text-xs font-bold shadow-md flex items-center justify-between shrink-0 animate-fadeIn">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-blue-200 hover:text-white">&times;</button>
        </div>
      )}

      {/* Task 2: Date Navigation Bar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800">Master Plan Date:</span>
          <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevDay}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors"
          >
            &larr; Prev Day
          </button>
          <button
            onClick={onToday}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
          >
            Today
          </button>
          <button
            onClick={onNextDay}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors"
          >
            Next Day &rarr;
          </button>
        </div>
      </div>

      {/* Upload & Search Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "md:col-span-2 border-2 border-dashed rounded-lg p-4 flex items-center justify-between gap-4 transition-all bg-white",
            isDragging ? "border-purple-500 bg-purple-50" : "border-slate-300 hover:border-slate-400"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Import Master Delivery Plan (Excel)</h4>
              <p className="text-[11px] text-slate-500">Drag & drop your daily dispatch Excel sheet for {selectedDate}</p>
            </div>
          </div>
          <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2 shrink-0">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Upload File</span>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" disabled={isLoading} />
          </label>
        </div>

        {/* Task 2: Container Search Bar */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-center gap-1.5 shadow-sm">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-600 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-purple-600" />
            Search Container / BL
          </label>
          <input 
            type="text"
            value={containerSearch}
            onChange={(e) => setContainerSearch(e.target.value)}
            placeholder="Type container ID or BL..."
            className="border border-slate-300 rounded px-3 py-1.5 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-500 uppercase font-mono"
          />
        </div>
      </div>

      {/* Bulk Action Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex flex-col">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Master Plan Bulk Operations</h4>
          <span className="text-[11px] text-slate-500">Mass alert missing carriers or reschedule all backlog items instantly.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoSchedulePending}
            disabled={isAutoScheduling}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg shadow transition-colors flex items-center gap-1.5"
          >
            {isAutoScheduling ? <Loader2 className="w-4 h-4 animate-spin text-amber-300" /> : <Zap className="w-4 h-4 text-amber-300" />}
            <span>{isAutoScheduling ? 'Scheduling...' : '⚡ Auto-Schedule Pending'}</span>
          </button>
          <button
            onClick={handleBulkRescheduleBacklog}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg shadow transition-colors flex items-center gap-1.5"
          >
            <span>🔄 Reschedule Backlog to Today</span>
          </button>
          <button
            onClick={handleBulkAlertCarriers}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg shadow transition-colors flex items-center gap-1.5"
          >
            <span>🚨 Bulk Alert Carriers</span>
          </button>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Master Plan vs Yard Appointments Reconciliation ({selectedDate})</h3>
          <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">
            {filteredMasterPlan.length} Containers Scheduled
          </span>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Container ID</th>
                <th className="px-4 py-3">BL Number</th>
                <th className="px-4 py-3">Carrier / Company</th>
                <th className="px-4 py-3 text-center">Delivery Site</th>
                <th className="px-4 py-3 text-center">Demurrage Limit</th>
                <th className="px-4 py-3 text-center">Booking Status</th>
                <th className="px-4 py-3 text-right">Actions / Reconciliation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredMasterPlan.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest">
                    No master plan records found for {selectedDate}
                  </td>
                </tr>
              ) : (
                filteredMasterPlan.map(item => {
                  const hasBooking = appointments.some(a => a.containerId === item.containerId || a.blNumber === item.blNumber);
                  const isAlerted = alertedCarriers[item.containerId];

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.containerId}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{item.blNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{item.carrierName}</td>
                      <td className="px-4 py-3 text-center font-medium">{item.deliverySite}</td>
                      <td className="px-4 py-3 text-center font-mono text-red-600 font-bold">{item.demurrageDate}</td>
                      <td className="px-4 py-3 text-center">
                        {hasBooking ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                            <CheckCircle2 className="w-3 h-3" /> Booked & Scheduled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                            <AlertTriangle className="w-3 h-3" /> Missing Booking
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {!hasBooking && !isAlerted && (
                          <button
                            onClick={() => handleAlertCarrier(item.carrierName, item.containerId)}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                          >
                            Alert Carrier
                          </button>
                        )}
                        {isAlerted && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            Alert Dispatched ✓
                          </span>
                        )}
                        <button
                          onClick={() => handleScheduleBacklogItem(item)}
                          disabled={schedulingId === item.id}
                          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1 ml-auto inline-flex"
                        >
                          {schedulingId === item.id ? <Loader2 className="w-3 h-3 animate-spin text-amber-300" /> : <Zap className="w-3 h-3 text-amber-300" />}
                          <span>{schedulingId === item.id ? 'Scheduling...' : 'Schedule Backlog \u2192'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
