import { Round, Match, Stage } from '../../types/hltvTypes';
import { getCurrentData } from './dataService';
import { generateFirstRoundMatches, generateNextRoundMatches } from './matchService';
import { simulateRoundResults } from './simulationService';
import { generatePlayoffBracket, updatePlayoffBracket, debugLog } from './simulationService';

// Generar rondas simuladas para una fase específica
export async function generateSimulatedRounds(
  phaseId: string, 
  existingResults: { [roundIdx: string]: { [matchIdx: string]: Partial<Match> } } = {}
): Promise<void> {
  const localMajorData = getCurrentData();
  if (!localMajorData) {
    console.error('No hay datos disponibles para generar rondas');
    return;
  }

  const currentTournamentType = localMajorData.tournamentType;
  const currentSwissRules = localMajorData.swissRulesType;
  debugLog(`Reglas Suizas para este torneo (${localMajorData.name}): ${currentSwissRules}, Tipo de Torneo: ${currentTournamentType}`);

  try {
    const stage = localMajorData.stages[phaseId];
    if (!stage) {
      console.error(`Stage ${phaseId} does not exist`);
      return;
    }
    
    if (!stage.teams || stage.teams.length === 0) {
      console.error(`No teams available in stage ${phaseId}`);
      return;
    }
    
    debugLog(`Generando rondas para fase ${phaseId} con ${stage.teams.length} equipos`);
    debugLog(`Tipo de Fase: ${stage.type}`);
    
    // Para fase 4 (Champions Stage - Playoffs), usamos sistema de bracket de eliminación directa
    if (phaseId === 'phase4') {
      stage.teams.forEach(team => {
        team.wins = 0;
        team.losses = 0;
        team.buchholzScore = 0;
        team.opponents = [];
      });
      
      generatePlayoffBracket(stage);
      debugLog(`Bracket de playoffs generado para fase ${phaseId}`);
      
      if (existingResults && Object.keys(existingResults).length > 0) {
        debugLog('Restaurando resultados existentes del backend para la fase de playoffs');
        
        // Restaurar todos los resultados existentes primero
        // Cuartos de final
        if (existingResults['0']) {
          Object.entries(existingResults['0']).forEach(([matchIdx, matchDetail]) => {
            const matchIndex = parseInt(matchIdx);
            if (stage.rounds && stage.rounds[0] && stage.rounds[0].matches && matchIndex < stage.rounds[0].matches.length) {
              const targetMatch = stage.rounds[0].matches[matchIndex];
              debugLog(`Restaurando resultado existente: Ronda 1 (QF), Partido ${matchIndex+1}, Detalles:`, matchDetail);
              Object.assign(targetMatch, matchDetail);
              // La lógica de wins/losses aquí no es crucial para el avance del bracket
            }
          });
          // No llamar a updatePlayoffBracket aquí aún
        }
        
        // Semifinales
        if (existingResults['1']) {
          Object.entries(existingResults['1']).forEach(([matchIdx, matchDetail]) => {
            const matchIndex = parseInt(matchIdx);
             if (stage.rounds && stage.rounds[1] && stage.rounds[1].matches && matchIndex < stage.rounds[1].matches.length) {
              const targetMatch = stage.rounds[1].matches[matchIndex];
              debugLog(`Restaurando resultado existente: Ronda 2 (SF), Partido ${matchIndex+1}, Detalles:`, matchDetail);
              Object.assign(targetMatch, matchDetail);
              // La lógica de wins/losses aquí no es crucial para el avance del bracket
            }
          });
           // No llamar a updatePlayoffBracket aquí aún
        }
        
        // Final
        if (existingResults['2'] && existingResults['2']['0']) {
          const matchDetail = existingResults['2']['0'];
          if (stage.rounds && stage.rounds[2] && stage.rounds[2].matches && stage.rounds[2].matches[0]) {
            const targetMatch = stage.rounds[2].matches[0];
            debugLog(`Restaurando resultado existente: Final, Detalles:`, matchDetail);
            Object.assign(targetMatch, matchDetail);
             // La lógica de wins/losses aquí no es crucial para el avance del bracket
          }
           // No llamar a updatePlayoffBracket aquí aún
        }
      }

      // Llamar a updatePlayoffBracket UNA VEZ después de aplicar todos los resultados
      updatePlayoffBracket(stage);
      
      /* El bucle de simulación está comentado */
      updateRoundStatuses(stage);
      return;
    }
    
    // Para fases 1, 2 y 3 (Sistema Suizo)
    const userSelectedWinners: { [roundIndex: number]: { [matchIndex: number]: Partial<Match> } } = {};
    stage.rounds?.forEach((round, roundIdx) => {
      userSelectedWinners[roundIdx] = {};
      round.matches.forEach((match, matchIdx) => {
        if (match.winner !== null || match.team1Score !== undefined || match.format !== undefined) {
          userSelectedWinners[roundIdx][matchIdx] = { ...match };
          debugLog(`Guardando selección/datos existentes: Ronda ${roundIdx+1}, Partido ${matchIdx+1}, Detalles:`, userSelectedWinners[roundIdx][matchIdx]);
        }
      });
    });
    
    stage.teams.forEach(team => {
      team.wins = 0;
      team.losses = 0;
      team.buchholzScore = 0;
      team.opponents = [];
      debugLog(`Inicializando ${team.name}: ${team.wins}-${team.losses}, Seed: ${team.seed}`);
    });
    
    // Fases Suizas (1, 2, 3) tienen hasta 5 rondas. Playoffs (fase4) tiene 3.
    const maxRounds = phaseId === 'phase4' ? 3 : 5;
    debugLog(`Máximo de rondas para ${phaseId}: ${maxRounds}`);
    
    if (!stage.rounds) {
      stage.rounds = [];
      debugLog('Inicializando array de rondas vacío');
    }
    
    // Crear rondas faltantes
    for (let roundNumber = (stage.rounds?.length || 0) + 1; roundNumber <= maxRounds; roundNumber++) {
      debugLog(`Creando estructura para ronda ${roundNumber} en ${phaseId}`);
      const round: Round = {
        roundNumber,
        matches: [],
        status: (stage.rounds?.length === 0 && roundNumber === 1) ? 'active' : 'pending'
      };
      stage.rounds.push(round);
    }
    
    if (stage.rounds.length > maxRounds) {
      debugLog(`Ajustando número de rondas de ${stage.rounds.length} a ${maxRounds}`);
      stage.rounds = stage.rounds.slice(0, maxRounds);
    }
    
    const mergedMatchDetails: { [roundIndex: number]: { [matchIndex: number]: Partial<Match> } } = {};
    if (existingResults && Object.keys(existingResults).length > 0) {
      Object.entries(existingResults).forEach(([roundIdx, matchResults]) => {
        const roundIndex = parseInt(roundIdx);
        if (!mergedMatchDetails[roundIndex]) mergedMatchDetails[roundIndex] = {};
        Object.entries(matchResults).forEach(([matchIdx, matchDetail]) => {
          const matchIndex = parseInt(matchIdx);
          mergedMatchDetails[roundIndex][matchIndex] = matchDetail as Partial<Match>; 
          debugLog(`Registrando resultado del backend: Ronda ${roundIndex+1}, Partido ${matchIndex+1}, Detalles:`, matchDetail);
        });
      });
    }
    
    Object.entries(userSelectedWinners).forEach(([roundIdx, matchResults]) => {
      const roundIndex = parseInt(roundIdx);
      if (!mergedMatchDetails[roundIndex]) mergedMatchDetails[roundIndex] = {};
      Object.entries(matchResults).forEach(([matchIdx, matchDetail]) => {
        const matchIndex = parseInt(matchIdx);
        mergedMatchDetails[roundIndex][matchIndex] = matchDetail as Partial<Match>; 
        debugLog(`Registrando selección del usuario/existente: Ronda ${roundIndex+1}, Partido ${matchIndex+1}, Detalles:`, matchDetail);
      });
    });
    
    const restoreMatchDetails = (round: Round, roundIdx: number, matchDetails: { [matchIdx: string]: Partial<Match> }, stage: Stage) => {
      let countRestored = 0;
      
      // Primero, crear un mapa de los partidos actuales por sus equipos para búsqueda rápida
      const currentMatchesMap = new Map<string, { match: Match, index: number }>();
      round.matches.forEach((match, index) => {
        const team1 = stage.teams.find(t => t.id === match.team1Id);
        const team2 = stage.teams.find(t => t.id === match.team2Id);
        if (team1 && team2) {
          // Crear una clave única para el partido usando los nombres de los equipos en orden alfabético
          const matchKey = [team1.name, team2.name].sort().join(' vs ');
          currentMatchesMap.set(matchKey, { match, index });
        }
      });

      Object.entries(matchDetails).forEach(([matchIdx, matchDetail]) => {
        debugLog(`\n=== Intentando restaurar partido ${matchIdx} de la ronda ${roundIdx + 1} ===`);
        debugLog(`Detalles del partido a restaurar:`, matchDetail);
        
        // Encontrar los equipos del detalle a restaurar
        const team1 = stage.teams.find(t => t.id === matchDetail.team1Id);
        const team2 = stage.teams.find(t => t.id === matchDetail.team2Id);

        if (!team1 || !team2) {
          debugLog(`✗ No se encontraron los equipos del detalle a restaurar:`);
          debugLog(`  Team1 encontrado: ${!!team1}`);
          debugLog(`  Team2 encontrado: ${!!team2}`);
          return;
        }

        debugLog(`Equipos en el detalle a restaurar:`);
        debugLog(`- Team1 (ID: ${matchDetail.team1Id}): ${team1.name}`);
        debugLog(`- Team2 (ID: ${matchDetail.team2Id}): ${team2.name}`);

        // Crear la clave de búsqueda para este partido
        const matchKey = [team1.name, team2.name].sort().join(' vs ');
        const currentMatchData = currentMatchesMap.get(matchKey);

        if (!currentMatchData) {
          debugLog(`✗ No se encontró un partido actual que coincida con: ${team1.name} vs ${team2.name}`);
          return;
        }

        const { match: targetMatch, index: matchIndex } = currentMatchData;
        const targetTeam1 = stage.teams.find(t => t.id === targetMatch.team1Id);
        const targetTeam2 = stage.teams.find(t => t.id === targetMatch.team2Id);

        if (!targetTeam1 || !targetTeam2) {
          debugLog(`✗ No se encontraron los equipos del partido actual:`);
          debugLog(`  TargetTeam1 encontrado: ${!!targetTeam1}`);
          debugLog(`  TargetTeam2 encontrado: ${!!targetTeam2}`);
          return;
        }

        debugLog(`Equipos en el partido actual (índice ${matchIndex}):`);
        debugLog(`- TargetTeam1 (ID: ${targetMatch.team1Id}): ${targetTeam1.name}`);
        debugLog(`- TargetTeam2 (ID: ${targetMatch.team2Id}): ${targetTeam2.name}`);

        // Actualizar los IDs para que coincidan con la nueva estructura
        matchDetail.team1Id = targetMatch.team1Id;
        matchDetail.team2Id = targetMatch.team2Id;

        // Si el ganador era team1, actualizar al nuevo ID correspondiente
        if (matchDetail.winner === team1.id) {
          matchDetail.winner = targetTeam1.id;
        } else if (matchDetail.winner === team2.id) {
          matchDetail.winner = targetTeam2.id;
        }

        Object.assign(targetMatch, matchDetail);
        countRestored++;
        debugLog(`✓ Partido restaurado exitosamente: ${targetTeam1.name} vs ${targetTeam2.name}`);
      });

      debugLog(`\n=== Resumen: Restaurados ${countRestored} detalles de partidos en ronda ${roundIdx+1} ===\n`);
      return countRestored;
    };

    for (let roundIdx = 0; roundIdx < stage.rounds.length; roundIdx++) {
      const round = stage.rounds[roundIdx];
      
      if (roundIdx > 0) {
        stage.teams.forEach(team => {
          team.wins = 0;
          team.losses = 0;
          team.opponents = [];
          team.buchholzScore = 0;
        });
        for (let prevRoundIdx = 0; prevRoundIdx < roundIdx; prevRoundIdx++) {
          const prevRound = stage.rounds[prevRoundIdx];
          prevRound.matches.forEach(match => {
            if (match.winner) {
              const winnerTeam = stage.teams.find(t => t.id === match.winner);
              const loserTeam = stage.teams.find(t => t.id === (match.team1Id === match.winner ? match.team2Id : match.team1Id));
              if (winnerTeam) winnerTeam.wins = (winnerTeam.wins || 0) + 1;
              if (loserTeam) loserTeam.losses = (loserTeam.losses || 0) + 1;
              if (winnerTeam && loserTeam) {
                if (!winnerTeam.opponents) winnerTeam.opponents = [];
                if (!loserTeam.opponents) loserTeam.opponents = [];
                if (!winnerTeam.opponents.find(o => o.id === loserTeam.id)) winnerTeam.opponents.push({ id: loserTeam.id, score: 0 });
                if (!loserTeam.opponents.find(o => o.id === winnerTeam.id)) loserTeam.opponents.push({ id: winnerTeam.id, score: 0 });
              }
            }
          });
        }
        const { updateBuchholzScores } = require('./matchService');
        updateBuchholzScores(stage);
      }
      
      if (!round.matches || round.matches.length === 0) {
        debugLog(`Generando partidos para ronda ${roundIdx + 1} de ${phaseId}`);
        if (roundIdx === 0) {
          const firstRoundMatches = generateFirstRoundMatches(stage, currentSwissRules);
          if (firstRoundMatches.length > 0) {
            round.matches = [...firstRoundMatches];
            debugLog(`Generados ${firstRoundMatches.length} partidos para la primera ronda de ${phaseId}`);
          } else {
            console.warn(`Error al generar partidos para la ronda 1 en ${phaseId}`);
          }
        } else {
          const newMatches = generateNextRoundMatches(stage, roundIdx, currentSwissRules);
          if (newMatches && newMatches.length > 0) {
            round.matches = [...newMatches];
            debugLog(`Generados ${newMatches.length} partidos para la ronda ${roundIdx + 1} de ${phaseId}`);
          } else {
            console.warn(`No se pudieron generar partidos para la ronda ${roundIdx + 1} en ${phaseId}`);
          }
        }
      } else {
        debugLog(`Ronda ${roundIdx + 1} de ${phaseId} ya tiene ${round.matches.length} partidos, manteniendo estructura.`);
      }
      
      if (mergedMatchDetails[roundIdx]) {
        restoreMatchDetails(round, roundIdx, mergedMatchDetails[roundIdx], stage);
      }
      
      // Recalcular wins/losses después de restaurar, antes de simular pendientes
      stage.teams.forEach(team => { team.wins = 0; team.losses = 0; });
      for (let r = 0; r <= roundIdx; r++) {
          stage.rounds[r].matches.forEach(m => {
              if (m.winner) {
                  const winner = stage.teams.find(t => t.id === m.winner);
                  const loser = stage.teams.find(t => t.id === (m.team1Id === m.winner ? m.team2Id : m.team1Id));
                  if(winner) winner.wins = (winner.wins || 0) + 1;
                  if(loser) loser.losses = (loser.losses || 0) + 1;
              }
          });
      }

      const pendingMatches = round.matches.filter(match => match.winner === null).length;
      if (pendingMatches > 0 && round.matches.length > 0) {
        debugLog(`Simulando resultados para ${pendingMatches} partidos pendientes de la ronda ${roundIdx + 1} de ${phaseId}`);
        simulateRoundResults(stage, roundIdx);
      } else if (round.matches.length > 0) {
        debugLog(`La ronda ${roundIdx + 1} de ${phaseId} ya tiene todos los ganadores asignados/restaurados o no tiene partidos.`);
      }
      
      // DEBUG LOG ADICIONAL
      if (phaseId === localMajorData.currentStage && roundIdx === 0) {
        debugLog(`roundService.ts - generateSimulatedRounds - Ronda 0 Partidos DESPUÉS de simulación para fase ${phaseId}:`, JSON.stringify(round.matches, null, 2));
      }
      // FIN DEBUG LOG ADICIONAL

      if (roundIdx < stage.rounds.length -1) {
        const { updateBuchholzScores } = require('./matchService');
        updateBuchholzScores(stage);
      }
    }
    
    updateRoundStatuses(stage);
    const { updateBuchholzScores } = require('./matchService');
    updateBuchholzScores(stage);
    
    debugLog(`Generación de rondas completada para fase ${phaseId}`);
  } catch (error) {
    console.error(`Error generating simulated rounds for phase ${phaseId}:`, error);
  }
}

