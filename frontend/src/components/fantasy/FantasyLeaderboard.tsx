import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GridPattern from '../GridPattern';
import { getFantasyLeaderboard } from '../../services/tournamentService';
import { PaginatedLeaderboardResponse, LeaderboardEntry } from '../../types/fantasyTypes';

// Iconos SVG en línea
const ChevronLeftIconSVG = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIconSVG = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const UserCircleIconSVG = ({ className = "w-10 h-10" }) => ( // Ajustado tamaño por defecto si es necesario
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const FantasyLeaderboard: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<PaginatedLeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchLeaderboard(currentPage);
  }, [currentPage]);

  const fetchLeaderboard = (page: number) => {
    setIsLoading(true);
    getFantasyLeaderboard(page)
      .then(data => {
        setLeaderboardData(data);
        setError(null);
      })
      .catch(err => {
        console.error("Error fetching leaderboard:", err);
        setError("No se pudo cargar la tabla de clasificación. " + (err.response?.data?.error || err.message));
        setLeaderboardData(null);
      })
      .finally(() => setIsLoading(false));
  };

  const handlePreviousPage = () => {
    if (leaderboardData?.previous) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (leaderboardData?.next) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const commonPageClasses = "min-h-[calc(100vh-4rem)] relative isolate bg-black text-white";
  const commonContainerClasses = "relative z-10 container mx-auto p-4 sm:p-8 pt-8 text-white";

  if (isLoading && !leaderboardData) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
      <GridPattern />
      <p className="relative z-10">Cargando leaderboard...</p>
    </div>
  );
  if (error) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
      <GridPattern />
      <p className="relative z-10 text-red-500">Error: {error}</p>
    </div>
  );
  if (!leaderboardData || leaderboardData.results.length === 0) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
      <GridPattern />
      <p className="relative z-10">No hay datos en la leaderboard todavía.</p>
    </div>
  );
  return (
    <div className={commonPageClasses}>
      <GridPattern />
      <div className={commonContainerClasses.replace("p-4 text-white", "p-4")}>
       <h1 className="text-3xl font-bold mb-6 text-center">Fantasy Leaderboard</h1>
       
       <div className="overflow-x-auto bg-neutral-800 shadow-md rounded-lg">
        <table className="min-w-full table-auto">
          <thead className="bg-neutral-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-300 uppercase tracking-wider">Puntos Totales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {leaderboardData.results.map((entry, index) => {
              const rank = (currentPage - 1) * (leaderboardData.results.length / (leaderboardData.count > leaderboardData.results.length ? (leaderboardData.count / leaderboardData.results.length) : 1) ) + index + 1; // Cálculo del rank paginado
              // Ajuste para el cálculo del rank si el número de resultados por página varía.
              // Este cálculo asume un número fijo de resultados por página (implícito por DRF paginación).
              // Idealmente, el backend debería proveer el rank.
              const actualRank = entry.rank || rank;

              // Comprobaciones defensivas para user_profile y user_profile.user
              const userProfile = entry.user_profile;
              const userName = userProfile && userProfile.user ? userProfile.user.username : 'Usuario Desconocido';
              const twitchUsername = userProfile ? userProfile.twitch_username : '';
              const profileImageUrl = userProfile ? userProfile.twitch_profile_image_url : null;
              const displayUsername = twitchUsername || userName;

              return (
                <tr key={userProfile?.user?.id || `unknown-user-${index}`} className={`hover:bg-neutral-750 ${actualRank <= 3 ? 'bg-primary-900/30' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-lg font-semibold ${actualRank <= 3 ? 'text-primary-400' : 'text-white'}`}>
                      #{actualRank}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link to={`/fantasy/profile/${userName}`} className="flex items-center group">
                      {profileImageUrl ? (
                        <img 
                          className="h-10 w-10 rounded-full border-2 border-neutral-600 group-hover:border-primary-400 transition-colors"
                          src={profileImageUrl} 
                          alt={displayUsername} 
                        />
                      ) : (
                        <UserCircleIconSVG className="h-10 w-10 text-neutral-500 group-hover:text-primary-400 transition-colors" />
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-neutral-100 group-hover:text-primary-300 transition-colors">
                          {displayUsername}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-lg font-bold text-white">{entry.total_fantasy_points}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <button 
          onClick={handlePreviousPage} 
          disabled={!leaderboardData.previous}
          className="px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          <ChevronLeftIconSVG className="w-5 h-5 mr-1" />
          Anterior
        </button>
        <span className="text-sm text-neutral-400">Página {currentPage} de {leaderboardData.count > 0 ? Math.ceil(leaderboardData.count / leaderboardData.results.length) : 1}</span>
        <button 
          onClick={handleNextPage} 
          disabled={!leaderboardData.next}
          className="px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
        >
          Siguiente
          <ChevronRightIconSVG className="w-5 h-5 ml-1" />
        </button>
      </div>
      </div>
    </div>
  );
};

export default FantasyLeaderboard; 