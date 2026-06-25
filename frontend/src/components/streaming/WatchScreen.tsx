import { useState } from 'react';
import VideoPlayer from './VideoPlayer'; 
import MovieCatalog from './MovieCatalog'; 

export default function WatchScreen() {
// Replace the hardcoded string with the dynamic session ID from local storage
  const currentSessionId = localStorage.getItem("session_id") || "GUEST_SESSION"; 

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMovieTitle, setCurrentMovieTitle] = useState("");
  const [currentMovieUrl, setCurrentMovieUrl] = useState("");

  const handlePlayMovie = async (title: string, url: string) => {
    // 1. Log the streaming event to the database
    await fetch(`${import.meta.env.VITE_API_URL}/api/logs/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_token: localStorage.getItem("session_id"),
        movie_title: title
      })
    });

    // 2. Proceed with playback
    setCurrentMovieTitle(title);
    setCurrentMovieUrl(url);
    setIsPlaying(true); 
};

  return (
    <div className="flex flex-col px-8 font-sans">
      
      {/* Main Content Area (Header was moved to App.tsx!) */}
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