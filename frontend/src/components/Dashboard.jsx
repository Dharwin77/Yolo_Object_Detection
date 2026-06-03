import React, { useEffect, useState } from 'react';
import { Play, Image, Camera, Server, Cpu, Layers, HelpCircle, Activity } from 'lucide-react';
import API from '../api';

export default function Dashboard({ onTabChange, selectSampleImage, selectSampleVideo, backendOnline }) {
  const [samples, setSamples] = useState({ images: [], videos: [] });
  const [loadingSamples, setLoadingSamples] = useState(false);

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
      
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '2.5rem',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: 800 }}>
            Antigravity <span className="text-gradient">Object Detector</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', lineHeight: '1.6' }}>
            A state-of-the-art computer vision playground powered by YOLOv3 and MobileNetSSD. Detect, filter, and alert on 80+ object categories in images, videos, and live webcam feeds.
          </p>
        </div>
        <div style={{
          position: 'absolute',
          right: '-50px',
          bottom: '-50px',
          width: '250px',
          height: '250px',
          background: 'var(--primary-gradient)',
          filter: 'blur(100px)',
          opacity: 0.15,
          borderRadius: '50%'
        }} />
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Backend Connection</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: backendOnline ? '#10b981' : '#ef4444',
                boxShadow: backendOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444',
                display: 'inline-block'
              }} />
              {backendOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>
        </div>

        <div className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Available Models</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>3 Architectures</div>
          </div>
        </div>

        <div className="glass-panel glass-panel-interactive" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <Cpu size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Processing Engine</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>OpenCV DNN & TF.js</div>
          </div>
        </div>
      </div>

      {/* Workspace Preloads */}
      <div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={22} className="text-gradient" /> Test Pre-loaded Workspace Samples
        </h2>
        
        {loadingSamples ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ width: '16px', height: '16px' }} /> Loading workspace files...
          </div>
        ) : !backendOnline ? (
          <div className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-secondary)', borderStyle: 'dashed', textAlign: 'center' }}>
            Start the Python Flask backend to load sample files.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            
            {/* Image Samples Card */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Image size={18} style={{ color: 'var(--primary)' }} /> Click to Detect Objects in Images
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
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
                      background: '#111827'
                    }}
                    className="glass-panel-interactive"
                  >
                    <img 
                      src={`${API}/api/samples/images/${img}`} 
                      alt={img} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      color: '#fff'
                    }}>
                      {img.replace('.jpg', '').replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Video Samples Card */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Play size={18} style={{ color: '#8b5cf6' }} /> Click to Process Videos
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {samples.videos.map((vid) => (
                  <div
                    key={vid}
                    onClick={() => handleVideoSampleClick(vid)}
                    className="glass-panel glass-panel-interactive"
                    style={{
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'between',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(139, 92, 246, 0.1)',
                        color: '#8b5cf6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Play size={16} fill="#8b5cf6" />
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{vid}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Select Sample</span>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        )}
      </div>

      {/* How it works section */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HelpCircle size={20} style={{ color: 'var(--primary)' }} /> Object Detection Guide
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>MobileNet SSD</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              A highly optimized Caffe-based model. It is smaller (23MB) and runs extremely quickly even on systems without a dedicated GPU. Ideal for standard CPU deployments. Detects 20 object classes.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', color: '#8b5cf6', marginBottom: '0.5rem' }}>YOLOv3 (You Only Look Once)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              A deeper, state-of-the-art deep learning model trained on the COCO dataset. It uses a single convolutional network to predict bounding boxes and class probabilities. Highly accurate for 80 classes but requires more computing power.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', color: '#d946ef', marginBottom: '0.5rem' }}>Webcam (Browser SSD)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Leverages WebGL inside your browser using TensorFlow.js. By running client-side, it eliminates network latency entirely, giving you smooth real-time object detection at up to 60 FPS without installing any local CUDA/Python GPU libraries!
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