// Función auxiliar para actualizar el estado de las rondas
function updateRoundStatuses(stage: Stage): void {
  if (!stage.rounds) return;
  let lastCompletedRoundIndex = -1;
  
  for (let i = 0; i < stage.rounds.length; i++) {
    const currentRound = stage.rounds[i];
    const allMatchesHaveWinner = currentRound.matches.every((match: Match) => match.winner !== null);
    
    if (allMatchesHaveWinner && currentRound.matches.length > 0) {
      lastCompletedRoundIndex = i;
      currentRound.status = 'completed';
    } else if (currentRound.matches.length === 0 && i > 0) { // Verificar i > 0 antes de acceder a la ronda previa
        const previousRound = stage.rounds[i-1];
        if (previousRound && previousRound.status === 'completed') {
             currentRound.status = 'pending'; // Las rondas vacías después de completadas quedan pendientes hasta que updatePlayoffBracket las llene/active
             lastCompletedRoundIndex = i - 1; 
        } else {
             currentRound.status = 'pending'; 
        }
    } else { // La ronda tiene partidos pero no todos están completos, O es la primera ronda y no está completa
        currentRound.status = 'pending'; // Por defecto pendiente
        // Verificar si debería estar activa
        let previousRoundsCompleted = true;
        for(let k=0; k < i; k++) {
            if(stage.rounds[k].status !== 'completed') {
                previousRoundsCompleted = false;
                break;
            }
        }
        // Activar si las rondas previas están completas O si es la primera ronda con partidos
        if (previousRoundsCompleted && currentRound.matches.length > 0) {
            // Para playoffs, también verificamos si los equipos están asignados (ID != 0)
            const isPlayoffStage = stage.name.toLowerCase().includes('playoff') || stage.type === 'PLAYOFF' || phaseId === 'phase4';
            if (!isPlayoffStage || currentRound.matches.some(m => m.team1Id !== 0 && m.team2Id !== 0)) {
                 currentRound.status = 'active';
            }
        }
    }
  }
  
  // Lógica refinada para establecer la ronda 'active' única (especialmente para playoffs)
  let activeRoundSet = false;
  for (let i = 0; i < stage.rounds.length; i++) {
      const round = stage.rounds[i];
      if (round.status === 'completed') {
          continue;
      }
      // La primera ronda no completada con partidos *poblados* debe ser activa
      const hasPopulatedMatches = round.matches.length > 0 && round.matches.some(m => m.team1Id !== 0 && m.team2Id !== 0);
      
      if (!activeRoundSet && hasPopulatedMatches) {
          round.status = 'active';
          activeRoundSet = true;
      } else if (activeRoundSet) { // Si ya se estableció una ronda activa, las demás no completadas son pendientes
          round.status = 'pending';
      } else if (!hasPopulatedMatches){
          // Rondas sin partidos poblados (esperando avance) y no completadas, quedan pendientes
          round.status = 'pending';
      }
  }

  // Asegurar que la primera ronda sea activa si ninguna está completa y tiene partidos poblados
  if (!activeRoundSet && 
      stage.rounds[0] && 
      stage.rounds[0].status !== 'completed' && 
      stage.rounds[0].matches.length > 0 && 
      stage.rounds[0].matches.some(m => m.team1Id !== 0 && m.team2Id !== 0)) {
      stage.rounds[0].status = 'active';
  }
  
  debugLog(`Estados de rondas actualizados para ${stage.name}: Activa(s): ${stage.rounds.filter(r => r.status === 'active').map(r => r.roundNumber).join(', ')}, Completadas: ${stage.rounds.filter(r => r.status === 'completed').map(r => r.roundNumber).join(', ')}`);
}

// Variable global para phaseId dentro de updateRoundStatuses
let phaseId: string = '';

// Hook para setear phaseId antes de llamar a updateRoundStatuses desde generateSimulatedRounds
export function setPhaseIdForStatusUpdate(currentPhaseId: string): void {
    phaseId = currentPhaseId;
} 