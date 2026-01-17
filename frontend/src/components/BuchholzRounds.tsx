import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Team, Round, PreviousOpponent } from '../types/hltvTypes';

interface BuchholzRoundsProps {
  stage: string;
  rounds: Round[];
  teams: Team[];
  onMatchResult: (roundIndex: number, matchIndex: number, winnerId: number) => void;
  onStageChange: (stageId: string) => void;
  currentStage: string;
}

interface HoverPosition {
  top: number;
  left: number;
}

// Interfaz para almacenar el estado del equipo en cada ronda
interface TeamStateByRound {
  [teamId: number]: {
    [roundIndex: number]: {
      wins: number;
      losses: number;
    };
  };
}

// Helper function to determine winner based on backend scores
// This function will be placed outside the component or as a static method if preferred
function getBackendWinnerId(match: Round['matches'][0]): number | null {
  if (match.format === 'BO3') {
    if (typeof match.team1Score === 'number' && typeof match.team2Score === 'number') {
      if (match.team1Score > match.team2Score) return match.team1Id;
      if (match.team2Score > match.team1Score) return match.team2Id;
    }
  } else if (match.format === 'BO1') {
    if (typeof match.map1_team1_score === 'number' && typeof match.map1_team2_score === 'number') {
      if (match.map1_team1_score > match.map1_team2_score) return match.team1Id;
      if (match.map1_team2_score > match.map1_team1_score) return match.team2Id;
    }
  }
  return null; // No backend winner determined by scores
}

