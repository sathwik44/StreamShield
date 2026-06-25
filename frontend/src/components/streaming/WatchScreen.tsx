import { useState } from 'react';
import VideoPlayer from './VideoPlayer'; 
import MovieCatalog from './MovieCatalog'; 

export default function WatchScreen() {
  // Dynamically pull the session ID for the forensic watermark
  const currentSessionId = localStorage.getItem("session_id") || "GUEST_SESSION"; 

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMovieTitle, setCurrentMovieTitle] = useState("");
  const [currentMovieUrl, setCurrentMovieUrl] = useState("");

  const handlePlayMovie = async (title: string, url: string) => {
    try {
      // 1. Log the streaming event to your Render database
      await fetch(`${import.meta.env.VITE_API_URL}/api/logs/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: localStorage.getItem("session_id"),
          movie_title: title
        })
      });
    } catch (error) {
      console.error("Telemetry failed, but continuing playback:", error);
    }

    // 2. Proceed with video playback
    setCurrentMovieTitle(title);
    setCurrentMovieUrl(url);
    setIsPlaying(true); 
  };

  return (
    <div className="flex flex-col px-8 font-sans">
      
      {/* Main Content Area */}
      <div className="flex-grow flex flex-col max-w-7xl mx-auto w-full">
        {isPlaying ? (
          <VideoPlayer 
            title={currentMovieTitle} 
            videoUrl={currentMovieUrl} 
            sessionId={currentSessionId} 
            onClose={() => setIsPlaying(false)} 
          />
        ) : (
          <div className="space-y-6">
            <MovieCatalog onPlayClick={handlePlayMovie} />
          </div>
        )}
      </div>

    </div>
  );
}