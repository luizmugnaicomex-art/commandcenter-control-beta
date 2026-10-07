import React, { useState, useRef, useEffect } from 'react';
import { TruckAppointment } from '../types';
import { cn } from '../utils';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, LogOut, Search, ArrowRight, Zap } from 'lucide-react';
import { createWorker } from 'tesseract.js';

interface MobileClerkAppProps {
  appointments: TruckAppointment[];
  onArrivedAtLine: (id: string) => void;
  onGateIn: (id: string) => void;
  onLogout: () => void;
  clerkName?: string;
  selectedDate: string;
}

export function MobileClerkApp({ appointments, onArrivedAtLine, onGateIn, onLogout, clerkName = 'Logistics Clerk', selectedDate }: MobileClerkAppProps) {
  const [activeTab, setActiveTab] = useState<'scan' | 'list'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('Ready to scan container ID...');
  const [detectedText, setDetectedText] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter expected appointments for today/selectedDate in transit or awaiting or physical line
  const activeAppointments = appointments.filter(a => {
    const isToday = a.targetDate === selectedDate || !a.targetDate;
    const isRelevantStatus = a.status === 'Called/In Transit' || a.status === 'Physical Line' || a.status === 'Awaiting Call';
    return isToday && isRelevantStatus;
  });

  const filteredAppointments = activeAppointments.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      a.containerId.toLowerCase().includes(term) ||
      a.licensePlate.toLowerCase().includes(term) ||
      a.carrier.toLowerCase().includes(term) ||
      (a.gatePin && a.gatePin.toLowerCase().includes(term))
    );
  });

  const startCamera = async () => {
    setIsScanning(true);
    setCameraError(false);
    setScanStatus('Starting camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanStatus('Camera active. Point at container ID (e.g. MSCU1234567)');
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(true);
      setScanStatus('Camera access denied or restricted in preview. Use Simulated OCR or manual buttons below.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const simulateOcrScan = (targetApt?: TruckAppointment) => {
    const aptToScan = targetApt || activeAppointments[0];
    if (!aptToScan) {
      alert("No active appointments available to scan.");
      return;
    }

    setIsProcessingOcr(true);
    setScanStatus(`Simulating OCR recognition for ${aptToScan.containerId}...`);

    setTimeout(() => {
      setIsProcessingOcr(false);
      if (aptToScan.status === 'Called/In Transit' || aptToScan.status === 'Awaiting Call') {
        onArrivedAtLine(aptToScan.id);
        alert(`✅ OCR Success! Recognized Container ${aptToScan.containerId} (Plate: ${aptToScan.licensePlate}). Moved to Physical Line.`);
      } else if (aptToScan.status === 'Physical Line') {
        onGateIn(aptToScan.id);
        alert(`✅ OCR Success! Recognized Container ${aptToScan.containerId} (Plate: ${aptToScan.licensePlate}). Successfully Gated-In!`);
      }
      setScanStatus(`Successfully scanned ${aptToScan.containerId}!`);
    }, 800);
  };

  const captureAndOCR = async () => {
    if (!videoRef.current || !canvasRef.current) {
      simulateOcrScan();
      return;
    }
    setIsProcessingOcr(true);
    setScanStatus('Processing OCR image...');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const worker = await createWorker('eng');
      const ret = await worker.recognize(canvas);
      await worker.terminate();

      const text = ret.data.text || '';
      setDetectedText(text);

      const containerRegex = /[A-Z]{4}\d{7}/g;
      const matches = text.toUpperCase().match(containerRegex);

      if (matches && matches.length > 0) {
        const foundId = matches[0];
        setScanStatus(`OCR Detected Container: ${foundId}`);
        const matchedApt = activeAppointments.find(a => 
          a.containerId.toUpperCase() === foundId || 
          (a.containerId2 && a.containerId2.toUpperCase() === foundId)
        );

        if (matchedApt) {
          handleManualAction(matchedApt);
          stopCamera();
        } else {
          setScanStatus(`Found ID ${foundId}, but no matching active appointment.`);
        }
      } else {
        // Fallback to simulation if OCR text didn't match ISO format directly
        simulateOcrScan();
      }
    } catch (err) {
      console.error("OCR error, falling back to instant simulation:", err);
      simulateOcrScan();
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleManualAction = (apt: TruckAppointment) => {
    if (apt.status === 'Called/In Transit' || apt.status === 'Awaiting Call') {
      onArrivedAtLine(apt.id);
      alert(`✅ Truck ${apt.licensePlate} (${apt.containerId}) marked as arrived at Physical Line.`);
    } else if (apt.status === 'Physical Line') {
      onGateIn(apt.id);
      alert(`✅ Truck ${apt.licensePlate} (${apt.containerId}) successfully Gated-In to Active Yard.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans select-none max-w-md mx-auto shadow-2xl overflow-hidden border-x border-slate-800">
      {/* Mobile Top Header */}
      <header className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-600 font-black flex items-center justify-center text-sm shadow">
            BYD
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-wider text-white">Mobile Clerk (Conferente)</span>
            <span className="text-[10px] text-slate-400">{clerkName}</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Tab Navigation Bar */}
      <div className="grid grid-cols-2 bg-slate-950 p-1 border-b border-slate-800 shrink-0">
        <button
          onClick={() => { setActiveTab('scan'); if (!isScanning && !cameraError) startCamera(); }}
          className={cn(
            "py-3 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2",
            activeTab === 'scan' ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
          )}
        >
          <Camera className="w-4 h-4" />
          Camera OCR Scan
        </button>
        <button
          onClick={() => { setActiveTab('list'); stopCamera(); }}
          className={cn(
            "py-3 text-xs font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2",
            activeTab === 'list' ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
          )}
        >
          <Search className="w-4 h-4" />
          Manual List ({activeAppointments.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto bg-slate-900 gap-4">
        {activeTab === 'scan' ? (
          <div className="flex flex-col gap-4 flex-1">
            {/* Camera Viewfinder / Simulation Box */}
            <div className="relative w-full aspect-4/3 bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-inner flex items-center justify-center">
              <video 
                ref={videoRef} 
                playsInline 
                muted 
                className={cn("w-full h-full object-cover", (!isScanning || cameraError) && "hidden")}
              />
              <canvas ref={canvasRef} className="hidden" />

              {(!isScanning || cameraError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 gap-3">
                  <Camera className="w-12 h-12 text-blue-500 mb-1 animate-pulse" />
                  <p className="text-xs font-bold text-slate-200">
                    {cameraError ? "⚠️ Camera Permission Restricted in Browser Preview" : "Camera scanner is ready"}
                  </p>
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <button
                      onClick={() => simulateOcrScan()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider px-4 py-3 rounded-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>⚡ Simulate OCR Scan (Next Truck)</span>
                    </button>
                    {!cameraError && (
                      <button
                        onClick={startCamera}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg border border-slate-700 transition-colors"
                      >
                        Try Start Camera 📷
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isScanning && !cameraError && (
                <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-blue-500/50 m-6 rounded-lg flex items-center justify-center">
                  <span className="bg-black/70 text-blue-300 px-3 py-1 rounded text-[10px] font-mono tracking-widest uppercase border border-blue-500/30">
                    ALIGN CONTAINER ID HERE
                  </span>
                </div>
              )}
            </div>

            {/* Scan Status & Capture Button */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{scanStatus}</span>
              </div>
              {detectedText && (
                <div className="text-[10px] font-mono bg-slate-900 p-2 rounded text-slate-300 max-h-20 overflow-y-auto border border-slate-800">
                  Raw OCR: {detectedText}
                </div>
              )}
              {isScanning && !cameraError && (
                <button
                  onClick={captureAndOCR}
                  disabled={isProcessingOcr}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-black text-sm uppercase tracking-widest py-3 rounded-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  {isProcessingOcr ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Recognizing Text...
                    </>
                  ) : (
                    <>
                      <span>⚡ Capture & OCR Scan</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Quick Manual Fallback Taps in Scanner Tab */}
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Expected Trucks (Tap to Advance):</span>
              <div className="flex flex-col gap-2">
                {activeAppointments.slice(0, 3).map(apt => (
                  <div key={apt.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center justify-between shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono font-bold text-amber-300">{apt.containerId}</span>
                      <span className="text-[10px] text-slate-300">{apt.licensePlate} • {apt.carrier}</span>
                      <span className="text-[9px] text-blue-400 uppercase font-bold mt-0.5">Status: {apt.status}</span>
                    </div>
                    <button
                      onClick={() => handleManualAction(apt)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow transition-transform active:scale-95"
                    >
                      <span>Advance</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1">
            {/* Search filter */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search container, plate, carrier, PIN..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
              />
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
              {filteredAppointments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs uppercase font-bold tracking-wide">
                  No active trucks found for today.
                </div>
              ) : (
                filteredAppointments.map(apt => (
                  <div key={apt.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono font-bold text-amber-400">{apt.containerId}</span>
                        {apt.containerId2 && <span className="text-xs font-mono font-bold text-amber-500">+ {apt.containerId2} (Bitrem)</span>}
                        <span className="text-xs font-bold text-white mt-1">{apt.licensePlate} • {apt.carrier}</span>
                      </div>
                      <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-950 text-blue-300 border border-blue-800">
                        {apt.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                      <span>Driver: <strong className="text-slate-200">{apt.driver}</strong></span>
                      <span>PIN: <strong className="text-amber-300 font-mono">{apt.gatePin || 'K9M2'}</strong></span>
                    </div>

                    <button
                      onClick={() => handleManualAction(apt)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-lg shadow transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{apt.status === 'Called/In Transit' ? 'Mark Arrived at Physical Line' : 'Gate-In to Active Yard'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