const BuchholzRounds: React.FC<BuchholzRoundsProps> = ({ 
  stage, 
  rounds, 
  teams, 
  onMatchResult, 
  onStageChange, 
  currentStage 
}) => {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [hoveredTeam, setHoveredTeam] = useState<number | null>(null);
  const [hoveredRound, setHoveredRound] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<HoverPosition>({ top: 0, left: 0 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Almacenar los estados de los equipos por ronda
  const [teamStateByRound, setTeamStateByRound] = useState<TeamStateByRound>({});
  // Nuevo ref para el timeout de hover del breakdown
  const hoverBreakdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<{ [key: number]: boolean }>({});

  const getTeamById = (id: number): Team | undefined => teams.find(team => team.id === id);

  // Función para obtener el seed visual ajustado según la fase, seguramente habrá que ajustarla para torneos con diferentes fases
  const getVisualSeed = (teamSeed: number, stageName: string): number => {
    console.log(stageName);
    if (stageName === 'phase1') {
      // Para la Fase 1 (Order 1), seeds 17-32 se mapean a 1-16
      if (teamSeed >= 17 && teamSeed <= 32) {
        return teamSeed - 16;
      }
    } else if (stageName === 'phase2') {
      // Para la Fase 2 (Order 2), seeds 9-24 se mapean a 1-16
      if (teamSeed >= 9 && teamSeed <= 24) {
        return teamSeed - 8;
      }
    }
    return teamSeed; // Devuelve el seed original si no es una de estas fases o el seed está fuera del rango esperado
  };

  // Calcular el estado de los equipos en cada ronda
  const calculateTeamStatesByRound = useCallback(() => {
    const statesByRound: TeamStateByRound = {};
    
    // Inicializar el estado para todos los equipos en todas las rondas
    teams.forEach(team => {
      if (!statesByRound[team.id]) {
        statesByRound[team.id] = {};
      }
      
      // Inicializar con 0-0 para cada ronda
      rounds.forEach((_, roundIndex) => {
        statesByRound[team.id][roundIndex] = { wins: 0, losses: 0 };
      });
    });
    
    // Calcular el estado acumulativo ronda por ronda
    rounds.forEach((round, roundIndex) => {
      // Primero, copiar el estado de la ronda anterior (si existe)
      if (roundIndex > 0) {
        teams.forEach(team => {
          statesByRound[team.id][roundIndex] = { 
            wins: statesByRound[team.id][roundIndex - 1].wins,
            losses: statesByRound[team.id][roundIndex - 1].losses
          };
        });
      }
      
      // Luego, actualizar con los resultados de esta ronda
      round.matches.forEach(match => {
        if (match.winner !== null) {
          const winnerId = match.winner;
          const loserId = match.team1Id === winnerId ? match.team2Id : match.team1Id;
          
          // Actualizar las victorias del ganador
          if (statesByRound[winnerId] && statesByRound[winnerId][roundIndex]) {
            statesByRound[winnerId][roundIndex].wins += 1;
          }
          
          // Actualizar las derrotas del perdedor
          if (statesByRound[loserId] && statesByRound[loserId][roundIndex]) {
            statesByRound[loserId][roundIndex].losses += 1;
          }
        }
      });
    });
    
    setTeamStateByRound(statesByRound);
  }, [rounds, teams]);

  useEffect(() => {
    calculateTeamStatesByRound();
  }, [calculateTeamStatesByRound, selectedTeam]);

  // Obtener el estado de un equipo en una ronda específica
  const getTeamStateInRound = (teamId: number, roundIndex: number): { wins: number, losses: number } => {
    if (teamStateByRound[teamId] && teamStateByRound[teamId][roundIndex]) {
      return teamStateByRound[teamId][roundIndex];
    }
    return { wins: 0, losses: 0 };
  };

  // Función mejorada para obtener el pool estático basado en la ronda
  const getMatchPool = (roundIndex: number, matchIndex: number): string => {
    // Si es la primera ronda, siempre mostramos "0-0"
    if (roundIndex === 0) {
      return "0-0";
    }
    
    const match = rounds[roundIndex]?.matches[matchIndex];
    if (!match) return "0-0";
    
    // Para rondas posteriores, agrupamos por el estado de los equipos en la ronda anterior
    // Esto lo mantiene estático para toda la ronda
    const team1 = getTeamById(match.team1Id);
    const team2 = getTeamById(match.team2Id);
    
    if (!team1 || !team2) return "0-0";
    
    // Usamos el estado calculado de la ronda anterior
    const team1PrevState = getTeamStateInRound(team1.id, roundIndex - 1);
    
    // Solo usamos el estado del primer equipo para mantener la consistencia en el pool
    return `${team1PrevState.wins}-${team1PrevState.losses}`;
  };

  // Función para obtener el color de fondo para el pool según el record
  const getPoolBackgroundColor = (poolValue: string): string => {
    const [wins, losses] = poolValue.split('-').map(Number);
    
    if (wins === 0 && losses === 0) {
      return 'bg-neutral-800';
    }
    else if (wins === 1 && losses === 0) {
      return 'bg-success-600';
    }
    else if (wins === 2 && losses === 0) {
      return 'bg-success-700';
    }
    else if (wins === 3 && losses === 0) {
      return 'bg-success-800';
    }
    else if (wins === 1 && losses === 1) {
      return 'bg-warning-500';
    }
    else if (wins === 2 && losses === 1) {
      return 'bg-warning-400';
    }
    else if (wins === 1 && losses === 2) {
      return 'bg-danger-500';
    }
    else if (wins === 2 && losses === 2) {
      return 'bg-warning-500';
    }
    else if (wins === 0 && losses === 1) {
      return 'bg-danger-600';
    }
    else if (wins === 0 && losses === 2) {
      return 'bg-danger-700';
    }
    else if (wins === 0 && losses === 3) {
      return 'bg-danger-800';
    }
    else if (wins > losses) {
      return 'bg-success-600';
    }
    else if (losses > wins) {
      return 'bg-danger-600';
    }
    else {
      return 'bg-warning-500';
    }
  };

  // Modificada para que siempre permita la interacción
  const getTeamStatus = (team: Team): 'qualified' | 'eliminated' | 'active' => {
    // Mantenemos la lógica visual pero siempre permitimos interactividad
    if (team.wins === 3) return 'qualified';
    if (team.losses === 3) return 'eliminated';
    return 'active';
  };

  // Eliminamos la restricción por estado
  const handleTeamClick = (roundIndex: number, matchIndex: number, winnerId: number): void => {
    const team = getTeamById(winnerId);
    if (!team) return;
    
    // Primero, notificar al padre sobre el cambio de ganador para que se regeneren los datos
    onMatchResult(roundIndex, matchIndex, winnerId);
    
    // Actualizar el equipo seleccionado para efectos visuales
    setSelectedTeam(winnerId);
    
    // Forzar un recálculo completo del estado de los equipos después de una breve espera
    // para permitir que los datos se actualicen en el padre
    setTimeout(() => {
      calculateTeamStatesByRound();
    }, 500); // Aumentado a 500ms para mayor seguridad
  };

  const handleImageHover = (teamId: number, roundIndex: number, event: React.MouseEvent): void => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Calculate position relative to the mouse cursor
    const x = event.clientX;
    const y = event.clientY;
    
    setHoverPosition({ top: y, left: x });
    setHoveredTeam(teamId);
    setHoveredRound(roundIndex);
  };

  const handleImageLeave = (): void => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredTeam(null);
      setHoveredRound(null);
    }, 100); // Small delay to prevent flicker when moving to the tooltip
  };

  // Handle tooltip mouse enter to prevent it from disappearing
  const handleTooltipMouseEnter = (): void => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  // Handle tooltip mouse leave
  const handleTooltipMouseLeave = (): void => {
    setHoveredTeam(null);
    setHoveredRound(null);
  };

  // Nuevo handler para hover con delay
  const handleSeedHover = (teamId: number, roundIndex: number, event: React.MouseEvent) => {
    if (hoverBreakdownTimeoutRef.current) {
      clearTimeout(hoverBreakdownTimeoutRef.current);
    }
    hoverBreakdownTimeoutRef.current = setTimeout(() => {
      handleImageHover(teamId, roundIndex, event);
    }, 500);
  };

  const handleSeedLeave = () => {
    if (hoverBreakdownTimeoutRef.current) {
      clearTimeout(hoverBreakdownTimeoutRef.current);
    }
    handleImageLeave();
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hoverBreakdownTimeoutRef.current) {
        clearTimeout(hoverBreakdownTimeoutRef.current);
      }
    };
  }, []);

  const getPreviousOpponents = (teamId: number, currentRoundIndex: number): PreviousOpponent[] => {
    const opponents: PreviousOpponent[] = [];
    const seenIds = new Set<number>();
    // Considerar todas las rondas anteriores (index < currentRoundIndex)
    rounds.forEach((round, index) => {
      if (index >= currentRoundIndex) return;
      round.matches.forEach(match => {
        let opponent: Team | undefined = undefined;
        if (match.team1Id === teamId) {
          opponent = getTeamById(match.team2Id);
        } else if (match.team2Id === teamId) {
          opponent = getTeamById(match.team1Id);
        }
        if (opponent && !seenIds.has(opponent.id)) {
          seenIds.add(opponent.id);
          // Estado del oponente tras la ronda anterior a la actual
          const oppState = getTeamStateInRound(opponent.id, currentRoundIndex - 1);
          const contribution = oppState.wins - oppState.losses;
          opponents.push({
            opponent,
            result: match.winner === teamId ? 'W' : (match.winner === opponent.id ? 'L' : '-'),
            round: index + 1,
            contribution
          });
        }
      });
    });
    return opponents;
  };

  const calculateBuchholzScore = (teamId: number, currentRoundIndex: number): number => {
    // Si estamos en la primera ronda, el Buchholz siempre es 0
    if (currentRoundIndex <= 0) return 0;
    const opponents = getPreviousOpponents(teamId, currentRoundIndex);
    return opponents.reduce((total, { contribution }) => {
      return total + contribution;
    }, 0);
  };

  // Ajustar la posición del tooltip para que siempre sea visible
  const adjustTooltipPosition = (position: HoverPosition): HoverPosition => {
    if (!hoveredTeam) return position;
    
    // Asumimos un ancho aproximado de 320px y una altura aproximada de 300px para el tooltip
    const tooltipWidth = 320;
    const tooltipHeight = 300;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let { top, left } = position;
    
    // Ajustar horizontalmente
    if (left + tooltipWidth > viewportWidth - 20) {
      left = viewportWidth - tooltipWidth - 20;
    }
    
    // Ajustar verticalmente
    if (top + tooltipHeight > viewportHeight - 20) {
      top = top - tooltipHeight - 10; // Mostrar arriba del cursor
    }
    
    return { top, left };
  };

  const adjustedPosition = adjustTooltipPosition(hoverPosition);

  // Define border styles outside the map to avoid redeclaration
  const confirmedWinnerBorder = "border-4 border-green-400"; // Verde brillante
  const simulatedWinnerBorder = "border-4 border-green-900"; // Verde oscuro
  const incorrectWinnerBorder = "border-4 border-red-500"; // Rojo
  const normalBorder = "border-2 border-neutral-700/70";

  const isRoundCollapsible = (round: Round): boolean => {
    return round.matches.length === 8 && round.matches.every(match => match.status === 'FINISHED');
  };

  const toggleRoundExpansion = (roundIndex: number) => {
    setExpandedRounds(prev => ({
      ...prev,
      [roundIndex]: !(prev[roundIndex] ?? !isRoundCollapsible(rounds[roundIndex]))
    }));
  };

  const baseHeaderClasses = "flex justify-between items-center px-4 py-3 rounded-lg mb-4";
  const expandedHeaderClasses = `${baseHeaderClasses} bg-gradient-to-r from-primary-700 to-primary-800 shadow-lg`;
  const collapsedHeaderClasses = `${baseHeaderClasses} bg-neutral-800 border border-neutral-700 shadow-md`;

  // Determinar si todas las rondas están completas
  const allRoundsCompleted = rounds.every(round => round.status === 'completed');
  const qualifiedTeams = allRoundsCompleted 
    ? teams
        .filter(team => (team.wins || 0) >= 3)
        .sort((a, b) => {
          // 1. Mayor cantidad de victorias (descendente)
          if ((b.wins || 0) !== (a.wins || 0)) {
            return (b.wins || 0) - (a.wins || 0);
          }
          // 2. Menor cantidad de derrotas (ascendente)
          if ((a.losses || 0) !== (b.losses || 0)) {
            return (a.losses || 0) - (b.losses || 0);
          }
          // 3. Mayor puntuación Buchholz (descendente)
          if ((b.buchholzScore || 0) !== (a.buchholzScore || 0)) {
            return (b.buchholzScore || 0) - (a.buchholzScore || 0);
          }
          // 4. Menor seed (ascendente)
          return (a.seed || 0) - (b.seed || 0);
        })
        .slice(0, 8)
    : [];

  return (
    <div className="w-full min-h-screen bg-transparent">
      {hoveredTeam && (
        <div 
          className="fixed bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg text-sm text-neutral-300 z-50"
          style={{
            top: `${adjustedPosition.top}px`,
            left: `${adjustedPosition.left}px`,
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
          tabIndex={0}
          role="dialog"
        >
          {(() => {
            const team = getTeamById(hoveredTeam);
            if (!team) return null;
            // Usar la ronda anterior para el breakdown
            const roundToShow = (hoveredRound || 0) - 1;
            const previousOpponents = getPreviousOpponents(team.id, hoveredRound ? hoveredRound : 0);
            // Estado del equipo tras la ronda anterior
            const currentState = getTeamStateInRound(team.id, roundToShow);
            // Standing tras la ronda anterior
            const sortedTeams = [...teams].sort((a, b) => {
              const aState = getTeamStateInRound(a.id, roundToShow);
              const bState = getTeamStateInRound(b.id, roundToShow);
              return (bState.wins - aState.wins) || (aState.losses - bState.losses);
            });
            const standing = sortedTeams.findIndex(t => t.id === team.id) + 1;
            // Calcular Buchholz tras la ronda anterior
            const buchholzBreakdown = previousOpponents.reduce((total, { contribution }) => total + contribution, 0);
            return (
              <table className="text-left w-full min-w-[300px]">
                <tbody>
                  <tr>
                    <td colSpan={3} className="py-2 px-4"><b>Initial Seeding</b></td>
                    <td className="text-center py-2 px-4">{getVisualSeed(team.seed, currentStage)}</td>
                  </tr>
                  <tr className="border-t border-t-neutral-700">
                    <td colSpan={3} className="py-2 px-4"><b>Current Standing</b></td>
                    <td className="text-center py-2 px-4">#{standing}</td>
                  </tr>
                  <tr className="border-b border-b-neutral-700">
                    <td className="w-8 px-4">
                      <div className="h-6 inline-block mr-3 content-center">
                        <img
                          className="max-w-8 max-h-8"
                          src={`/team-logos/${team.name.toLowerCase().replace(/\s+/g, '')}.png`}
                          alt={team.name}
                          onError={(e) => {(e.target as HTMLImageElement).src = '/team-logos/default.png'}}
                        />
                      </div>
                    </td>
                    <td className="min-w-40 text-left">
                      <b>{team.name}</b>
                      <p className="text-xs text-neutral-400">Seed #{getVisualSeed(team.seed, currentStage)}</p>
                    </td>
                    <td className="text-center">{currentState.wins}-{currentState.losses}</td>
                    <td className="text-center">
                      {currentState.wins > currentState.losses 
                        ? `+${currentState.wins - currentState.losses}` 
                        : currentState.wins - currentState.losses}
                    </td>
                  </tr>
                  {previousOpponents.length > 0 && (
                    <>
                      <tr>
                        <th className="pt-4 pb-2 px-4" colSpan={2}>Previous Opponents</th>
                        <th className="pt-4 pb-2 px-4 text-center">Status</th>
                        <th className="pt-4 pb-2 px-4 text-center">Score</th>
                      </tr>
                      {previousOpponents.map((match, idx) => {
                        if (!match.opponent) return null;
                        // Estado del oponente tras la ronda anterior a la actual
                        const oppState = getTeamStateInRound(match.opponent.id, roundToShow);
                        return (
                          <tr key={idx}>
                            <td className="w-8 px-4">
                              <div className="h-6 inline-block mr-3 content-center">
                                <img
                                  className="max-w-8 max-h-8"
                                  src={`/team-logos/${match.opponent.name.toLowerCase().replace(/\s+/g, '')}.png`}
                                  alt={match.opponent.name}
                                  onError={(e) => {(e.target as HTMLImageElement).src = '/team-logos/default.png'}}
                                />
                              </div>
                            </td>
                            <td className="min-w-40 text-left">
                              <b>{match.opponent.name}</b>
                              <p className="text-xs text-neutral-400">Seed #{getVisualSeed(match.opponent.seed, currentStage)}</p>
                            </td>
                            <td className="text-center">{oppState.wins}-{oppState.losses}</td>
                            <td className="text-center">{oppState.wins - oppState.losses > 0 ? `+${oppState.wins - oppState.losses}` : oppState.wins - oppState.losses}</td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                  <tr className="border-t border-t-neutral-700">
                    <td colSpan={3} className="py-2 px-4"><b>Total Buchholz</b></td>
                    <td className="text-center py-2 px-4">{buchholzBreakdown > 0 ? `+${buchholzBreakdown}` : buchholzBreakdown}</td>
                  </tr>
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      {rounds.map((round, roundIndex) => (
        <div 
          key={roundIndex} 
          className="mb-8 w-full transition-all duration-500 bg-transparent"
        >
          {(() => { 
            const roundIsCollapsible = isRoundCollapsible(round);
            const isEffectivelyExpanded = expandedRounds[roundIndex] ?? !roundIsCollapsible;
            const headerClasses = roundIsCollapsible && !isEffectivelyExpanded ? collapsedHeaderClasses : expandedHeaderClasses;

            // Ordenar los partidos aquí para la visualización
            const sortedMatches = [...round.matches].sort((a, b) => {
              const poolA = getMatchPool(roundIndex, round.matches.indexOf(a));
              const poolB = getMatchPool(roundIndex, round.matches.indexOf(b));

              const [winsA, lossesA] = poolA.split('-').map(Number);
              const [winsB, lossesB] = poolB.split('-').map(Number);

              if (winsA !== winsB) {
                return winsB - winsA; // Mayor número de victorias primero
              }
              return lossesA - lossesB; // Menor número de derrotas primero
            });

            return (
              <>
                <div 
                  className={headerClasses}
                  onClick={() => roundIsCollapsible && toggleRoundExpansion(roundIndex)}
                  style={{ cursor: roundIsCollapsible ? 'pointer' : 'default' }}
                >
                  <h2 className="text-lg font-semibold text-white">
                    Ronda {round.roundNumber}
                  </h2>
                  {roundIsCollapsible && (
                    <span className="text-white text-xl">
                      {isEffectivelyExpanded ? '▲' : '▼'}
                    </span>
                  )}
                </div>
                
                {(() => {
                  if (roundIsCollapsible && !isEffectivelyExpanded) {
                    return null; 
                  }
                  // Determinar las clases de la cuadrícula basadas en el índice de la ronda
                  let gridClasses = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"; // Default
                  if (roundIndex === 3) { // Ronda 4
                    // Volver a grid con 3 columnas en lg y con gap
                    gridClasses = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"; 
                  } else if (roundIndex === 4) { // Ronda 5
                    // Volver a grid con 3 columnas en lg y con gap
                    gridClasses = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"; 
                  }
                  
                  return (
                    <div className={`${gridClasses} p-4 bg-neutral-800/30 backdrop-blur-sm rounded-lg shadow-lg border border-neutral-700/50`}>
                      {sortedMatches.map((match, matchIndex) => {
                        const originalMatchIndex = round.matches.indexOf(match);
                        const team1 = getTeamById(match.team1Id);
                        const team2 = getTeamById(match.team2Id);
                        if (!team1 || !team2) return null;

                        const isTeam1Winner = match.winner === team1.id;
                        const isTeam2Winner = match.winner === team2.id;
                        const poolValue = getMatchPool(roundIndex, originalMatchIndex);
                        const poolBgColor = getPoolBackgroundColor(poolValue);

                        const buchholz1 = calculateBuchholzScore(team1.id, roundIndex);
                        const buchholz2 = calculateBuchholzScore(team2.id, roundIndex);
 
                        const backendWinnerByScores = getBackendWinnerId(match);
                        let imageBorderClassTeam1 = normalBorder;
                        if (isTeam1Winner) { 
                          if (match.status === 'FINISHED') {
                            if (backendWinnerByScores === team1.id) {
                              imageBorderClassTeam1 = confirmedWinnerBorder; 
                            } else if (backendWinnerByScores !== null && backendWinnerByScores !== team1.id) {
                              imageBorderClassTeam1 = incorrectWinnerBorder; 
                            } else {
                              imageBorderClassTeam1 = confirmedWinnerBorder; 
                            }
                          } else { 
                            imageBorderClassTeam1 = simulatedWinnerBorder; 
                          }
                        }

                        let imageBorderClassTeam2 = normalBorder;
                        if (isTeam2Winner) { 
                          if (match.status === 'FINISHED') {
                            if (backendWinnerByScores === team2.id) {
                              imageBorderClassTeam2 = confirmedWinnerBorder; 
                            } else if (backendWinnerByScores !== null && backendWinnerByScores !== team2.id) {
                              imageBorderClassTeam2 = incorrectWinnerBorder; 
                            } else {
                              imageBorderClassTeam2 = confirmedWinnerBorder; 
                            }
                          } else { 
                            imageBorderClassTeam2 = simulatedWinnerBorder; 
                          }
                        }

                        const renderMatchScores = () => {
                          const matchData = match; 
                          if (matchData.format === 'BO1') {
                            
                            const r1 = matchData.map1_team1_score !== undefined && matchData.map1_team1_score !== null ? matchData.map1_team1_score.toString() : "-";
                            const r2 = matchData.map1_team2_score !== undefined && matchData.map1_team2_score !== null ? matchData.map1_team2_score.toString() : "-";

                            return (
                              <>
                                <div className="flex-1 flex flex-col items-center">
                                  <span className={`text-2xl font-bold px-4 py-2 rounded-lg ${isTeam1Winner ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-800 text-neutral-300'}`}>{r1}</span>
                                </div>
                                <div className="flex-1 flex flex-col items-center">
                                  <span className={`text-2xl font-bold px-4 py-2 rounded-lg ${isTeam2Winner ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-800 text-neutral-300'}`}>{r2}</span>
                                </div>
                              </>
                            );
                          } else if (matchData.format === 'BO3') {
                            const mapScoresElements = [];
                            const mapsData = [
                              { t1: matchData.map1_team1_score, t2: matchData.map1_team2_score, label: "Mapa 1" },
                              { t1: matchData.map2_team1_score, t2: matchData.map2_team2_score, label: "Mapa 2" },
                              { t1: matchData.map3_team1_score, t2: matchData.map3_team2_score, label: "Mapa 3" },
                            ];
                            const overallT1MapWins = matchData.team1Score !== undefined ? matchData.team1Score : 0;
                            const overallT2MapWins = matchData.team2Score !== undefined ? matchData.team2Score : 0;

                            for (let i = 0; i < mapsData.length; i++) {
                              const mapInfo = mapsData[i];
                              const r1_val = mapInfo.t1;
                              const r2_val = mapInfo.t2;

                              if ((overallT1MapWins >= 2 || overallT2MapWins >= 2) && i >= (overallT1MapWins + overallT2MapWins)) {
                                break;
                              }

                              if (r1_val === null && r2_val === null) {
                                  if (i > 0) {
                                      const prevMapHadData = mapsData[i-1].t1 !== null || mapsData[i-1].t2 !== null;
                                      if (prevMapHadData) break;
                                  } else if (i === 0 && (mapsData[1].t1 !== null || mapsData[1].t2 !== null || mapsData[2].t1 !== null || mapsData[2].t2 !== null)){
                                  } else {
                                      break;
                                  }
                              }
                              
                              const score1Display = r1_val !== null && r1_val !== undefined ? r1_val.toString() : "-";
                              const score2Display = r2_val !== null && r2_val !== undefined ? r2_val.toString() : "-";
                              
                              const team1WonThisMap = typeof r1_val === 'number' && typeof r2_val === 'number' && r1_val > r2_val;
                              const team2WonThisMap = typeof r1_val === 'number' && typeof r2_val === 'number' && r2_val > r1_val;

                              mapScoresElements.push(
                                <div key={`map-${i+1}`} className="text-center mb-1 w-full">
                                  <span className="text-xs text-neutral-400 mr-2">{`${mapInfo.label}: `}</span>
                                  <span className={`text-lg font-semibold ${team1WonThisMap ? 'text-success-400' : team2WonThisMap ? 'text-danger-400' : 'text-neutral-300'}`}>
                                    {score1Display}
                                  </span>
                                  <span className="text-lg font-semibold text-neutral-300 mx-1">-</span>
                                  <span className={`text-lg font-semibold ${team2WonThisMap ? 'text-success-400' : team1WonThisMap ? 'text-danger-400' : 'text-neutral-300'}`}>
                                    {score2Display}
                                  </span>
                                </div>
                              );
                            }

                            if (mapScoresElements.length === 0) { 
                              return (
                                  <>
                                      <div className="flex-1 flex flex-col items-center">
                                          <span className={`text-2xl font-bold px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300`}>-</span>
                                      </div>
                                      <div className="flex-1 flex flex-col items-center">
                                          <span className={`text-2xl font-bold px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300`}>-</span>
                                      </div>
                                  </>
                              );
                            }
                            return <div className="w-full flex flex-col items-center">{mapScoresElements}</div>;

                          } else { 
                            const r1 = matchData.map1_team1_score !== undefined && matchData.map1_team1_score !== null ? matchData.map1_team1_score.toString() : "-";
                            const r2 = matchData.map1_team2_score !== undefined && matchData.map1_team2_score !== null ? matchData.map1_team2_score.toString() : "-";
                            return (
                              <>
                                <div className="flex-1 flex flex-col items-center">
                                  <span className={`text-2xl font-bold px-4 py-2 rounded-lg ${isTeam1Winner ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-800 text-neutral-300'}`}>{r1}</span>
                                </div>
                                <div className="flex-1 flex flex-col items-center">
                                  <span className={`text-2xl font-bold px-4 py-2 rounded-lg ${isTeam2Winner ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-800 text-neutral-300'}`}>{r2}</span>
                                </div>
                              </>
                            );
                          }
                        };

                        return (
                          <div 
                            key={originalMatchIndex}
                            className="bg-neutral-900/60 backdrop-blur-md rounded-lg shadow-xl border border-neutral-700/50 flex flex-col overflow-hidden"
                          >
                            <div className="flex flex-row items-center justify-around px-4 pt-3 pb-2 sm:px-5">
                              <div className="flex flex-col items-center min-w-[70px] sm:min-w-[80px]">
                                <span className="text-xs text-neutral-400 mb-1">Seed</span>
                                <span
                                  className="flex flex-col items-center text-lg font-bold text-white cursor-pointer"
                                  onMouseEnter={(e) => handleSeedHover(team1.id, roundIndex, e)}
                                  onMouseLeave={handleSeedLeave}
                                >
                                  <span className="text-lg leading-none">{getVisualSeed(team1.seed, currentStage)}</span>
                                  <span className={`text-xs leading-none ${buchholz1 >= 0 ? 'text-primary-400' : 'text-danger-400'}`}>/{buchholz1 >= 0 ? `+${buchholz1}` : buchholz1}</span>
                                </span>
                              </div>
                              <div className="flex flex-col items-center px-1">
                                <div className={`${poolBgColor} text-white text-center py-1 px-3 sm:px-4 rounded font-bold mb-1 w-fit mx-auto text-xs sm:text-sm`}>{poolValue}</div>
                                {match.status === 'LIVE' && (
                                  <div className="text-xs font-bold text-white bg-danger-600 px-2 py-0.5 rounded-md animate-pulse">
                                    LIVE
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-center min-w-[70px] sm:min-w-[80px]">
                                <span className="text-xs text-neutral-400 mb-1">Seed</span>
                                <span
                                  className="flex flex-col items-center text-lg font-bold text-white cursor-pointer"
                                  onMouseEnter={(e) => handleSeedHover(team2.id, roundIndex, e)}
                                  onMouseLeave={handleSeedLeave}
                                >
                                  <span className="text-lg leading-none">{getVisualSeed(team2.seed, currentStage)}</span>
                                  <span className={`text-xs leading-none ${buchholz2 >= 0 ? 'text-primary-400' : 'text-danger-400'}`}>/{buchholz2 >= 0 ? `+${buchholz2}` : buchholz2}</span>
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-row items-center justify-around px-4 py-4 sm:px-5 sm:py-5 gap-3 sm:gap-4">
                              <div className="flex-1 flex flex-col items-center">
                                <img
                                  src={`/team-logos/${team1.name.toLowerCase().replace(/\s+/g, '')}.png`}
                                  alt={team1.name}
                                  className={`w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg bg-neutral-800/70 cursor-pointer transition-all duration-200 ${imageBorderClassTeam1} ${match.status === 'FINISHED' && !isTeam1Winner ? 'opacity-50 grayscale' : ''}`}
                                  onClick={() => handleTeamClick(roundIndex, originalMatchIndex, team1.id)}
                                  onError={(e) => {(e.target as HTMLImageElement).src = '/team-logos/default.png'}}
                                />
                              </div>
                              <div className="flex-1 flex flex-col items-center">
                                <img
                                  src={`/team-logos/${team2.name.toLowerCase().replace(/\s+/g, '')}.png`}
                                  alt={team2.name}
                                  className={`w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg bg-neutral-800/70 cursor-pointer transition-all duration-200 ${imageBorderClassTeam2} ${match.status === 'FINISHED' && !isTeam2Winner ? 'opacity-50 grayscale' : ''}`}
                                  onClick={() => handleTeamClick(roundIndex, originalMatchIndex, team2.id)}
                                  onError={(e) => {(e.target as HTMLImageElement).src = '/team-logos/default.png'}}
                                />
                              </div>
                            </div>
                            <div className="flex flex-row items-end justify-between px-4 pb-3 sm:px-5 gap-3 sm:gap-4 mt-auto">
                              {renderMatchScores()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>
      ))}

      {allRoundsCompleted && qualifiedTeams.length > 0 && (
        <div className="mt-12 mb-8 w-full transition-all duration-500 bg-transparent">
          <div className={expandedHeaderClasses}>
            <h2 className="text-lg font-semibold text-white">
              Equipos Clasificados a la Siguiente Fase
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-neutral-800/30 backdrop-blur-sm rounded-lg shadow-lg border border-neutral-700/50">
            {qualifiedTeams.map(team => (
              <div 
                key={team.id}
                title={`${team.name} - Record: ${team.wins}-${team.losses}, Buchholz: ${team.buchholzScore}`}
                className="bg-neutral-900/60 backdrop-blur-md rounded-lg shadow-xl border border-neutral-700/50 flex flex-col items-center p-6 hover:bg-neutral-800/80 transition-colors duration-200"
              >
                <img
                  src={`/team-logos/${team.name.toLowerCase().replace(/\s+/g, '')}.png`}
                  alt={team.name}
                  className="w-24 h-24 object-contain rounded-lg bg-neutral-800/70 mb-4"
                  onError={(e) => {(e.target as HTMLImageElement).src = '/team-logos/default.png'}}
                />
                <span className="text-white font-semibold text-center text-lg mb-1">{team.name}</span>
                <span className="text-xs text-neutral-400">Seed: {getVisualSeed(team.seed, currentStage)}</span>
                <span className="text-xs text-primary-400 mt-1">{team.wins}-{team.losses}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuchholzRounds;