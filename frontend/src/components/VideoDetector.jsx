import React, { useState, useEffect, useRef } from 'react';
import { Play, Film, AlertCircle, Trash2, Video, RefreshCw } from 'lucide-react';
import API from '../api';

export default function VideoDetector({ selectedSample, clearSample, backendOnline }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [model, setModel] = useState('mobilenet_ssd');
  const [confidence, setConfidence] = useState(0.5);
  const [threshold, setThreshold] = useState(0.3);

  const [taskId, setTaskId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [outputVideoUrl, setOutputVideoUrl] = useState(null);

  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (selectedSample) {
      const url = `${API}/api/samples/videos/${selectedSample}`;
      setVideoPreview(url);
      setVideoFile(null); // Indicates sample video
      setTaskId(null);
      setProcessing(false);
      setOutputVideoUrl(null);
      setStatus('idle');
      setError(null);
    }
  }, [selectedSample]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setTaskId(null);
      setProcessing(false);
      setOutputVideoUrl(null);
      setStatus('idle');
      setError(null);
      clearSample();
    }
  };

  const startVideoProcessing = async () => {
    if (!videoPreview) return;
    setProcessing(true);
    setError(null);
    setProgress(0);
    setStatus('processing');
    setOutputVideoUrl(null);

    const formData = new FormData();
    formData.append('model', model);
    formData.append('confidence', confidence);
    formData.append('threshold', threshold);

    if (videoFile) {
      formData.append('video', videoFile);
    } else if (selectedSample) {
      formData.append('sample_name', selectedSample);
    }

    try {
      const res = await fetch(`${API}/api/process-video`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        setTaskId(data.task_id);
        startPolling(data.task_id);
      } else {
        setError(data.error || "Failed to trigger video processing.");
        setProcessing(false);
        setStatus('error');
      }
    } catch (err) {
      setError("Server connection lost. Please verify the Flask server is running.");
      setProcessing(false);
      setStatus('error');
    }
  };

  const startPolling = (tid) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/video-progress/${tid}`);
        const data = await res.json();

        if (res.ok) {
          setProgress(data.progress || 0);
          
          if (data.status === 'success') {
            clearInterval(pollIntervalRef.current);
            setProcessing(false);
            setStatus('success');
            setOutputVideoUrl(`${API}${data.video_url}`);
          } else if (data.status === 'error') {
            clearInterval(pollIntervalRef.current);
            setProcessing(false);
            setStatus('error');
            setError(data.error || "Video processing task failed on the backend.");
          }
        }
      } catch (err) {
        clearInterval(pollIntervalRef.current);
        setProcessing(false);
        setStatus('error');
        setError("Error fetching video processing status.");
      }
    }, 1500); // Poll every 1.5 seconds
  };

  const clearAll = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setVideoFile(null);
    setVideoPreview(null);
    setTaskId(null);
    setProcessing(false);
    setProgress(0);
    setStatus('idle');
    setOutputVideoUrl(null);
    setError(null);
    clearSample();
  };

  return (
    <div className="animate-slide-up" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', minHeight: 'calc(100vh - 64px)' }}>
      
      {/* Sidebar Configurations */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
        <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <Film size={20} className="text-gradient" /> Video Settings
        </h2>

        {/* Model Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Detection Model</label>
          <select 
            value={model} 
            onChange={(e) => setModel(e.target.value)}
            disabled={processing}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: processing ? 'not-allowed' : 'pointer',
              opacity: processing ? 0.6 : 1,
              fontSize: '0.9rem'
            }}
          >
            <option value="mobilenet_ssd">MobileNet SSD (Caffe)</option>
            <option value="yolov3">YOLOv3 (COCO - 240MB)</option>
            <option value="yolov3_tiny">YOLOv3-Tiny (COCO - 35MB)</option>
          </select>
        </div>

        {/* Confidence Threshold */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-secondary)' }}>Confidence</span>
            <span style={{ color: 'var(--primary)' }} className="text-glow-primary">{Math.round(confidence * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="0.9" 
            step="0.05" 
            value={confidence} 
            onChange={(e) => setConfidence(parseFloat(e.target.value))} 
            disabled={processing}
          />
        </div>

        {/* NMS Threshold */}
        {model.startsWith('yolo') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--text-secondary)' }}>NMS Suppression</span>
              <span style={{ color: 'var(--primary)' }} className="text-glow-primary">{threshold}</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="0.8" 
              step="0.05" 
              value={threshold} 
              onChange={(e) => setThreshold(parseFloat(e.target.value))} 
              disabled={processing}
            />
          </div>
        )}

        {/* Run Button */}
        <button 
          onClick={startVideoProcessing}
          disabled={processing || !videoPreview || !backendOnline}
          style={{
            padding: '0.85rem',
            background: processing || !videoPreview || !backendOnline ? 'rgba(0,0,0,0.02)' : 'var(--primary-gradient)',
            border: 'none',
            borderRadius: '8px',
            color: processing || !videoPreview || !backendOnline ? 'var(--text-muted)' : '#fff',
            fontWeight: 700,
            cursor: processing || !videoPreview || !backendOnline ? 'not-allowed' : 'pointer',
            transition: 'all 0.25s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '0.5rem',
            opacity: processing || !videoPreview || !backendOnline ? 0.4 : 1,
            boxShadow: processing || !videoPreview || !backendOnline ? 'none' : '0 0 15px rgba(16,185,129,0.2)'
          }}
        >
          {processing ? (
            <>
              <RefreshCw className="spinner" size={16} />
              Processing ({progress}%)
            </>
          ) : (
            <>
              <Play size={16} fill="#fff" style={{ stroke: 'none' }} />
              Process Video
            </>
          )}
        </button>

        {!backendOnline && (
          <div className="glass-panel" style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)', fontSize: '0.75rem', color: '#f87171', display: 'flex', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>Python server offline. Start Flask backend.</span>
          </div>
        )}
      </div>

      {/* Main View Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {!videoPreview ? (
          <div 
            className="glass-panel glass-panel-interactive" 
            style={{ 
              borderStyle: 'dashed', 
              borderWidth: '2px', 
              borderColor: 'var(--border-color)',
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '6rem 2rem',
              gap: '1rem',
              cursor: 'pointer'
            }}
            onClick={() => document.getElementById('video-upload-input').click()}
          >
            <input 
              id="video-upload-input" 
              type="file" 
              accept="video/*" 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.08)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)'
            }}>
              <Video size={32} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Upload Video File</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supports MP4, AVI, MOV up to 50MB</p>
            </div>
            <button className="glass-panel" style={{ padding: '0.5rem 1.25rem', background: 'rgba(0,0,0,0.02)', fontSize: '0.85rem', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
              Browse Files
            </button>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Selected Video: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedSample || (videoFile && videoFile.name) || 'Custom Upload'}</span>
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={clearAll}
                  disabled={processing}
                  className="glass-panel" 
                  style={{ 
                    padding: '0.45rem 1rem', 
                    background: 'rgba(239, 68, 68, 0.05)', 
                    borderColor: 'rgba(239, 68, 68, 0.15)', 
                    fontSize: '0.8rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.3rem', 
                    cursor: processing ? 'not-allowed' : 'pointer', 
                    color: '#f87171',
                    opacity: processing ? 0.5 : 1,
                    fontWeight: 600
                  }}
                >
                  <Trash2 size={14} /> Clear Video
                </button>
              </div>
            </div>

            {/* Video Player & Processing Overlay wrapped in HUD Frame */}
            <div className="hud-frame" style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '380px',
              background: '#f8fafc'
            }}>
              
              {/* HUD Brackets */}
              <div className="hud-bracket hud-bracket-tl" />
              <div className="hud-bracket hud-bracket-tr" />
              <div className="hud-bracket hud-bracket-bl" />
              <div className="hud-bracket hud-bracket-br" />

              {/* Scanning effect */}
              {videoPreview && status !== 'processing' && (
                <div className="hud-scan-line" />
              )}

              {status === 'processing' && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(248, 250, 252, 0.95)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.5rem',
                  zIndex: 5
                }}>
                  {/* Reactor Core progress design */}
                  <div style={{ position: 'relative', width: '110px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    
                    {/* Spinning reactor core elements */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      border: '2px dashed rgba(16, 185, 129, 0.25)',
                      animation: 'spin 12s linear infinite'
                    }} />

                    <svg style={{ width: '100px', height: '100px', transform: 'rotate(-90deg)' }}>
                      <circle 
                        cx="50" cy="50" r="42" 
                        stroke="rgba(0,0,0,0.02)" strokeWidth="6" fill="transparent" 
                      />
                      <circle 
                        cx="50" cy="50" r="42" 
                        stroke="url(#reactorGradient)" strokeWidth="6" fill="transparent" 
                        strokeDasharray={263.8}
                        strokeDashoffset={263.8 - (263.8 * progress) / 100}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
                      />
                      <defs>
                        <linearGradient id="reactorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="50%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                      textShadow: '0 0 5px rgba(16, 185, 129, 0.25)'
                    }}>
                      {Math.round(progress)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Analyzing Frame Pipeline...</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Applying neural weights. Multi-threading active on Flask core.</p>
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(248, 250, 252, 0.98)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem',
                  padding: '2rem',
                  textAlign: 'center',
                  zIndex: 5
                }}>
                  <AlertCircle size={40} style={{ color: '#ef4444' }} />
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f87171', marginBottom: '0.25rem' }}>Video Processing Failed</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '400px' }}>{error}</p>
                  </div>
                  <button 
                    onClick={startVideoProcessing}
                    className="glass-panel" 
                    style={{ padding: '0.5rem 1.25rem', background: 'rgba(0,0,0,0.02)', fontSize: '0.8rem', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Show original preview or processed video player */}
              {status === 'success' && outputVideoUrl ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ background: 'rgba(16,185,129,0.06)', borderBottom: '1px solid rgba(16,185,129,0.15)', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>
                    <RefreshCw size={14} className="pulse-indicator" /> DNN Render Complete! Ready for H.264 streaming.
                  </div>
                  <video 
                    key={outputVideoUrl}
                    controls 
                    autoPlay
                    muted
                    playsInline
                    style={{ display: 'block', width: '100%', maxHeight: '420px', background: '#000' }}
                  >
                    <source src={outputVideoUrl} type="video/mp4; codecs=avc1.42E01E" />
                    <source src={outputVideoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
                    <a 
                      href={outputVideoUrl} 
                      download="detected_objects.mp4"
                      style={{
                        padding: '0.6rem 2rem',
                        background: 'var(--primary-gradient)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 700,
                        textDecoration: 'none',
                        fontSize: '0.85rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 0 15px rgba(16,185,129,0.2)'
                      }}
                    >
                      <Film size={16} /> Download Processed Video
                    </a>
                  </div>
                </div>
              ) : (
                videoPreview && status !== 'processing' && (
                  <video 
                    src={videoPreview} 
                    controls 
                    style={{ display: 'block', width: '100%', maxHeight: '450px' }} 
                  />
                )
              )}

            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
