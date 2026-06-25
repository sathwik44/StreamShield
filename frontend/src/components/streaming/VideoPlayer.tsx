import { useState, useEffect } from 'react';

interface MovieCatalogProps {
  onPlayClick: (title: string, videoUrl: string) => void;
}

export default function MovieCatalog({ onPlayClick }: MovieCatalogProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const featuredMovies = [
    {
      id: 1,
      title: "Baahubali",
      tag: "BLOCKBUSTER PREMIERE",
      description: "An epic action drama centered around a legendary warrior kingdom, familial betrayal, and an exiled heir who returns to reclaim his rightful throne.",
      backdropUrl: "https://ksboxoffice.com/wp-content/uploads/2025/10/G4F6mdxXgAAhtFA-e1761936174468-1024x580.jpg", 
      // RESTORED YOUTUBE LINK
      streamUrl: "https://www.youtube.com/embed/22oYiWnAcKM" 
    },
    {
      id: 2,
      title: "The Lighter",
      tag: "FEATURED SHORT FILM",
      description: "A stylish, fast-paced cinematic short featuring brilliant practical lighting and high-tension scene composition.",
      backdropUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop", 
      // RESTORED YOUTUBE LINK
      streamUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" 
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % featuredMovies.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featuredMovies.length]);

  const activeMovie = featuredMovies[currentSlide];

  return (
    <div className="space-y-12 pb-12 animate-fade-in w-full">
      
      <div className="relative w-full h-[60vh] min-h-[450px] rounded-2xl overflow-hidden border border-neutral-800 group shadow-2xl transition-all duration-700">
        
        <div className="absolute inset-0 bg-gradient-to-r from-black via-neutral-950/90 to-transparent z-10"></div>
        
        <div key={`bg-${activeMovie.id}`} className="absolute inset-0 z-0 bg-black">
            <img 
              src={activeMovie.backdropUrl} 
              alt={activeMovie.title} 
              className="w-full h-full object-cover opacity-50 transition-opacity duration-1000" 
            />
        </div>
        
        <div key={`content-${activeMovie.id}`} className="absolute bottom-0 left-0 z-20 p-8 md:p-12 w-full md:w-2/3 animate-fade-in">
          <span className="text-red-600 font-black tracking-widest text-xs mb-3 block">{activeMovie.tag}</span>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tighter">{activeMovie.title}</h1>
          <p className="text-neutral-400 text-lg mb-8 max-w-xl line-clamp-3">
            {activeMovie.description}
          </p>
          
          <div className="flex space-x-4">
            <button 
              onClick={() => onPlayClick(activeMovie.title, activeMovie.streamUrl)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded flex items-center shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all hover:scale-105"
            >
              ▶ PLAY MOVIE
            </button>
            <button className="bg-neutral-800/80 hover:bg-neutral-700 text-white font-bold py-3 px-8 rounded backdrop-blur-sm border border-neutral-700 transition-all">
              MORE INFO
            </button>
          </div>
        </div>

        <div className="absolute bottom-6 right-8 z-30 flex space-x-2">
          {featuredMovies.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentSlide === index ? "w-8 bg-red-600" : "w-2 bg-neutral-600 hover:bg-neutral-400"
              }`}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-white font-bold text-xl border-l-4 border-red-600 pl-3 mb-6">
          Epic Action & Drama
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
          <div 
            onClick={() => onPlayClick("Baahubali", featuredMovies[0].streamUrl)}
            className="min-w-[280px] md:min-w-[320px] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-red-600 transition-all duration-300 snap-start cursor-pointer group"
          >
            <div className="aspect-video bg-black relative overflow-hidden flex items-center justify-center">
               <img 
                 src={featuredMovies[0].backdropUrl} 
                 alt="Baahubali Poster"
                 className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
               />
            </div>
            <div className="p-4">
              <h3 className="text-white font-bold group-hover:text-red-500 transition-colors">Baahubali</h3>
              <p className="text-neutral-500 text-xs mt-1">Action • Period Epic</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-white font-bold text-xl border-l-4 border-red-600 pl-3 mb-6">
          Indie Cinematography
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
          <div 
            onClick={() => onPlayClick("The Lighter", featuredMovies[1].streamUrl)}
            className="min-w-[280px] md:min-w-[320px] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-red-600 transition-all duration-300 snap-start cursor-pointer group"
          >
            <div className="aspect-video bg-black relative overflow-hidden flex items-center justify-center">
               <img 
                 src={featuredMovies[1].backdropUrl} 
                 alt="The Lighter Poster"
                 className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
               />
            </div>
            <div className="p-4">
              <h3 className="text-white font-bold group-hover:text-red-500 transition-colors">The Lighter</h3>
              <p className="text-neutral-500 text-xs mt-1">Short Film • Thriller</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}