import React, { useState, useRef, useEffect } from 'react';
import { Upload, Sliders, Image, Download, Trash2, FileJson, AlertCircle } from 'lucide-react';
import API from '../api';

export default function ImageDetector({ selectedSample, clearSample, backendOnline }) {
  const [image, setImage] = useState(null);           // Uploaded File object
  const [imagePreview, setImagePreview] = useState(null); // Preview URL
  const [activeSample, setActiveSample] = useState(null); // Persisted sample name

  const [model, setModel] = useState('mobilenet_ssd');
  const [confidence, setConfidence] = useState(0.5);
  const [threshold, setThreshold] = useState(0.4);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('interactive');
  const [hoveredBoxIndex, setHoveredBoxIndex] = useState(null);

  const [imgDims, setImgDims] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const imgRef = useRef(null);

  // Resize listener to recalculate SVG boxes dynamically
  useEffect(() => {
    function handleResize() {
      if (imgRef.current) {
        setImgDims({
          width: imgRef.current.clientWidth,
          height: imgRef.current.clientHeight,
          naturalWidth: imgRef.current.naturalWidth || 1,
          naturalHeight: imgRef.current.naturalHeight || 1
        });
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [results, viewMode]);

  // When a sample is selected from the Dashboard, store it locally and show preview
  useEffect(() => {
    if (selectedSample) {
      setActiveSample(selectedSample);
      setImage(null);
      setImagePreview(`${API}/api/samples/images/${selectedSample}`);
      setResults(null);
      setError(null);
    }
  }, [selectedSample]);

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImgDims({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
        naturalWidth: imgRef.current.naturalWidth,
        naturalHeight: imgRef.current.naturalHeight
      });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setActiveSample(null);
      setImagePreview(URL.createObjectURL(file));
      setResults(null);
      setError(null);
      clearSample();
    }
  };

  const triggerDetection = async () => {
    if (!imagePreview) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('model', model);
    formData.append('confidence', confidence);
    formData.append('threshold', threshold);

    if (image) {
      formData.append('image', image);
    } else if (activeSample) {
      formData.append('sample_name', activeSample);
    } else {
      setError('No image selected. Please upload an image or pick a sample.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/api/detect`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        setResults(data);
      } else {
        setError(data.error || 'Object detection failed.');
      }
    } catch (err) {
      setError('Unable to connect to the Flask server. Make sure it is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setImage(null);
    setActiveSample(null);
    setImagePreview(null);
    setResults(null);
    setError(null);
    clearSample();
  };

  const getClassStats = () => {
    if (!results || !results.detections) return [];
    const stats = {};
    results.detections.forEach(d => {
      stats[d.class] = (stats[d.class] || 0) + 1;
    });
    return Object.entries(stats).map(([className, count]) => ({ className, count }));
  };

  const stats = getClassStats();
  const maxCount = stats.length > 0 ? Math.max(...stats.map(s => s.count)) : 1;

  const exportJSON = () => {
    if (!results) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results.detections, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `detections_${model}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="animate-slide-up" style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', minHeight: 'calc(100vh - 64px)' }}>
      
      {/* Sidebar - Settings Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
        <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
          <Sliders size={20} className="text-gradient" /> Configurations
        </h2>
        
        {/* Model Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Detection Model</label>
          <select 
            value={model} 
            onChange={(e) => setModel(e.target.value)}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
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
            <span style={{ color: 'var(--text-secondary)' }}>Min Confidence</span>
            <span style={{ color: 'var(--primary)' }} className="text-glow-primary">{Math.round(confidence * 100)}%</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="0.95" 
            step="0.05" 
            value={confidence} 
            onChange={(e) => setConfidence(parseFloat(e.target.value))} 
          />
        </div>

        {/* NMS Threshold */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
            <span style={{ color: 'var(--text-secondary)' }}>NMS Threshold</span>
            <span style={{ color: 'var(--primary)' }} className="text-glow-primary">{threshold}</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="0.8" 
            step="0.05" 
            value={threshold} 
            onChange={(e) => setThreshold(parseFloat(e.target.value))} 
          />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '-0.25rem', opacity: 0.8 }}>
            Higher = keep more overlapping boxes (dense scenes)
          </p>
        </div>

        {/* Run Button */}
        <button 
          onClick={triggerDetection}
          disabled={loading || !imagePreview || !backendOnline}
          style={{
            padding: '0.85rem',
            background: loading || !imagePreview || !backendOnline ? 'rgba(0,0,0,0.02)' : 'var(--primary-gradient)',
            border: 'none',
            borderRadius: '8px',
            color: loading || !imagePreview || !backendOnline ? 'var(--text-muted)' : '#fff',
            fontWeight: 700,
            cursor: loading || !imagePreview || !backendOnline ? 'not-allowed' : 'pointer',
            transition: 'all 0.25s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '0.5rem',
            opacity: loading || !imagePreview || !backendOnline ? 0.4 : 1,
            boxShadow: loading || !imagePreview || !backendOnline ? 'none' : '0 0 15px rgba(16,185,129,0.2)'
          }}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ width: '16px', height: '16px' }} />
              Running Engine...
            </>
          ) : (
            'Process Image'
          )}
        </button>

        {/* Status Warnings */}
        {!backendOnline && (
          <div className="glass-panel" style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)', fontSize: '0.75rem', color: '#f87171', display: 'flex', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>Python server offline. Start Flask backend.</span>
          </div>
        )}
      </div>

      {/* Main Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Upload Container */}
        {!imagePreview ? (
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
            onClick={() => document.getElementById('image-upload-input').click()}
          >
            <input 
              id="image-upload-input" 
              type="file" 
              accept="image/*" 
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
              <Upload size={32} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Drag & Drop Image Here</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supports PNG, JPG, JPEG up to 10MB</p>
            </div>
            <button className="glass-panel" style={{ padding: '0.5rem 1.25rem', background: 'rgba(0,0,0,0.02)', fontSize: '0.85rem', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
              Browse Files
            </button>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setViewMode('interactive')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: viewMode === 'interactive' ? 'var(--primary)' : 'var(--border-color)',
                    background: viewMode === 'interactive' ? 'var(--primary-light)' : 'transparent',
                    color: viewMode === 'interactive' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  Interactive SVG
                </button>
                <button 
                  onClick={() => setViewMode('server-drawn')}
                  disabled={!results}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: viewMode === 'server-drawn' ? 'var(--primary)' : 'var(--border-color)',
                    background: viewMode === 'server-drawn' ? 'var(--primary-light)' : 'transparent',
                    color: viewMode === 'server-drawn' ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: results ? 'pointer' : 'not-allowed',
                    opacity: results ? 1 : 0.5,
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  Server Rendered
                </button>
              </div>

              {results && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Detected <span style={{ fontWeight: 700, color: 'var(--accent-green)' }} className="text-glow-green">{results.detections.length}</span> objects in <span style={{ fontWeight: 700, color: 'var(--primary)' }} className="text-glow-primary">{results.latency_ms}ms</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {results && (
                  <button 
                    onClick={exportJSON}
                    className="glass-panel" 
                    style={{ padding: '0.45rem 0.9rem', background: 'rgba(0,0,0,0.02)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}
                  >
                    <FileJson size={14} /> Export JSON
                  </button>
                )}
                {results && viewMode === 'server-drawn' && (
                  <a 
                    href={results.annotated_image} 
                    download="detected_objects.jpg" 
                    className="glass-panel" 
                    style={{ padding: '0.45rem 0.9rem', background: 'rgba(0,0,0,0.02)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 600 }}
                  >
                    <Download size={14} /> Save Image
                  </a>
                )}
                <button 
                  onClick={clearAll}
                  className="glass-panel" 
                  style={{ padding: '0.45rem 0.9rem', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.15)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: '#f87171', fontWeight: 600 }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>

            {/* Viewport Box - Wrapped in HUD frame */}
            <div className="hud-frame" style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              maxHeight: '520px',
              minHeight: '320px'
            }}>
              
              {/* Corner brackets */}
              <div className="hud-bracket hud-bracket-tl" />
              <div className="hud-bracket hud-bracket-tr" />
              <div className="hud-bracket hud-bracket-bl" />
              <div className="hud-bracket hud-bracket-br" />

              {/* Scanning laser line */}
              {imagePreview && !loading && (
                <div className="hud-scan-line" />
              )}

              {loading && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(248, 250, 252, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem',
                  zIndex: 10
                }}>
                  <div className="spinner" style={{ width: '40px', height: '40px' }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Scanning Image Channels...</span>
                </div>
              )}

              {viewMode === 'interactive' || !results ? (
                // Original Image + SVG bounding box overlay
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img 
                    ref={imgRef}
                    src={imagePreview} 
                    alt="Upload Preview" 
                    onLoad={handleImageLoad}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }} 
                  />
                  {results && results.detections && (
                    <svg 
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'all'
                      }}
                      viewBox={`0 0 ${imgDims.width} ${imgDims.height}`}
                    >
                      <defs>
                        <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="2.5" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <filter id="glowForest" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3.5" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {results.detections.map((det, index) => {
                        const scaleX = imgDims.width / imgDims.naturalWidth;
                        const scaleY = imgDims.height / imgDims.naturalHeight;
                        const [x, y, w, h] = det.box;
                        
                        const sx = x * scaleX;
                        const sy = y * scaleY;
                        const sw = w * scaleX;
                        const sh = h * scaleY;

                        const isHovered = hoveredBoxIndex === index;

                        return (
                          <g 
                            key={index}
                            onMouseEnter={() => setHoveredBoxIndex(index)}
                            onMouseLeave={() => setHoveredBoxIndex(null)}
                            style={{ cursor: 'pointer' }}
                          >
                            {/* Bounding box outline */}
                            <rect 
                              x={sx} 
                              y={sy} 
                              width={sw} 
                              height={sh} 
                              fill={isHovered ? 'rgba(16, 185, 129, 0.08)' : 'transparent'} 
                              stroke={isHovered ? '#059669' : '#10b981'}
                              strokeWidth={isHovered ? '2.5' : '1.5'}
                              filter={isHovered ? 'url(#glowForest)' : 'url(#glowGreen)'}
                              style={{ transition: 'all 0.15s ease' }}
                            />
                            {/* Class name Tag */}
                            <g>
                              <rect 
                                x={sx} 
                                y={sy - 18 > 0 ? sy - 18 : sy} 
                                width={Math.max(sw * 0.45, 80)} 
                                height="18" 
                                fill={isHovered ? '#059669' : '#10b981'} 
                                filter={isHovered ? 'url(#glowForest)' : 'url(#glowGreen)'}
                                style={{ transition: 'all 0.15s ease' }}
                              />
                              <text 
                                x={sx + 5} 
                                y={sy - 18 > 0 ? sy - 5 : sy + 13} 
                                fill="#ffffff" 
                                fontSize="9px" 
                                fontWeight="800"
                                fontFamily="var(--font-mono)"
                              >
                                {det.class.toUpperCase()}
                              </text>
                            </g>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              ) : (
                // Hard-rendered static annotated image from OpenCV Server
                <img 
                  src={results.annotated_image} 
                  alt="Detections Rendered" 
                  style={{ display: 'block', maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }} 
                />
              )}

            </div>
          </div>
        )}

        {/* Results Analytics and Class List */}
        {results && results.detections && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
            
            {/* Details Table */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Detected Categories</h3>
              
              {results.detections.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
                  No objects matching the confidence parameters were found.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Category</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Confidence</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Dimensions (W x H)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.detections.map((det, index) => (
                        <tr 
                          key={index} 
                          onMouseEnter={() => setHoveredBoxIndex(index)}
                          onMouseLeave={() => setHoveredBoxIndex(null)}
                          style={{ 
                            borderBottom: '1px solid rgba(16, 185, 129, 0.05)', 
                            background: hoveredBoxIndex === index ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                        >
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: hoveredBoxIndex === index ? '#059669' : 'var(--text-primary)' }}>
                            {det.class}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{ 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '6px', 
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                              background: det.confidence > 0.7 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                              color: det.confidence > 0.7 ? '#10b981' : '#f59e0b',
                              border: det.confidence > 0.7 ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(245,158,11,0.15)'
                            }}>
                              {Math.round(det.confidence * 100)}%
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {det.box[2]}px × {det.box[3]}px
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Custom SVG Distribution Chart */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Object Distribution</h3>
              
              {stats.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center', fontSize: '0.85rem' }}>
                  No statistics available.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginTop: '0.5rem' }}>
                  {stats.map((s, idx) => {
                    const widthPercent = (s.count / maxCount) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.className}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{s.count} {s.count > 1 ? 'detections' : 'detection'}</span>
                        </div>
                        <div style={{
                          height: '6px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${widthPercent}%`,
                            background: 'var(--primary-gradient)',
                            borderRadius: '4px',
                            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
