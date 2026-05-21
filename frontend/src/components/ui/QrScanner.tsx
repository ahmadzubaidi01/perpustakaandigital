'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Zap, ZapOff, X, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/Button';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (errorMessage: string) => void;
  onClose?: () => void;
  fps?: number;
  qrboxSize?: number;
  aspectRatio?: number;
  continuous?: boolean;
}

export const QrScanner: React.FC<QrScannerProps> = ({
  onScanSuccess,
  onScanFailure,
  onClose,
  fps = 15,
  qrboxSize = 250,
  aspectRatio = 1.0,
  continuous = false,
}) => {
  const containerId = 'custom-qr-reader-container';
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasFlashSupport, setHasFlashSupport] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Cooldown protection for duplicate scans
  const lastScanRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });

  // Web Audio Context for low-overhead success beeps
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High A pitch
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio autoplay restrictions might block this occasionally, fail silently
    }
  };

  // Device haptic feedback
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100]);
    }
  };

  // Query camera devices
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Try to auto-select back/environment camera
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('environment') ||
              d.label.toLowerCase().includes('rear')
          );
          setActiveCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorMsg('Kamera tidak ditemukan. Harap pastikan izin kamera diberikan.');
          setIsInitializing(false);
        }
      })
      .catch((err) => {
        setErrorMsg('Gagal mengakses kamera: ' + (err.message || err));
        setIsInitializing(false);
      });
  }, []);

  // Initialize and run scanner on active camera changes
  useEffect(() => {
    if (!activeCameraId) return;

    setIsInitializing(true);
    setErrorMsg(null);

    // Ensure previous instance is stopped completely
    const stopPrevious = async () => {
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current = null;
      }
    };

    stopPrevious().then(() => {
      const html5Qrcode = new Html5Qrcode(containerId);
      html5QrcodeRef.current = html5Qrcode;

      html5Qrcode
        .start(
          activeCameraId,
          {
            fps: fps,
            qrbox: { width: qrboxSize, height: qrboxSize },
            aspectRatio: aspectRatio,
          },
          (decodedText) => {
            const now = Date.now();
            // 2.5s cooldown for identical scans to prevent double trigger loops
            if (
              lastScanRef.current.text === decodedText &&
              now - lastScanRef.current.time < 2500
            ) {
              return;
            }

            // Register scan event timestamp
            lastScanRef.current = { text: decodedText, time: now };

            playBeep();
            triggerHaptic();

            if (!continuous) {
              // Stop camera immediately for one-off flows
              html5Qrcode.stop().then(() => {
                onScanSuccess(decodedText);
              }).catch(() => {
                onScanSuccess(decodedText);
              });
            } else {
              // Pass success directly for continuous scanning flow
              onScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            if (onScanFailure) {
              onScanFailure(errorMessage);
            }
          }
        )
        .then(() => {
          setIsInitializing(false);
          // Check for flashlight capability via video tracks
          try {
            const videoTracks = (html5Qrcode as any).getInputRasterAdapter().currentActiveTrack;
            if (videoTracks) {
              const capabilities = videoTracks.getCapabilities() as any;
              setHasFlashSupport(!!capabilities.torch);
            }
          } catch {
            setHasFlashSupport(false);
          }
        })
        .catch((err) => {
          setErrorMsg('Gagal memulai scanner kamera: ' + (err.message || err));
          setIsInitializing(false);
        });
    });

    return () => {
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.stop().catch(() => {});
        }
      }
    };
  }, [activeCameraId, fps, qrboxSize, aspectRatio, continuous, onScanSuccess, onScanFailure]);

  // Handle flash/torch toggle
  const toggleFlash = async () => {
    if (!html5QrcodeRef.current || !hasFlashSupport) return;
    const newState = !isFlashOn;
    try {
      await html5QrcodeRef.current.applyVideoConstraints({
        advanced: [{ torch: newState } as any],
      });
      setIsFlashOn(newState);
    } catch {
      // silences failure to toggle torch
    }
  };

  // Switch to next available camera
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setIsFlashOn(false); // turn off flash before switching
    setActiveCameraId(cameras[nextIndex].id);
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-border/80 flex flex-col items-center justify-center group">
      {/* Target Video Output Element */}
      <div id={containerId} className="absolute inset-0 w-full h-full object-cover" />

      {/* Dynamic Laser Line & Scanner Box Visual Guides */}
      {!errorMsg && !isInitializing && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
          {/* Transparent center region overlay */}
          <div className="absolute inset-0 bg-black/45" />

          {/* Scanner Box cutout highlighting target scan area */}
          <div
            className="relative border-2 border-primary/40 rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 flex items-center justify-center bg-transparent z-20"
            style={{ width: `${qrboxSize}px`, height: `${qrboxSize}px` }}
          >
            {/* Target Crosshairs styling corner brackets */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl" />

            {/* Neon moving laser scanning line */}
            <div className="w-full h-0.5 bg-linear-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_4px_rgba(79,70,229,0.7)] animate-scan absolute top-0" />
          </div>

          <p className="absolute bottom-6 text-center text-xs font-semibold text-white/95 tracking-wide px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Arahkan kamera ke QR Code perpustakaan
          </p>
        </div>
      )}

      {/* Loading Overlay */}
      {isInitializing && !errorMsg && (
        <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-primary" size={32} />
          <p className="text-xs font-semibold text-white/80">Menghubungkan Kamera...</p>
        </div>
      )}

      {/* Error / Permissions Blocked Overlay */}
      {errorMsg && (
        <div className="absolute inset-0 z-20 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <AlertCircle size={28} />
          </div>
          <h4 className="text-sm font-bold text-white">Akses Kamera Terhambat</h4>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">{errorMsg}</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Segarkan Halaman
            </Button>
            {onClose && (
              <Button variant="danger" size="sm" onClick={onClose}>
                Tutup
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Top Floating Control Controls */}
      {!isInitializing && !errorMsg && (
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
          {/* Quick Exit */}
          {onClose && (
            <button
              onClick={onClose}
              className="pointer-events-auto p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white/90 border border-slate-700/50 backdrop-blur-md active:scale-95 transition-all shadow-md cursor-pointer"
              title="Tutup"
            >
              <X size={16} />
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {/* Flash/Torch Switcher */}
            {hasFlashSupport && (
              <button
                onClick={toggleFlash}
                className={`pointer-events-auto p-2.5 rounded-xl border backdrop-blur-md active:scale-95 transition-all shadow-md cursor-pointer ${
                  isFlashOn
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-white/90 border-slate-700/50'
                }`}
                title="Toggle Senter"
              >
                {isFlashOn ? <ZapOff size={16} /> : <Zap size={16} />}
              </button>
            )}

            {/* Cameras Devices Toggle */}
            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="pointer-events-auto p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white/90 border border-slate-700/50 backdrop-blur-md active:scale-95 transition-all shadow-md cursor-pointer"
                title="Ganti Kamera"
              >
                <Camera size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
