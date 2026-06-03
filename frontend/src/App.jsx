import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Image, Video, Camera, Database, Activity, Cpu } from 'lucide-react';
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

  // Poll backend status to check connectivity
  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await fetch(`${API}/api/status`);
        if (res.ok) {
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch (err) {
        setBackendOnline(false);
      }
    }
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        background: 'var(--sidebar-gradient)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh'
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
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              Antigravity
            </h1>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, tracking: '0.05em' }}>
              VISION STUDIO
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
                  gap: '0.75rem',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? 'var(--primary-light)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.9rem',
                  textAlign: 'left',
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '25%',
                    height: '50%',
                    width: '4px',
                    background: 'var(--primary)',
                    borderRadius: '0 4px 4px 0'
                  }} />
                )}
                <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Server Status Indicators */}
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: backendOnline ? '#10b981' : '#ef4444',
              boxShadow: backendOnline ? '0 0 10px #10b981' : '0 0 10px #ef4444',
              animation: backendOnline ? 'none' : 'pulse-glow 1.5s infinite'
            }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {backendOnline ? 'API Connected' : 'API Offline'}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {backendOnline ? (import.meta.env.VITE_API_URL || 'localhost:5000') : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

      </aside>

      {/* Main Content Workspace */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', background: 'var(--bg-main)' }}>
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
