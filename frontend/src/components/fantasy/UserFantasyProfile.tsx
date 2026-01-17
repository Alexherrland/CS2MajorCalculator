import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import GridPattern from '../GridPattern';
import { getUserFantasyProfile } from '../../services/tournamentService';
import { UserFantasyProfileData, FantasyPhasePickData, FantasyPlayoffPickData, FantasyTeamDetail } from '../../types/fantasyTypes';
import StageSelector from '../StageSelector';
import UserProfileStagePicksDisplay from './UserProfileStagePicksDisplay';
import UserProfilePlayoffPicksDisplay from './UserProfilePlayoffPicksDisplay';

// Iconos SVG en línea
const ArrowLeftIconSVG = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const UserCircleIconSVG = ({ className = "w-10 h-10" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TrophyIconSVG = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0012.75 9.75h-1.5A3.375 3.375 0 007.5 13.5v4.5m4.406-9.194a3.375 3.375 0 014.188 0M9.688 9.556a3.375 3.375 0 014.624 0M12 3.375c-3.87 0-7.125 2.036-7.125 4.562c0 .856.345 1.653.906 2.278M12 3.375c3.87 0 7.125 2.036 7.125 4.562c0 .856-.345 1.653-.906 2.278" />
  </svg>
);

const CalendarDaysIconSVG = ({ className = "w-7 h-7" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
);

const CheckCircleIconSVG = ({ className = "w-3.5 h-3.5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const XCircleIconSVG = ({ className = "w-16 h-16" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LockClosedIconSVG = ({ className = "w-3.5 h-3.5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 9v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
);

const ClockIconSVG = ({ className = "w-3.5 h-3.5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// ShieldCheckIconSVG (si se necesita, copiar desde FantasyDashboard)

const UserFantasyProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [profileData, setProfileData] = useState<UserFantasyProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPickKey, setSelectedPickKey] = useState<string | null>(null);

  useEffect(() => {
    if (username) {
      setIsLoading(true);
      setError(null);
      setSelectedPickKey(null); // Reset on new username load
      getUserFantasyProfile(username)
        .then(data => {
          setProfileData(data);
          // Default selection logic
          let defaultPickKey: string | null = null;
          if (data.phase_picks && data.phase_picks.length > 0) {
            const activePhasePick = data.phase_picks.find(p => !p.is_locked && !p.is_finalized);
            if (activePhasePick) {
              defaultPickKey = `phase-pick-${activePhasePick.id}`;
            } else {
              // If no active, take the last one (assuming higher ID = more recent)
              // Or sort by updated_at if available and consistently formatted
              const sortedPhasePicks = [...data.phase_picks].sort((a, b) => b.id - a.id);
              if (sortedPhasePicks.length > 0) {
                 defaultPickKey = `phase-pick-${sortedPhasePicks[0].id}`;
              }
            }
          }

          if (!defaultPickKey && data.playoff_picks && data.playoff_picks.length > 0) {
            const activePlayoffPick = data.playoff_picks.find(p => !p.is_locked && !p.is_finalized);
            if (activePlayoffPick) {
              defaultPickKey = `playoff-pick-${activePlayoffPick.id}`;
            } else {
              const sortedPlayoffPicks = [...data.playoff_picks].sort((a,b) => b.id - a.id);
              if (sortedPlayoffPicks.length > 0) {
                defaultPickKey = `playoff-pick-${sortedPlayoffPicks[0].id}`;
              }
            }
          }
          
          if (defaultPickKey) {
            setSelectedPickKey(defaultPickKey);
          } else if (data.phase_picks?.length > 0) { // Fallback to first available if no active/last logic matched
            setSelectedPickKey(`phase-pick-${data.phase_picks[0].id}`);
          } else if (data.playoff_picks?.length > 0) {
            setSelectedPickKey(`playoff-pick-${data.playoff_picks[0].id}`);
          }

        })
        .catch(err => {
          console.error(`Error fetching profile for ${username}:`, err);
          if (err.response && err.response.status === 404) {
            setError("Perfil de usuario no encontrado.");
          } else {
            setError("No se pudo cargar el perfil. Inténtalo de nuevo más tarde.");
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [username]);

  const availablePicksForSelector = useMemo(() => {
    if (!profileData) return [];
    const phasePicksItems = profileData.phase_picks.map(pick => ({
      id: `phase-pick-${pick.id}`,
      name: pick.stage_name || `Fase (ID: ${pick.stage})`, 
    }));
    const playoffPicksItems = profileData.playoff_picks.map(pick => ({
      id: `playoff-pick-${pick.id}`,
      name: `Playoffs: ${pick.tournament_name || `(ID: ${pick.tournament_id})`}`, 
    }));
    return [...phasePicksItems, ...playoffPicksItems];
  }, [profileData]);

  const selectedPickRenderData = useMemo(() => {
    if (!selectedPickKey || !profileData) return null;

    if (selectedPickKey.startsWith('phase-pick-')) {
      const pickId = parseInt(selectedPickKey.substring('phase-pick-'.length), 10);
      const pickDetail = profileData.phase_picks.find(p => p.id === pickId);
      if (pickDetail) {
        return { type: 'phase' as const, data: pickDetail, name: pickDetail.stage_name || `Fase (ID: ${pickDetail.stage})` };
      }
    } else if (selectedPickKey.startsWith('playoff-pick-')) {
      const pickId = parseInt(selectedPickKey.substring('playoff-pick-'.length), 10);
      const pickDetail = profileData.playoff_picks.find(p => p.id === pickId);
      if (pickDetail) {
        return { type: 'playoff' as const, data: pickDetail, name: `Playoffs: ${pickDetail.tournament_name || `(ID: ${pickDetail.tournament_id})`}` };
      }
    }
    return null;
  }, [selectedPickKey, profileData]);

  const renderTeamPicks = (teams: FantasyTeamDetail[], categoryTitle: string) => {
    if (!teams || teams.length === 0) {
      return (
        <div className="mt-2">
          <h4 className="text-sm font-semibold text-neutral-300">{categoryTitle}:</h4>
          <p className="text-xs text-neutral-500">Ninguna selección.</p>
        </div>
      );
    }
    return (
      <div className="mt-2">
        <h4 className="text-sm font-semibold text-neutral-300 mb-1">{categoryTitle}:</h4>
        <div className="flex flex-wrap gap-2">
          {teams.map(team => (
            <div key={team.id} title={team.name} className="flex items-center bg-neutral-700 px-2 py-1 rounded-md text-xs">
              {team.logo && <img src={team.logo} alt={team.name} className="w-4 h-4 mr-1.5 rounded-sm object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              <span className="text-neutral-200">{team.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getStatusIconAndColor = (isLocked: boolean, isFinalized: boolean, fantasyStatus?: string) => {
    if (isFinalized) return { Icon: CheckCircleIconSVG, color: 'text-green-400', text: 'Finalizado' };
    if (isLocked) return { Icon: LockClosedIconSVG, color: 'text-red-400', text: 'Cerrado' };
    if (fantasyStatus === 'OPEN') return { Icon: ClockIconSVG, color: 'text-yellow-400', text: 'Abierto' };
    // Si fantasyStatus no está disponible, pero no está locked ni finalized, podemos asumir 'Abierto' o un estado "Pendiente" más genérico.
    // Si solo tenemos isLocked y isFinalized, la lógica original sería así:
    if (!isLocked && !isFinalized) return { Icon: ClockIconSVG, color: 'text-yellow-400', text: 'Abierto'}; // O 'Pendiente' si no es seguro
    return { Icon: ClockIconSVG, color: 'text-neutral-500', text: 'Pendiente' }; // Estado por defecto
  };

  const renderPhasePick = (pick: FantasyPhasePickData) => {
    // No se pasa fantasy_status explícitamente, ya que no está en FantasyPhasePickData
    const { Icon, color, text } = getStatusIconAndColor(pick.is_locked, pick.is_finalized);
    return (
      <div key={`summary-phase-${pick.id}`} className="bg-neutral-800 p-4 rounded-lg shadow-md mb-4 border-l-4 border-primary-500">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-primary-300">{pick.stage_name}</h3>
          <span className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${color.replace('text-','bg-')} bg-opacity-20 ${color}`}>
            <Icon className="w-3.5 h-3.5 mr-1" />
            {text}
          </span>
        </div>
        <p className="text-sm text-neutral-400 mb-1">Puntos Obtenidos: <span className="font-bold text-secondary-400">{pick.points_earned}</span></p>
        <p className="text-xs text-neutral-500 mb-3">Actualizado: {new Date(pick.updated_at).toLocaleDateString()}</p>
        {renderTeamPicks(pick.teams_3_0_details, 'Equipos 3-0')}
        {renderTeamPicks(pick.teams_advance_details, 'Equipos que Avanzan')}
        {renderTeamPicks(pick.teams_0_3_details, 'Equipos 0-3')}
      </div>
    );
  };

  const renderPlayoffPick = (pick: FantasyPlayoffPickData) => {
    // No se pasa fantasy_status explícitamente
    const { Icon, color, text } = getStatusIconAndColor(pick.is_locked, pick.is_finalized);
    // Esta función renderPlayoffPick (y renderPhasePick) ya no se usará para la vista principal
    // Se mantiene por si se quiere reintroducir un resumen en otro lugar, o si algún subcomponente la necesitara.
    // Pero la lógica principal ahora muestra UserProfileStagePicksDisplay o UserProfilePlayoffPicksDisplay.
    return (
      <div key={`summary-playoff-${pick.id}`} className="bg-neutral-800 p-4 rounded-lg shadow-md mb-4 border-l-4 border-secondary-500">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-secondary-300">Playoffs: {pick.tournament_name}</h3>
           <span className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${color.replace('text-','bg-')} bg-opacity-20 ${color}`}>
            <Icon className="w-3.5 h-3.5 mr-1" />
            {text}
          </span>
        </div>
        <p className="text-sm text-neutral-400 mb-1">Puntos Obtenidos: <span className="font-bold text-secondary-400">{pick.points_earned}</span></p>
        <p className="text-xs text-neutral-500 mb-3">Actualizado: {new Date(pick.updated_at).toLocaleDateString()}</p>
        {renderTeamPicks(pick.quarter_final_winners_details, 'Ganadores Cuartos de Final')}
        {renderTeamPicks(pick.semi_final_winners_details, 'Ganadores Semifinales')}
        {pick.final_winner_details ? 
          renderTeamPicks([pick.final_winner_details], 'Campeón') : 
          renderTeamPicks([], 'Campeón')}
      </div>
    );
  };

  const commonPageClasses = "min-h-[calc(100vh-4rem)] relative isolate bg-black text-white";
  const commonContainerClasses = "relative z-10 max-w-6xl mx-auto p-4 sm:p-8 pt-8";

  if (isLoading) {
    return (
      <div className={`${commonPageClasses} flex items-center justify-center`}>
        <GridPattern />
        <p className="relative z-10">Cargando perfil...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${commonPageClasses} flex items-center justify-center`}>
        <GridPattern />
        <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center">
          <XCircleIconSVG className="w-16 h-16 text-red-500 mb-4" />
          <p className="text-red-400 text-xl mb-2">{error}</p>
          <RouterLink 
            to="/fantasy/leaderboard" 
            className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-md text-white font-semibold transition-colors flex items-center"
          >
            <ArrowLeftIconSVG className="w-5 h-5 mr-2" />
            Volver al Leaderboard
          </RouterLink>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className={`${commonPageClasses} flex items-center justify-center`}>
        <GridPattern />
        <p className="relative z-10">No se encontraron datos del perfil.</p>
      </div>
    );
  }
  
  return (
    <div className={commonPageClasses}>
      <GridPattern />
      <div className={commonContainerClasses}>
        <header className="mb-10 flex flex-col sm:flex-row items-center sm:items-end justify-between">
          <div className="flex items-center mb-4 sm:mb-0">
            {profileData.twitch_profile_image_url ? (
              <img 
                src={profileData.twitch_profile_image_url} 
                alt={profileData.twitch_username || profileData.user.username} 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-primary-500 shadow-lg"
              />
            ) : (
              <UserCircleIconSVG className="w-20 h-20 sm:w-24 sm:h-24 text-neutral-600 border-4 border-neutral-700 rounded-full p-1" />
            )}
            <div className="ml-4 sm:ml-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {profileData.twitch_username || profileData.user.username}
              </h1>
              {profileData.twitch_username && profileData.user.username !== profileData.twitch_username && (
                <p className="text-sm text-neutral-400">@{profileData.user.username}</p>
              )}
              <p className="text-lg text-neutral-300 flex items-center mt-1">
                <TrophyIconSVG className="w-5 h-5 mr-2 text-secondary-400" />
                Puntos Totales: <span className="font-bold text-xl ml-1 text-secondary-300">{profileData.total_fantasy_points}</span>
              </p>
            </div>
          </div>
          <RouterLink 
            to="/fantasy/leaderboard" 
            className="px-4 py-2 text-sm font-medium text-neutral-200 bg-neutral-700 hover:bg-neutral-600 rounded-md transition-colors flex items-center self-start sm:self-auto"
          >
            <ArrowLeftIconSVG className="w-4 h-4 mr-2" />
            Volver al Leaderboard
          </RouterLink>
        </header>

        <section>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-white flex items-center mb-4 sm:mb-0">
              <CalendarDaysIconSVG className="w-7 h-7 mr-3 text-primary-400" />
              Historial de Picks
            </h2>
          </div>

          {availablePicksForSelector.length > 0 ? (
            <StageSelector
              currentStage={selectedPickKey || ''} 
              onStageChange={(stageId) => setSelectedPickKey(stageId)}
              availableStages={availablePicksForSelector}
            />
          ) : (
            // Este mensaje solo se muestra si NO hay picks para el selector
            profileData.phase_picks.length === 0 && profileData.playoff_picks.length === 0 && (
                 <p className="text-neutral-400 italic text-center sm:text-left py-6">Este usuario no tiene ningún pick registrado.</p>
            )
          )}

          {selectedPickRenderData ? (
            <div className="my-6">
              <h3 className="text-xl font-bold text-center text-neutral-100 mb-1">
                {selectedPickRenderData.name}
              </h3>
              <p className="text-sm text-neutral-400 text-center mb-4">
                Puntos Obtenidos: <span className="font-bold text-secondary-400">{selectedPickRenderData.data.points_earned}</span>
              </p>
              {selectedPickRenderData.type === 'phase' && (
                <UserProfileStagePicksDisplay pickData={selectedPickRenderData.data as FantasyPhasePickData} />
              )}
              {selectedPickRenderData.type === 'playoff' && (
                <UserProfilePlayoffPicksDisplay pickData={selectedPickRenderData.data as FantasyPlayoffPickData} />
              )}
            </div>
          ) : (
            // Si no hay un pick seleccionado pero SÍ hay picks disponibles, 
            // se podría mostrar un mensaje o nada, ya que el selector está visible.
            // Ya no mostramos la lista de resumen aquí.
            availablePicksForSelector.length > 0 && (
              <p className="text-neutral-400 italic text-center py-6">
                Selecciona una fase o playoffs del menú superior para ver los detalles de los picks.
              </p>
            )
          )}
          {/* El mensaje de "ningún pick registrado" ya se maneja arriba si availablePicksForSelector está vacío */}
        </section>
      </div>
    </div>
  );
};

export default UserFantasyProfile; 