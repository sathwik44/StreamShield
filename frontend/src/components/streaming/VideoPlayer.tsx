import React, { useRef, useState, useEffect } from 'react';

interface VideoPlayerProps {
  title: string;
  videoUrl: string;
  sessionId: string;
  onClose: () => void;
}

export default function VideoPlayer({ title, videoUrl, sessionId, onClose }: VideoPlayerProps) {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 md:p-12 animate-fade-in">
      
      <style>
        {`
          @keyframes floatAround {
            0% { top: 10%; left: 10%; }
            25% { top: 15%; left: 70%; }
            50% { top: 80%; left: 65%; }
            75% { top: 75%; left: 15%; }
            100% { top: 10%; left: 10%; }
          }
          .watermark-float {
            position: absolute;
            animation: floatAround 40s ease-in-out infinite;
          }
          :fullscreen {
            border-radius: 0 !important;
            border: none !important;
          }
        `}
      </style>

      {/* Top Bar with Title and Close Button ONLY */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <h2 className="text-white font-bold text-xl md:text-2xl">{title}</h2>
        <button 
          onClick={onClose} 
          className="text-red-500 font-bold hover:text-red-400 transition-colors flex items-center gap-2"
        >
          CLOSE X
        </button>
      </div>

      {/* THE TARGET CONTAINER (Group added for hover effects) */}
      <div 
        ref={playerContainerRef}
        className="relative w-full max-w-6xl aspect-video bg-black rounded-xl overflow-hidden border border-neutral-800 shadow-2xl group"
      >
        
        {/* The Invisible Watermark */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            <div className="watermark-float text-white/40 font-mono text-sm md:text-base font-bold tracking-widest select-none mix-blend-overlay drop-shadow-md">
              {sessionId}
            </div>
        </div>

        {/* 🚀 THE FIX: FLOATING FULLSCREEN BUTTON (Inside the container!) */}
        <button 
          onClick={toggleFullScreen}
          className="absolute bottom-6 right-6 z-40 bg-black/70 hover:bg-red-600 text-white px-4 py-2 rounded font-bold text-xs tracking-widest transition-all backdrop-blur-md border border-white/20 opacity-0 group-hover:opacity-100 shadow-lg"
        >
          {isFullscreen ? "⛶ EXIT FULLSCREEN" : "⛶ FULLSCREEN"}
        </button>

        {/* The YouTube iFrame */}
        <iframe 
            src={`${videoUrl}?autoplay=1&controls=1&modestbranding=1&rel=0&fs=0`} 
            className="w-full h-full" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            title={title}
        />
        
      </div>
    </div>
  );
}