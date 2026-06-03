import React, { useState, useEffect, useRef } from 'react';
import { Camera, Volume2, VolumeX, AlertTriangle, Play, Square, RefreshCw, Activity } from 'lucide-react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export default function WebcamDetector() {
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [webcamActive, setWebcamActive] = useState(false);
  const [fps, setFps] = useState(0);
  const [activeDetectionsCount, setActiveDetectionsCount] = useState(0);
  const [errorState, setErrorState] = useState(null);
  
  // Alerts state
  const [alertTarget, setAlertTarget] = useState('person');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAlertTriggered, setIsAlertTriggered] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const nextAlertTimeRef = useRef(0);

  const cocoClasses = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
    "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
    "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
    "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
    "chair", "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop",
    "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
    "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
  ];

  // Synthesize warning sound locally using Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;
    
    // Rate limit beeps to once every 2 seconds
    const now = Date.now();
    if (now < nextAlertTimeRef.current) return;
    nextAlertTimeRef.current = now + 2000;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (err) {
      console.warn("Audio Context failed to initialize", err);
    }
  };

  // Load TensorFlow COCO-SSD Model
  useEffect(() => {
    async function loadModel() {
      try {
        setModelLoading(true);
        await tf.ready();
        const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        setModel(loadedModel);
      } catch (err) {
        console.error("TF.js Model loading failed", err);
      } finally {
        setModelLoading(false);
      }
    }
    loadModel();

    return () => {
      stopWebcam();
    };
  }, []);

  const startWebcam = async () => {
    try {
      setWebcamActive(true);
      setErrorState(null);
      const constraints = {
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          lastTimeRef.current = performance.now();
          frameCountRef.current = 0;
          animationFrameRef.current = requestAnimationFrame(inferenceLoop);
        };
      }
    } catch (err) {
      console.error("Webcam activation error", err);
      setWebcamActive(false);
      setErrorState("Failed to access camera stream. Please check browser permissions.");
    }
  };

  const stopWebcam = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamActive(false);
    setIsAlertTriggered(false);
    setFps(0);
    setActiveDetectionsCount(0);
  };

  // Main real-time object detection inference loop
  const inferenceLoop = async (time) => {
    if (!videoRef.current || !canvasRef.current || !model) return;

    // Calculate FPS
    frameCountRef.current++;
    if (time > lastTimeRef.current + 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / (time - lastTimeRef.current)));
      frameCountRef.current = 0;
      lastTimeRef.current = time;
    }

    try {
      const predictions = await model.detect(videoRef.current);
      drawPredictions(predictions);
      
      // Check target alert
      const targetFound = predictions.some(p => p.class === alertTarget && p.score > 0.5);
      setIsAlertTriggered(targetFound);
      if (targetFound) {
        playBeep();
      }

      setActiveDetectionsCount(predictions.length);
    } catch (err) {
      console.error("Inference frame error", err);
    }

    if (streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(inferenceLoop);
    }
  };

  // Draw bounding boxes on the canvas
  const drawPredictions = (predictions) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    predictions.forEach(p => {
      const [x, y, w, h] = p.bbox;
      const score = Math.round(p.score * 100);
      const isTarget = p.class === alertTarget;

      const mx = W - x - w;

      ctx.shadowBlur = 6;
      ctx.shadowColor = isTarget ? '#ef4444' : '#10b981';

      ctx.lineWidth = isTarget ? 3.5 : 2;
      ctx.strokeStyle = isTarget ? '#ef4444' : '#10b981';
      ctx.strokeRect(mx, y, w, h);

      ctx.shadowBlur = 0;

      // Label background
      ctx.fillStyle = isTarget ? '#ef4444' : '#10b981';
      const labelText = `${p.class.toUpperCase()} [${score}%]`;
      ctx.font = 'bold 9px Fira Code, monospace';
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillRect(mx, y - 18 > 0 ? y - 18 : y, textWidth + 8, 18);

      // Label Text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, mx + 4, y - 18 > 0 ? y - 5 : y + 12);
    });
  };

  return (
    <div className="animate-slide-up" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', minHeight: 'calc(100vh - 64px)' }}>
      
      {/* Sidebar Controllers */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
        <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <Camera size={20} className="text-gradient" /> Live Camera
        </h2>

        {/* Toggle webcam */}
        <button 
          onClick={webcamActive ? stopWebcam : startWebcam}
          disabled={modelLoading}
          style={{
            padding: '0.85rem',
            background: webcamActive ? 'rgba(239, 68, 68, 0.08)' : 'var(--primary-gradient)',
            border: webcamActive ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
            borderRadius: '8px',
            color: webcamActive ? '#f87171' : '#fff',
            fontWeight: 700,
            cursor: modelLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.25s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: modelLoading ? 0.4 : 1,
            boxShadow: webcamActive ? 'none' : '0 0 15px rgba(16,185,129,0.2)'
          }}
        >
          {modelLoading ? (
            <>
              <RefreshCw className="spinner" size={16} /> Loading TF.js Engine...
            </>
          ) : webcamActive ? (
            <>
              <Square size={16} fill="#f87171" style={{ stroke: 'none' }} /> Stop Camera Feed
            </>
          ) : (
            <>
              <Play size={16} fill="#fff" style={{ stroke: 'none' }} /> Start Camera Feed
            </>
          )}
        </button>

        {/* Alerts Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Target Alerts</h3>
          
          {/* Target class drop list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Identify Object</label>
            <select 
              value={alertTarget} 
              onChange={(e) => setAlertTarget(e.target.value)}
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {cocoClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Sound enable toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', padding: '0.2rem 0' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sound Notification</span>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                border: 'none',
                background: 'transparent',
                color: soundEnabled ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'color 0.2s'
              }}
            >
              {soundEnabled ? <Volume2 size={20} className="text-glow-primary" /> : <VolumeX size={20} />}
            </button>
          </div>
        </div>

        {/* System telemetry info */}
        {webcamActive && (
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.01)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>Engine Telemetry</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Frame Rate</span>
              <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="text-glow-green">
                <Activity size={12} /> {fps} FPS
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Active Objects</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{activeDetectionsCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Webcam Display View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {errorState && (
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171', fontSize: '0.9rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertTriangle size={18} />
            <span>{errorState}</span>
          </div>
        )}

        {/* Webcam HUD Frame */}
        <div className="hud-frame" style={{
          position: 'relative',
          border: isAlertTriggered ? '2px solid #ef4444' : '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: isAlertTriggered ? '0 0 25px rgba(239, 68, 68, 0.45), inset 0 0 20px rgba(239, 68, 68, 0.2)' : 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          width: '100%',
          aspectRatio: '640/480',
          transition: 'border 0.2s, box-shadow 0.2s',
          background: '#f8fafc'
        }}>
          
          {/* HUD Corner Brackets */}
          <div className={`hud-bracket hud-bracket-tl`} style={{ borderColor: isAlertTriggered ? '#ef4444' : 'var(--primary)' }} />
          <div className={`hud-bracket hud-bracket-tr`} style={{ borderColor: isAlertTriggered ? '#ef4444' : 'var(--primary)' }} />
          <div className={`hud-bracket hud-bracket-bl`} style={{ borderColor: isAlertTriggered ? '#ef4444' : 'var(--primary)' }} />
          <div className={`hud-bracket hud-bracket-br`} style={{ borderColor: isAlertTriggered ? '#ef4444' : 'var(--primary)' }} />

          {/* Rotating Radar sweep line when active */}
          {webcamActive && (
            <div className="hud-radar-sweep" />
          )}

          {/* Laser vertical scan line */}
          {webcamActive && (
            <div className="hud-scan-line" style={{ background: isAlertTriggered ? 'linear-gradient(180deg, rgba(239, 68, 68, 0) 0%, rgba(239, 68, 68, 0.4) 50%, rgba(239, 68, 68, 0) 100%)' : undefined, boxShadow: isAlertTriggered ? '0 0 15px rgba(239, 68, 68, 0.5)' : undefined }} />
          )}

          {modelLoading && (
            <div style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              textAlign: 'center',
              padding: '2rem',
              zIndex: 6
            }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }} />
              <div>
                <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Assembling TensorFlow.js Sandbox...</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '340px', marginTop: '0.2rem' }}>Downloading client-side MobileNetV2 SSD. Runs completely locally in your browser.</p>
              </div>
            </div>
          )}

          {!webcamActive && !modelLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              color: 'var(--text-secondary)',
              zIndex: 6
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.02)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)'
              }}>
                <Camera size={32} />
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Webcam scanner feed offline. Press "Start Camera Feed".</span>
            </div>
          )}

          {/* Webcam streaming element */}
          <video 
            ref={videoRef}
            width="640"
            height="480"
            style={{ display: webcamActive ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            playsInline
            muted
          />

          {/* Canvas drawing overlay */}
          <canvas 
            ref={canvasRef}
            width="640"
            height="480"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: webcamActive ? 'block' : 'none',
              pointerEvents: 'none',
              zIndex: 3
            }}
          />

          {/* Alarm warning HUD overlay */}
          {isAlertTriggered && webcamActive && (
            <div style={{
              position: 'absolute',
              top: '1.25rem',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(239, 68, 68, 0.95)',
              color: '#ffffff',
              padding: '0.6rem 1.75rem',
              borderRadius: '30px',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
              zIndex: 10,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              fontFamily: 'var(--font-mono)',
              animation: 'pulse-glow 1s infinite'
            }}>
              <AlertTriangle size={16} /> TARGET ACQUIRED: {alertTarget.toUpperCase()}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
