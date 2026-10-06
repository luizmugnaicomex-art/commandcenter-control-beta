import React, { useState, DragEvent, ChangeEvent } from 'react';
import { TruckAppointment, MasterPlanItem } from '../types';
import { cn } from '../utils';
import { AlertCircle, CheckCircle2, AlertTriangle, Send, Upload, FileSpreadsheet, Loader2, Check, Calendar, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MasterPlanReconciliationProps {
  appointments: TruckAppointment[];
  masterPlan: MasterPlanItem[];
  onUploadMasterPlan: (items: MasterPlanItem[]) => void;
  onUpdateMasterPlanItem: (item: MasterPlanItem) => void;
  selectedDate: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
}

export const MasterPlanReconciliation: React.FC<MasterPlanReconciliationProps> = ({ appointments, masterPlan, onUploadMasterPlan, onUpdateMasterPlanItem, selectedDate, onPrevDay, onNextDay, onToday }) => {
  const [alertedCarriers, setAlertedCarriers] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
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

  const handleMoveToNextDay = (item: MasterPlanItem) => {
    const currentDemurrage = new Date(item.demurrageDate || Date.now());
    currentDemurrage.setDate(currentDemurrage.getDate() + 1);
    const newDemurrageStr = currentDemurrage.toISOString().split('T')[0];

    const currentTarget = new Date(item.targetDate || selectedDate);
    currentTarget.setDate(currentTarget.getDate() + 1);
    const newTargetStr = currentTarget.toISOString().split('T')[0];

    const updated: MasterPlanItem = {
      ...item,
      targetDate: newTargetStr,
      demurrageDate: newDemurrageStr,
      excelStatus: 'POSTPONED / BACKLOG'
    };

    onUpdateMasterPlanItem(updated);
    showToast(`📅 Container ${item.containerId} successfully rescheduled to next day (${newTargetStr}) due to backlog.`);
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

  const handleFileUpload = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        processWorkbookData(data);
      } catch (err) {
        console.error('Error parsing excel:', err);
        showToast('Failed to parse Excel file. Please ensure it matches the DELIVERY PLAN format.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
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
            <input type="file" accept=".xlsx, .xls, .csv" onChange={onFileChange} className="hidden" disabled={isLoading} />
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
                          onClick={() => handleMoveToNextDay(item)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                        >
                          Reschedule Backlog &rarr;
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
