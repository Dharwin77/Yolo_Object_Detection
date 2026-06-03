import React, { useState, useEffect, useRef } from 'react';
import { Server, Download, CheckCircle, RefreshCw, Cpu, Database, AlertCircle } from 'lucide-react';
import API from '../api';

export default function ModelHub({ backendOnline }) {
  const [models, setModels] = useState({});
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(null);
  
  const progressPollIntervalRef = useRef(null);

  const fetchStatus = async () => {
    if (!backendOnline) return;
    try {
      const res = await fetch(`${API}/api/status`);
      const data = await res.json();
      if (res.ok) {
        setModels(data.models || {});
        
        // Handle download status if already active on server
        if (data.download_state && data.download_state.status === 'downloading') {
          setDownloadProgress(data.download_state);
          startPollingProgress();
        } else {
          setDownloadProgress(data.download_state);
        }
      }
    } catch (err) {
      console.error("Failed to query model status", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => {
      if (progressPollIntervalRef.current) clearInterval(progressPollIntervalRef.current);
    };
  }, [backendOnline]);

  const startPollingProgress = () => {
    if (progressPollIntervalRef.current) return; // Already polling

    progressPollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/download-progress`);
        const data = await res.json();
        
        if (res.ok) {
          setDownloadProgress(data);
          
          if (data.status === 'success' || data.status === 'error' || data.status === 'idle') {
            clearInterval(progressPollIntervalRef.current);
            progressPollIntervalRef.current = null;
            // Refetch all model status after download concludes
            fetchStatus();
          }
        }
      } catch (err) {
        console.error("Error polling download status", err);
      }
    }, 1000);
  };

  const triggerDownload = async (modelKey) => {
    try {
      setDownloadProgress({ model: modelKey, progress: 0, status: 'downloading', error: null });
      const res = await fetch(`${API}/api/download-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelKey })
      });
      const data = await res.json();
      
      if (res.ok) {
        startPollingProgress();
      } else {
        alert(data.error || "Failed to trigger model download.");
        setDownloadProgress(null);
      }
    } catch (err) {
      alert("Error contacting the download service.");
      setDownloadProgress(null);
    }
  };

  return (
    <div className="animate-slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          Model <span className="text-gradient">Manager Hub</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Configure model weights, download configurations, and inspect status.
        </p>
      </div>

      {/* Connection State Warning */}
      {!backendOnline && (
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle size={22} style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Python Server Disconnected</h4>
            <p style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.1rem' }}>The Model Hub requires the Python Flask API backend to check system file storage. Please run "python app.py".</p>
          </div>
        </div>
      )}

      {/* Downloading Progress Panel */}
      {downloadProgress && downloadProgress.status === 'downloading' && (
        <div className="glass-panel" style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(20,27,45,0.6) 100%)',
          borderColor: 'rgba(99, 102, 241, 0.3)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <RefreshCw className="spinner" size={16} /> Downloading Weights for {downloadProgress.model === 'yolov3' ? 'YOLOv3' : 'YOLOv3-Tiny'}...
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Downloading from Hugging Face CDN mirrors (ultra-fast)</span>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{downloadProgress.progress}%</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${downloadProgress.progress}%`, background: 'var(--primary-gradient)', borderRadius: '4px', transition: 'width 0.2s ease-out' }} />
            </div>
          </div>
        </div>
      )}

      {/* Model Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {loading && backendOnline ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <RefreshCw className="spinner" size={18} /> Inspecting filesystem status...
          </div>
        ) : (
          Object.entries(models).map(([key, info]) => {
            const isReady = info.status === 'ready';
            const isDownloadingThis = downloadProgress && downloadProgress.status === 'downloading' && downloadProgress.model === key;
            
            return (
              <div key={key} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: isReady ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                    color: isReady ? '#10b981' : '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {key === 'mobilenet_ssd' ? <Cpu size={24} /> : <Database size={24} />}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {info.name}
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '10px',
                        background: isReady ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: isReady ? '#34d399' : '#f87171'
                      }}>
                        {isReady ? 'READY TO RUN' : 'ASSETS MISSING'}
                      </span>
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      {key === 'mobilenet_ssd' && 'Preloaded Caffe framework. Instantly runnable on all platforms.'}
                      {key === 'yolov3' && 'Full 80-category COCO model. High accuracy, requires 240MB weights file download.'}
                      {key === 'yolov3_tiny' && 'Reduced parameter YOLOv3 network. High performance on standard CPUs, requires 35MB weights.'}
                    </p>
                  </div>
                </div>

                <div>
                  {isReady ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                      <CheckCircle size={16} /> Ready
                    </div>
                  ) : (
                    <button
                      onClick={() => triggerDownload(key)}
                      disabled={!backendOnline || isDownloadingThis || (downloadProgress && downloadProgress.status === 'downloading')}
                      className="glass-panel"
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(255,255,255,0.03)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: (!backendOnline || isDownloadingThis || (downloadProgress && downloadProgress.status === 'downloading')) ? 'not-allowed' : 'pointer',
                        opacity: (!backendOnline || isDownloadingThis || (downloadProgress && downloadProgress.status === 'downloading')) ? 0.4 : 1
                      }}
                    >
                      {isDownloadingThis ? (
                        <>
                          <RefreshCw className="spinner" size={14} /> Downloading
                        </>
                      ) : (
                        <>
                          <Download size={14} /> Fetch Model
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

      </div>
      
    </div>
  );
}
