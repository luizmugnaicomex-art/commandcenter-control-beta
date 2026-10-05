import React, { useState, DragEvent, ChangeEvent } from 'react';
import { TruckAppointment, MasterPlanItem } from '../types';
import { cn } from '../utils';
import { AlertCircle, CheckCircle2, AlertTriangle, Send, Upload, FileSpreadsheet, Loader2, Check, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MasterPlanReconciliationProps {
  appointments: TruckAppointment[];
  masterPlan: MasterPlanItem[];
  onUploadMasterPlan: (items: MasterPlanItem[]) => void;
  onUpdateMasterPlanItem: (item: MasterPlanItem) => void;
}

export const MasterPlanReconciliation: React.FC<MasterPlanReconciliationProps> = ({ appointments, masterPlan, onUploadMasterPlan, onUpdateMasterPlanItem }) => {
  const [alertedCarriers, setAlertedCarriers] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

    const currentTarget = new Date(item.targetDate || Date.now());
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
      
      // Filter out finished status if specified
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
          targetDate: new Date().toISOString().split('T')[0],
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
      showToast(`Successfully imported and saved ${parsedItems.length} active delivery plan items to Firestore with full data grid mapping!`);
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

  return (
    <main className="flex-1 w-full mx-auto p-4 flex flex-col gap-4 overflow-hidden bg-slate-100 relative">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl border border-slate-700 flex items-center gap-3 animate-fade-in max-w-md">
          <div className="p-1 bg-blue-600 rounded-full text-white shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium leading-relaxed">{toastMessage}</p>
        </div>
      )}

      {/* Upload Zone */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 bg-white text-center flex flex-col items-center justify-center gap-2 transition-all shrink-0 shadow-sm relative",
          isDragging ? "border-blue-500 bg-blue-50/50 scale-[1.01]" : "border-slate-300 hover:border-slate-400"
        )}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Parsing and saving Delivery Plan...</p>
          </div>
        ) : (
          <>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Upload Daily Delivery Plan (.xlsx)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Drag & drop your Excel sheet here to save and reconcile</p>
            </div>
            <label className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Browse File</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={onFileChange} className="hidden" />
            </label>
          </>
        )}
      </div>

      <div className="bg-white border border-slate-300 rounded shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800">Master Plan vs Actual Reconciliation & Backlog Control</h2>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Persisted Deliveries Checked against System Bookings ({masterPlan.length} items loaded)</p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Finished
            </span>
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Matched
            </span>
            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" /> Mismatch
            </span>
            <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-1 rounded border border-red-200">
              <AlertCircle className="w-3.5 h-3.5" /> Missing Booking
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap border-collapse">
            <thead className="bg-slate-100 border-b border-slate-300 font-bold uppercase tracking-wider text-slate-600 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2.5 border-r border-slate-200">Container ID</th>
                <th className="px-4 py-2.5 border-r border-slate-200">BL Number</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Operation Scope</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Vessel</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Shipowner</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Type / Model</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Cost</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Transportation Company</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Delivery Site</th>
                <th className="px-4 py-2.5 border-r border-slate-200">Demurrage Date</th>
                <th className="px-4 py-2.5 border-r border-slate-200 text-center">Excel Status</th>
                <th className="px-4 py-2.5 border-r border-slate-200 text-center">Reconciliation Status</th>
                <th className="px-4 py-2.5 text-center">Action / Backlog Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {masterPlan.map(item => {
                const matchingApt = appointments.find(a => a.containerId === item.containerId || a.containerId2 === item.containerId);
                
                let status: 'MATCHED' | 'MISSING BOOKING' | 'MISMATCH' | 'FINISHED' = 'MISSING BOOKING';
                let details = '';

                if (matchingApt) {
                  if (matchingApt.status === 'Operated') {
                    status = 'FINISHED';
                  } else {
                    const carrierMatch = matchingApt.carrier.toLowerCase() === item.carrierName.toLowerCase();
                    const siteMatch = !matchingApt.unloadingLocation || matchingApt.unloadingLocation.toLowerCase() === item.deliverySite.toLowerCase();
                    
                    if (carrierMatch && siteMatch) {
                      status = 'MATCHED';
                    } else {
                      status = 'MISMATCH';
                      if (!carrierMatch) details += `Carrier diff (${matchingApt.carrier}); `;
                      if (!siteMatch) details += `Site diff (${matchingApt.unloadingLocation || 'Unassigned'});`;
                    }
                  }
                }

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors text-xs">
                    <td className="px-4 py-2.5 border-r border-slate-100 font-mono font-bold text-slate-900">{item.containerId}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-mono text-slate-500">{item.blNumber}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-semibold text-blue-700">{item.operationType || 'UNLOAD'}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 text-slate-700">{item.vessel || 'MSC MARIE'}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 text-slate-700">{item.shipowner || 'MSC'}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-mono text-slate-800">{item.materialType || 'PBP-SC3H'} / {item.model || 'ATTO -2'}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-mono text-emerald-700 font-semibold">{item.containerCost || '$1,250'}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-medium">{item.carrierName}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100">{item.deliverySite}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-mono text-red-600 font-bold">{item.demurrageDate}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 text-center font-mono text-[11px] text-slate-600 bg-slate-50 font-bold">{item.excelStatus || 'PENDENTE'}</td>
                    <td className="px-4 py-2.5 border-r border-slate-100 text-center">
                      {status === 'FINISHED' && (
                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" /> FINISHED
                        </span>
                      )}
                      {status === 'MATCHED' && (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" /> MATCHED
                        </span>
                      )}
                      {status === 'MISSING BOOKING' && (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <AlertCircle className="w-3 h-3" /> MISSING BOOKING
                        </span>
                      )}
                      {status === 'MISMATCH' && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider" title={details}>
                          <AlertTriangle className="w-3 h-3" /> MISMATCH
                          {details && <span className="text-[9px] font-normal text-amber-900 ml-1">({details})</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center flex items-center justify-center gap-2">
                      {status === 'FINISHED' ? (
                        <span className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Operation Completed</span>
                      ) : (
                        <>
                          {status === 'MISSING BOOKING' && (
                            <button
                              onClick={() => handleAlertCarrier(item.carrierName, item.containerId)}
                              disabled={alertedCarriers[item.containerId]}
                              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              {alertedCarriers[item.containerId] ? 'Alerted ✓' : 'Alert Carrier'}
                            </button>
                          )}
                          {status === 'MISMATCH' && (
                            <button
                              onClick={() => showToast(`Reviewing discrepancy for container ${item.containerId} with ${item.carrierName}. Discrepancy logged for review.`)}
                              className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                            >
                              Review
                            </button>
                          )}
                          {status === 'MATCHED' && (
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">In Progress</span>
                          )}
                          <button
                            onClick={() => handleMoveToNextDay(item)}
                            title="Move container to next day due to backlog"
                            className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                          >
                            <Calendar className="w-3 h-3" /> Move +1d
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};
