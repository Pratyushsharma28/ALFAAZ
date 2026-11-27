import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, RefreshCw, Video } from 'lucide-react';

interface QrCameraScannerProps {
  onDetect: (qrText: string) => void;
  paused?: boolean;
  isProcessing?: boolean;
}

export function QrCameraScanner({
  onDetect,
  paused = false,
  isProcessing = false,
}: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const lastFrameTimeRef = useRef<number>(0);

  const [cameraActive, setCameraActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraError(
        'Camera access is unavailable in this browser or context. Use HTTPS on mobile or enter the Ticket ID manually below.'
      );
      return;
    }

    stopCamera();
    setIsStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/NotAllowedError|Permission denied|denied/i.test(msg)) {
        setCameraError(
          'Camera permission was denied. Allow camera access in your browser settings or use the manual ticket entry fallback.'
        );
      } else if (/NotFoundError|Requested device not found/i.test(msg)) {
        setCameraError(
          'No camera was detected on this device. Use the manual ticket ID / registration code entry below.'
        );
      } else {
        setCameraError(
          'Unable to start camera scanner. Use the manual ticket verification fallback below.'
        );
      }
      stopCamera();
    } finally {
      setIsStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!cameraActive) return;

    const scanFrame = (timestamp: number) => {
      rafRef.current = window.requestAnimationFrame(scanFrame);

      if (paused || isProcessing) return;
      if (timestamp - lastFrameTimeRef.current < 130) return;
      lastFrameTimeRef.current = timestamp;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (decoded?.data) {
        const clean = decoded.data.trim();
        const now = Date.now();
        if (
          clean &&
          (clean !== lastScanRef.current.text || now - lastScanRef.current.at > 2600)
        ) {
          lastScanRef.current = { text: clean, at: now };
          onDetect(clean);
        }
      }
    };

    rafRef.current = window.requestAnimationFrame(scanFrame);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cameraActive, paused, isProcessing, onDetect]);

  return (
    <div className="border border-[#EAE7E0]/15 bg-[#050505]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE7E0]/12 px-4 py-3">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-[#00E5FF]" aria-hidden="true" />
          <p className="font-mono-num text-[11px] font-semibold tracking-wider text-[#EAE7E0] uppercase">
            Live QR Camera Scanner
          </p>
        </div>

        {cameraActive ? (
          <button
            type="button"
            onClick={stopCamera}
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 border border-[#FF1744]/45 bg-[#FF1744]/10 px-3 py-1 font-mono-num text-[11px] font-semibold tracking-wider text-[#FF1744] uppercase transition-colors hover:bg-[#FF1744] hover:text-[#EAE7E0]"
          >
            <CameraOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Stop Camera</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isStarting}
            onClick={() => void startCamera()}
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 border border-[#00E5FF]/50 bg-[#00E5FF]/15 px-3 py-1 font-mono-num text-[11px] font-semibold tracking-wider text-[#00E5FF] uppercase transition-colors hover:bg-[#00E5FF] hover:text-[#050505] disabled:opacity-50"
          >
            {isStarting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isStarting ? 'Starting...' : 'Start Camera'}</span>
          </button>
        )}
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#08080A] sm:aspect-[16/10]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

        {cameraActive ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-48 w-48 sm:h-56 sm:w-56">
              <span className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-[#C8F36B]" />
              <span className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-[#C8F36B]" />
              <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-[#C8F36B]" />
              <span className="absolute right-0 bottom-0 h-6 w-6 border-r-2 border-b-2 border-[#C8F36B]" />
            </div>
            {(paused || isProcessing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#050505]/70">
                <p className="border border-[#00E5FF]/40 bg-[#0B0B0D] px-4 py-2 font-mono-num text-xs font-semibold tracking-wider text-[#00E5FF] uppercase">
                  {isProcessing ? 'Verifying Pass...' : 'Scanner Paused'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Camera className="h-10 w-10 text-[#EAE7E0]/30" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[#EAE7E0]">
              {cameraError ? 'Camera Unavailable' : 'Camera Ready for Gate Scanning'}
            </p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[#EAE7E0]/60">
              {cameraError
                ? cameraError
                : 'Tap "Start Camera" and point the rear camera at the participant ticket QR code.'}
            </p>
            <button
              type="button"
              disabled={isStarting}
              onClick={() => void startCamera()}
              className="mt-4 inline-flex min-h-[40px] cursor-pointer items-center gap-2 border border-[#00E5FF]/50 bg-[#00E5FF]/15 px-4 py-2 font-mono-num text-xs font-semibold tracking-wider text-[#00E5FF] uppercase transition-colors hover:bg-[#00E5FF] hover:text-[#050505]"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span>{cameraError ? 'Retry Camera' : 'Enable Rear Camera'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
