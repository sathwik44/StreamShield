import React, { useState } from 'react';
import VideoPlayer from './VideoPlayer'; 
import MovieCatalog from './MovieCatalog'; 

export default function WatchScreen() {
  const currentSessionId = "sess_60a638c68114"; 

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMovieTitle, setCurrentMovieTitle] = useState("");
  const [currentMovieUrl, setCurrentMovieUrl] = useState("");

  const handlePlayMovie = (title: string, url: string) => {
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