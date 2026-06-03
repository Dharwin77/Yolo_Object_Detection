import React, { useEffect, useState, useRef } from 'react';
import { Play, Image, Camera, Server, Cpu, Layers, HelpCircle, Activity, Radio, ShieldAlert } from 'lucide-react';
import API from '../api';

export default function Dashboard({ onTabChange, selectSampleImage, selectSampleVideo, backendOnline }) {
  const [samples, setSamples] = useState({ images: [], videos: [] });
  const [loadingSamples, setLoadingSamples] = useState(false);
  
  // Simulated System Stats
  const [simStats, setSimStats] = useState({
    fps: 29.4,
    latency: 18.2,
    ram: 2.1,
    cpu: 14.5
  });

  const canvasRef = useRef(null);

  // Radar animation effect (updated for Light Mode)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let angle = 0;

    // Mock object points on radar
    const blips = [
      { x: 120, y: 80, size: 4, opacity: 1, label: 'Person' },
      { x: 70, y: 140, size: 3, opacity: 0.8, label: 'Car' },
      { x: 190, y: 160, size: 5, opacity: 0.5, label: 'Laptop' }
    ];

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      const CX = W / 2;
      const CY = H / 2;
      const R = Math.min(W, H) / 2 - 10;

      // Draw background (Light Mode White)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // Draw radar circles (emerald theme)
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.lineWidth = 1;
      
      for (let r = R / 4; r <= R; r += R / 4) {
        ctx.beginPath();
        ctx.arc(CX, CY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw crosshairs
      ctx.beginPath();
      ctx.moveTo(CX - R, CY);
      ctx.lineTo(CX + R, CY);
      ctx.moveTo(CX, CY - R);
      ctx.lineTo(CX, CY + R);
      ctx.stroke();

      // Draw sweep line
      const sweepX = CX + R * Math.cos(angle);
      const sweepY = CY + R * Math.sin(angle);

      // Create a gradient sweep trail
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R, angle - 0.25, angle);
      ctx.lineTo(CX, CY);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(sweepX, sweepY);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw blips
      blips.forEach(blip => {
        const blipAngle = Math.atan2(blip.y - CY, blip.x - CX);
        let diff = angle - blipAngle;
        if (diff < 0) diff += Math.PI * 2;
        
        if (diff < 0.8) {
          blip.opacity = 1 - (diff / 0.8);
        } else {
          blip.opacity = Math.max(blip.opacity - 0.01, 0.1);
        }

        ctx.beginPath();
        ctx.arc(blip.x, blip.y, blip.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${blip.opacity})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#10b981';
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Label
        if (blip.opacity > 0.4) {
          ctx.fillStyle = `rgba(5, 150, 105, ${blip.opacity})`;
          ctx.font = '7px Courier New';
          ctx.fillText(blip.label, blip.x + 8, blip.y + 2);
        }
      });

      angle = (angle + 0.015) % (Math.PI * 2);
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Simulating random telemetry shifts
  useEffect(() => {
    const statInterval = setInterval(() => {
      setSimStats(prev => ({
        fps: Number((28.5 + Math.random() * 1.8).toFixed(1)),
        latency: Number((16.0 + Math.random() * 3.5).toFixed(1)),
        ram: Number((2.0 + Math.random() * 0.2).toFixed(2)),
        cpu: Number((12.5 + Math.random() * 4.5).toFixed(1))
      }));
    }, 3000);
    return () => clearInterval(statInterval);
  }, []);

  useEffect(() => {
    async function fetchSamples() {
      if (!backendOnline) return;
      setLoadingSamples(true);
      try {
        const imgRes = await fetch(`${API}/api/samples/images`);
        const imgData = await imgRes.json();
        
        const vidRes = await fetch(`${API}/api/samples/videos`);
        const vidData = await vidRes.json();
        
        setSamples({
          images: imgData.images || [],
          videos: vidData.videos || []
        });
      } catch (err) {
        console.error("Failed to load sample lists", err);
      } finally {
        setLoadingSamples(false);
      }
    }
    fetchSamples();
  }, [backendOnline]);

  const handleImageSampleClick = (img) => {
    selectSampleImage(img);
    onTabChange('image');
  };

  const handleVideoSampleClick = (vid) => {
    selectSampleVideo(vid);
    onTabChange('video');
  };

  return (
    <div className="dashboard-container animate-slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Banner - White & Green Clean Station */}
      <div className="glass-panel" style={{
        padding: '2.5rem',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(52, 211, 153, 0.02) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.12)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.2rem 0.6rem',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--primary)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Control Station v3
            </span>
          </div>
          <h1 style={{ fontSize: '2.8rem', marginBottom: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            YOLO <span className="text-gradient">Object Detection</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '650px', lineHeight: '1.6' }}>
            A state-of-the-art computer vision playground powered by YOLOv3 and MobileNetSSD. Detect, filter, and alert on 80+ object categories in images, videos, and live webcam feeds.
          </p>
        </div>

        {/* Ambient green glow in background */}
        <div style={{
          position: 'absolute',
          right: '-50px',
          bottom: '-50px',
          width: '300px',
          height: '300px',
          background: 'var(--primary-gradient)',
          filter: 'blur(120px)',
          opacity: 0.05,
          borderRadius: '50%',
          zIndex: 1
        }} />
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        {/* Connection card */}
        <div className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--primary)' }}>
            <Activity size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Backend Connection</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', color: 'var(--text-primary)' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: backendOnline ? '#10b981' : '#ef4444',
                boxShadow: backendOnline ? '0 0 10px #10b981' : '0 0 10px #ef4444',
                display: 'inline-block'
              }} />
              {backendOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>
          {backendOnline && (
            <svg viewBox="0 0 100 30" style={{ width: '70px', height: '24px', marginLeft: 'auto', opacity: 0.8 }}>
              <path d="M0,15 L20,15 L25,5 L30,25 L35,15 L50,15 L55,2 L60,28 L65,15 L80,15 L83,10 L86,20 L90,15 L100,15" fill="none" stroke="var(--accent-green)" strokeWidth="1.5" className="animate-graph-line" />
            </svg>
          )}
        </div>

        {/* Model Card */}
        <div className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(52, 211, 153, 0.08)', color: '#059669' }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Available Models</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--text-primary)' }}>3 Architectures</div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--primary)', marginLeft: 'auto', padding: '0.25rem 0.5rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
            COCO / Caffe
          </div>
        </div>

        {/* Engine Card */}
        <div className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ padding: '0.8rem', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
            <Cpu size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Processing Engine</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--text-primary)' }}>OpenCV DNN & TF.js</div>
          </div>
          <svg viewBox="0 0 100 30" style={{ width: '70px', height: '24px', marginLeft: 'auto', opacity: 0.8 }}>
            <path d="M0,10 C20,10 20,25 40,25 C60,25 60,5 80,5 C90,5 95,15 100,15" fill="none" stroke="var(--primary)" strokeWidth="1.5" className="animate-graph-line" />
          </svg>
        </div>
      </div>

      {/* Interactive Radar & System Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', minHeight: '300px' }}>
        
        {/* Radar Widget */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <Radio size={18} style={{ color: '#10b981' }} /> Ambient Live Radar Sweep
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#059669', background: 'rgba(16, 185, 129, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '10px', fontWeight: 600, border: '1px solid rgba(16,185,129,0.15)' }}>
              SWEEP ACTIVE
            </span>
          </div>
          
          <div style={{ display: 'flex', flex: 1, gap: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
            {/* Canvas Radar Element */}
            <div style={{ 
              borderRadius: '50%', 
              border: '2px solid rgba(16, 185, 129, 0.2)', 
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.05)',
              overflow: 'hidden',
              width: '200px',
              height: '200px',
              position: 'relative'
            }}>
              <canvas ref={canvasRef} width="200" height="200" style={{ display: 'block' }} />
            </div>
            
            {/* Radar metadata details */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Radar Coverage</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Omnidirectional (360°)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Target Classification</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>COCO Categories 1-80</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Threat Assessment</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ShieldAlert size={14} /> System Secure
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Metrics Widget */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Vision Telemetry Metrics
          </h3>
          
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(4, 1fr)', gap: '1rem', flex: 1 }}>
            
            {/* FPS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(16,185,129,0.05)', paddingBottom: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Pipeline Frame Rate</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Target: 30 FPS</div>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                {simStats.fps} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>FPS</span>
              </div>
            </div>

            {/* Latency */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(16,185,129,0.05)', paddingBottom: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>DNN Inference Latency</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Lower = faster response</div>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                {simStats.latency} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>ms</span>
              </div>
            </div>

            {/* CPU */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(16,185,129,0.05)', paddingBottom: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Simulated CPU Usage</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Vision engine processing threads</div>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                {simStats.cpu} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>%</span>
              </div>
            </div>

            {/* RAM */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.2rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Allocated Sandbox RAM</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>V8 Garbage Collection limits</div>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0d9488', fontFamily: 'var(--font-mono)' }}>
                {simStats.ram} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>GB</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Workspace Preloads */}
      <div>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <Layers size={22} style={{ color: 'var(--primary)' }} /> Test Pre-loaded Workspace Samples
        </h2>
        
        {loadingSamples ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ width: '16px', height: '16px' }} /> Loading workspace files...
          </div>
        ) : !backendOnline ? (
          <div className="glass-panel" style={{ padding: '2rem', color: 'var(--text-secondary)', borderStyle: 'dashed', borderWidth: '1px', textAlign: 'center', background: 'rgba(0,0,0,0.01)' }}>
            Start the Python Flask backend to load sample files.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            
            {/* Image Samples Card */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                <Image size={18} style={{ color: 'var(--primary)' }} /> Image Analyzer Preloads
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                {samples.images.map((img) => (
                  <div 
                    key={img} 
                    onClick={() => handleImageSampleClick(img)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid var(--border-color)',
                      aspectRatio: '16/10',
                      background: '#f1f5f9'
                    }}
                    className="glass-panel-interactive"
                  >
                    <img 
                      src={`${API}/api/samples/images/${img}`} 
                      alt={img} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }} 
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 70%, rgba(255,255,255,0) 100%)',
                      padding: '0.75rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>{img.replace('.jpg', '').replace('_', ' ')}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--primary)', opacity: 0.8 }}>JPEG</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Video Samples Card */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                <Play size={18} style={{ color: 'var(--primary)' }} /> Video Processor Preloads
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {samples.videos.map((vid) => (
                  <div
                    key={vid}
                    onClick={() => handleVideoSampleClick(vid)}
                    className="glass-panel glass-panel-interactive"
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: 'rgba(16, 185, 129, 0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Play size={16} fill="var(--primary)" style={{ marginLeft: '2px', stroke: 'none' }} />
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{vid}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', marginLeft: 'auto', background: 'rgba(16, 185, 129, 0.06)', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                      Select Sample
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        )}
      </div>

      {/* Guide section */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <HelpCircle size={20} style={{ color: 'var(--primary)' }} /> Object Detection Guide
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 700 }}>MobileNet SSD</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              A highly optimized Caffe-based model. It is smaller (23MB) and runs extremely quickly even on systems without a dedicated GPU. Ideal for standard CPU deployments. Detects 20 object classes.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 700 }}>YOLOv3 (You Only Look Once)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              A deeper, state-of-the-art deep learning model trained on the COCO dataset. It uses a single convolutional network to predict bounding boxes and class probabilities. Highly accurate for 80 classes but requires more computing power.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 700 }}>Webcam (Browser SSD)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Leverages WebGL inside your browser using TensorFlow.js. By running client-side, it eliminates network latency entirely, giving you smooth real-time object detection at up to 60 FPS without installing any local CUDA/Python GPU libraries!
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
