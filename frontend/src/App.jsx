import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Image, Video, Camera, Database, Activity, Cpu, Terminal } from 'lucide-react';
import './App.css';
import API from './api';

// Component imports
import Dashboard from './components/Dashboard';
import ImageDetector from './components/ImageDetector';
import VideoDetector from './components/VideoDetector';
import WebcamDetector from './components/WebcamDetector';
import ModelHub from './components/ModelHub';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedSampleImage, setSelectedSampleImage] = useState(null);
  const [selectedSampleVideo, setSelectedSampleVideo] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [eventLogs, setEventLogs] = useState([
    { id: 1, type: 'system', text: 'YOLO Object Detection OS v3.2.1 initialized.' },
    { id: 2, type: 'system', text: 'TF.js WebGL sandbox loaded.' },
    { id: 3, type: 'api', text: 'Checking connection to backend...' }
  ]);

  // Poll backend status to check connectivity
  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch(`${API}/api/status`);
        if (res.ok) {
          setBackendOnline(true);
          setEventLogs(prev => {
            const hasConnected = prev.some(l => l.text.includes('API connected'));
            if (hasConnected) return prev;
            return [
              ...prev,
              { id: Date.now(), type: 'success', text: 'API connected. Flask backend online.' },
              { id: Date.now() + 1, type: 'system', text: 'MobileNet SSD / YOLOv3 weights ready.' }
            ];
          });
        } else {
          setBackendOnline(false);
        }
      } catch (err) {
        setBackendOnline(false);
        setEventLogs(prev => {
          const hasError = prev.some(l => l.text.includes('Flask server offline'));
          if (hasError) return prev;
          return [
            ...prev,
            { id: Date.now(), type: 'error', text: 'Flask server offline. Retrying...' }
          ];
        });
      }
    }
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  // Periodically add telemetry updates
  useEffect(() => {
    const telemetryMessages = [
      { type: 'system', text: 'System CPU temperature: 48°C (Nominal)' },
      { type: 'telemetry', text: 'Shader cache compiled. WebGL active.' },
      { type: 'api', text: 'Connection heartbeat: OK (ping 5ms)' },
      { type: 'telemetry', text: 'OpenCV frame pipeline: Idle' },
      { type: 'system', text: 'Memory garbage collection complete.' },
      { type: 'telemetry', text: 'Awaiting video feed stream activation...' }
    ];

    const interval = setInterval(() => {
      if (!backendOnline) return;
      const randMsg = telemetryMessages[Math.floor(Math.random() * telemetryMessages.length)];
      setEventLogs(prev => [
        ...prev.slice(-12),
        { id: Date.now(), type: randMsg.type, text: randMsg.text }
      ]);
    }, 15000);

    return () => clearInterval(interval);
  }, [backendOnline]);

  return (
    <div className="app-container">
      {/* Dynamic ambient grid layer */}
      <div className="bg-grid-ambient" />

      {/* Floating Translucent Sidebar */}
      <aside style={{
        width: '280px',
        background: 'var(--bg-sidebar)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 10
      }}>
        
        {/* Brand Logo Header */}
        <div style={{
          padding: '2rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: 'var(--primary-glow)'
          }}>
            <Cpu size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              YOLO
            </h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--accent-green)', fontWeight: 800, letterSpacing: '0.15em' }}>
              OBJECT DETECTION
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
            { id: 'image', label: 'Image Analyzer', icon: <Image size={18} /> },
            { id: 'video', label: 'Video Processor', icon: <Video size={18} /> },
            { id: 'webcam', label: 'Webcam Scanner', icon: <Camera size={18} /> },
            { id: 'modelhub', label: 'Model Hub', icon: <Database size={18} /> }
          ].map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? 'var(--primary-light)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.9rem',
                  textAlign: 'left',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    height: '60%',
                    width: '4px',
                    background: 'var(--primary)',
                    borderRadius: '0 4px 4px 0',
                    boxShadow: '0 0 10px var(--primary)'
                  }} />
                )}
                <span style={{ 
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.2s'
                }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>



      </aside>

      {/* Main Content Workspace */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
        {activeTab === 'dashboard' && (
          <Dashboard 
            onTabChange={setActiveTab} 
            selectSampleImage={setSelectedSampleImage}
            selectSampleVideo={setSelectedSampleVideo}
            backendOnline={backendOnline}
          />
        )}
        {activeTab === 'image' && (
          <ImageDetector 
            selectedSample={selectedSampleImage} 
            clearSample={() => setSelectedSampleImage(null)}
            backendOnline={backendOnline}
          />
        )}
        {activeTab === 'video' && (
          <VideoDetector 
            selectedSample={selectedSampleVideo} 
            clearSample={() => setSelectedSampleVideo(null)}
            backendOnline={backendOnline}
          />
        )}
        {activeTab === 'webcam' && (
          <WebcamDetector />
        )}
        {activeTab === 'modelhub' && (
          <ModelHub backendOnline={backendOnline} />
        )}
      </main>

    </div>
  );
}
