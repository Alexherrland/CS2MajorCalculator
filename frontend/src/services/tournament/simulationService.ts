import { Stage, Team, Match } from '../../types/hltvTypes';
import { getCurrentData } from './dataService';
import { updateBuchholzScores } from './matchService';
import { simulatePhase1Completion, simulatePhase2Completion, simulatePhase3Completion } from './phaseService';
import { generateSimulatedRounds } from './roundService';

// Almacén global para equipos originales del backend
const originalTeamsFromBackend: { [stageId: string]: Team[] } = {};

/**
 * Guarda los equipos originales del backend para cada fase
 * Esta función debe ser llamada cuando se cargan datos frescos del backend
 */
export function saveOriginalTeamsFromBackend(majorData: any): void {
  if (!majorData || !majorData.stages) return;

  // Guarda los equipos originales para cada fase
  Object.keys(majorData.stages).forEach(stageId => {
    const stage = majorData.stages[stageId];
    if (stage && stage.teams && stage.teams.length > 0) {
      // Crear copias profundas para evitar referencias compartidas
      originalTeamsFromBackend[stageId] = stage.teams.map((team: Team) => ({
        ...team,
        isFromBackend: true // Marcar los equipos como originales del backend
      }));
      debugLog(`Guardados ${originalTeamsFromBackend[stageId].length} equipos originales para fase ${stageId}`);
    }
  });
}

/**
 * Obtiene los equipos originales para una fase específica
 */
export function getOriginalTeamsForStage(stageId: string): Team[] {
  return originalTeamsFromBackend[stageId] || [];
}

/**
 * Variable global para controlar la visualización de mensajes de depuración
 * 
 * DEBUG_MODE = true  -> Muestra todos los mensajes de depuración en la consola
 * DEBUG_MODE = false -> No muestra ningún mensaje de depuración
 */
export const DEBUG_MODE = false;

/**
 * Función de log que solo muestra mensajes cuando DEBUG_MODE está activado
 * Esta función reemplaza a todas las llamadas a console.log en la simulación
 */
export function debugLog(...args: any[]): void {
  if (DEBUG_MODE) {
    console.log(...args);
  }
}

/**
 * Recalcula el seeding de los equipos clasificados para la siguiente fase
 * basado en sus victorias, derrotas y puntuación Buchholz.
 * El nuevo seeding solo se aplica a la siguiente fase, sin afectar la fase actual.
 * 
 * @param qualifiedTeams Equipos clasificados para la siguiente fase
 * @param startingSeed Seed inicial para el primer equipo (por ejemplo, 17 para fase 2)
 * @returns Los equipos con su nuevo seeding calculado
 */
export function recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeams: Team[], startingSeed: number): Team[] {
  if (!qualifiedTeams || qualifiedTeams.length === 0) {
    return [];
  }

  debugLog(`Recalculando seeding para ${qualifiedTeams.length} equipos clasificados, comenzando con seed ${startingSeed}`);

  // Ordenar equipos primero por victorias (descendente), luego por derrotas (ascendente)
  // y finalmente por puntuación Buchholz (descendente)
  const sortedTeams = [...qualifiedTeams].sort((a, b) => {
    // Ordenar primero por victorias (más victorias = mejor posición)
    if ((b.wins || 0) !== (a.wins || 0)) {
      return (b.wins || 0) - (a.wins || 0);
    }
    
    // Si tienen las mismas victorias, el que tenga menos derrotas va primero
    if ((a.losses || 0) !== (b.losses || 0)) {
      return (a.losses || 0) - (b.losses || 0);
    }
    
    // Si tienen mismo récord, ordenar por Buchholz (mayor Buchholz = mejor posición)
    if ((b.buchholzScore || 0) !== (a.buchholzScore || 0)) {
      return (b.buchholzScore || 0) - (a.buchholzScore || 0);
    }
    
    // IMPORTANTE: Si tienen mismo Buchholz score, el seeding original es el desempate final
    // El equipo con mejor seed (número más bajo) tendrá prioridad en la siguiente fase también
    return (a.seed || Infinity) - (b.seed || Infinity);
  });
  console.log('sortedTeams', sortedTeams);
  // Asignar el nuevo seeding manteniendo el seeding original en originalSeed
  return sortedTeams.map((team, index) => {
    const newTeam = { ...team };
    newTeam.originalSeed = team.seed; // Guardar el seeding original
    newTeam.seed = startingSeed + index; // Asignar nuevo seeding para la próxima fase
    debugLog(`Equipo ${newTeam.name}: Seed original ${newTeam.originalSeed} -> Nuevo seed ${newTeam.seed} (${newTeam.wins}-${newTeam.losses}, Buchholz: ${newTeam.buchholzScore})`);
    return newTeam;
  });
}

// Función principal para generar todas las rondas del torneo
export async function simulateAllRounds(): Promise<void> {
  const localMajorData = getCurrentData();
  if (!localMajorData || !localMajorData.stages) {
    debugLog('No hay datos del torneo o fases definidas para simular.');
    return;
  }

  // Guardar equipos originales si no se han guardado ya
  if (Object.keys(originalTeamsFromBackend).length === 0) {
    saveOriginalTeamsFromBackend(localMajorData);
  }

  debugLog('--- ESTADO INICIAL DE EQUIPOS POR FASE (de getCurrentData) ---');
  if (localMajorData && localMajorData.stages) {
    Object.keys(localMajorData.stages).sort((a, b) => {
      const numA = parseInt(a.replace('phase', ''), 10);
      const numB = parseInt(b.replace('phase', ''), 10);
      return numA - numB;
    }).forEach(sId => {
      const currentStage = localMajorData.stages[sId];
      if (currentStage) {
        debugLog(`Fase ${sId} (${currentStage.name}): ${currentStage.teams ? currentStage.teams.length : 0} equipos.`);
        if (currentStage.teams && currentStage.teams.length > 0) {
          debugLog('Equipos:', currentStage.teams.map(t => ({ id: t.id, name: t.name, seed: t.seed, wins: t.wins, losses: t.losses })));
        } else {
          debugLog('Equipos: Ninguno');
        }
      } else {
        debugLog(`Fase ${sId}: No encontrada en localMajorData.stages.`);
      }
    });
  }
  debugLog('--- FIN ESTADO INICIAL DE EQUIPOS ---');

  try {
    debugLog('==========================================');
    debugLog('GENERANDO SIMULACIÓN DEL TORNEO COMPLETO');
    debugLog('==========================================');
    
    const prepareTeams = (teams: Team[] | undefined) => {
      (teams || []).forEach((team: Team) => {
        team.wins = team.wins || 0;
        team.losses = team.losses || 0;
        team.buchholzScore = team.buchholzScore || 0;
        team.opponents = team.opponents || [];
      });
    };

    const preserveExistingResults = (stageId: string) => {
      if (!localMajorData.stages[stageId] || !localMajorData.stages[stageId].rounds) return {};
      const existingResults: { [roundIdx: string]: { [matchIdx: string]: Partial<Match> } } = {};
      localMajorData.stages[stageId].rounds.forEach((round, roundIdx) => {
        if (!existingResults[roundIdx]) existingResults[roundIdx] = {};
        round.matches.forEach((match, matchIdx) => {
          if (match.winner !== null || 
              match.team1Score !== undefined || match.team2Score !== undefined || 
              match.map1_team1_score !== undefined || match.map1_team2_score !== undefined) {
            existingResults[roundIdx][matchIdx] = { ...match };
          }
        });
      });
      return existingResults;
    };

    const stageKeys = Object.keys(localMajorData.stages).sort((a, b) => {
      const numA = parseInt(a.replace('phase', ''), 10);
      const numB = parseInt(b.replace('phase', ''), 10);
      return numA - numB;
    });

    debugLog('Fases detectadas en el torneo:', stageKeys.join(', '));

    // Procesar todas las fases ANTERIORES a los playoffs primero
    for (const stageId of stageKeys) {
      const stage = localMajorData.stages[stageId];
      if (!stage) {
        debugLog(`Advertencia: Fase ${stageId} no encontrada, saltando.`);
        continue;
      }

      const isPlayoffStage = stage.name.toLowerCase().includes('playoff') || 
                             stage.type === 'PLAYOFF' || 
                             stageId === 'phase4';

      if (isPlayoffStage) {
        continue; 
      }

      debugLog(`
=========== PROCESANDO FASE REGULAR: ${stage.name} (${stageId}) ===========`);
      
      // Aquí aseguramos que siempre se incluyan los equipos originales del backend
      const originalTeamsForThisStage = getOriginalTeamsForStage(stageId);
      if (originalTeamsForThisStage.length > 0) {
        debugLog(`Restaurando ${originalTeamsForThisStage.length} equipos originales para ${stageId} desde el almacén global.`);
        
        // Crear un mapa de equipos actuales para verificar duplicados por ID
        const currentTeamIds = new Map();
        (stage.teams || []).forEach(team => {
          currentTeamIds.set(team.id, team);
        });
        
        // Añadir solo equipos originales que no estén ya en el array de equipos
        for (const originalTeam of originalTeamsForThisStage) {
          if (!currentTeamIds.has(originalTeam.id)) {
            if (!stage.teams) stage.teams = [];
            stage.teams.push({...originalTeam}); // Usar una copia para evitar mutaciones
            debugLog(`Añadido equipo original: ${originalTeam.name} (ID: ${originalTeam.id}) a ${stageId}`);
          }
        }
      }
      
      prepareTeams(stage.teams);
      const existingResults = preserveExistingResults(stageId);
      stage.rounds = []; 
      await generateSimulatedRounds(stageId, existingResults);
      printPhaseResults(stage);

      // Lógica de promoción desde la fase actual (stageId) a la siguiente fase regular
      const currentIndex = stageKeys.indexOf(stageId);
      if (currentIndex < stageKeys.length - 1) {
        const nextStageId = stageKeys[currentIndex + 1];
        const nextStageObject = localMajorData.stages[nextStageId];

        if (!nextStageObject) {
          debugLog(`ERROR CRÍTICO: Siguiente fase ${nextStageId} no encontrada en localMajorData. Saltando promoción desde ${stageId}.`);
          continue;
        }

        const nextStageIsAlsoPlayoffs = nextStageObject.name.toLowerCase().includes('playoff') ||
                                    nextStageObject.type === 'PLAYOFF' ||
                                    nextStageId === 'phase4';

        if (!nextStageIsAlsoPlayoffs) { // Solo manejar promoción a OTRA FASE REGULAR aquí
          // CAPTURAR ORIGINAL TEAMS OF NEXT STAGE ANTES de llamar a la función de completion de la fase actual
          // Guardamos los equipos que YA ESTABAN en la fase siguiente (que vienen del backend o datos iniciales)
          // Importante: hacemos una copia profunda para evitar que se modifiquen al cambiar los resultados
          const originalTeamsInNextStage = nextStageObject.teams ? 
              nextStageObject.teams.filter(t => !t.isPromoted).map(t => ({...t})) : [];
          
          debugLog(`[${nextStageId}] Copia de equipos ORIGINALES en ${nextStageId} (ANTES de llamar a completion de ${stageId}): ${originalTeamsInNextStage.length} equipos. Nombres: ${originalTeamsInNextStage.map(t=>t.name).join(', ') || 'Ninguno'}`);

          let qualifiedTeamsFromCurrentStage: Team[] = [];

          // Determinar qué equipos clasificaron de la fase actual (stageId)
          if (stageId === 'phase1') { 
            qualifiedTeamsFromCurrentStage = await simulatePhase1Completion();
            debugLog(`simulatePhase1Completion (desde ${stageId}) determinó ${qualifiedTeamsFromCurrentStage.length} equipos clasificados para ${nextStageId}.`);
            
            // Recalcular el seeding para los equipos que pasan a fase 2 (generalmente seeds 17-24)
            if (qualifiedTeamsFromCurrentStage.length > 0) {
              qualifiedTeamsFromCurrentStage = recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeamsFromCurrentStage, 17);
            }
          } else if (stageId === 'phase2') { 
            qualifiedTeamsFromCurrentStage = await simulatePhase2Completion();
            debugLog(`simulatePhase2Completion (desde ${stageId}) determinó ${qualifiedTeamsFromCurrentStage.length} equipos clasificados para ${nextStageId}.`);
            
            // Recalcular el seeding para los equipos que pasan a fase 3 (generalmente seeds 9-16)
            if (qualifiedTeamsFromCurrentStage.length > 0) {
              qualifiedTeamsFromCurrentStage = recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeamsFromCurrentStage, 9);
            }
          }
          // Añadir más 'else if' si hay más fases regulares como phaseX que promueven a phaseX+1

          if (qualifiedTeamsFromCurrentStage.length > 0) {
            // Marca los equipos promovidos para poder identificarlos en futuras simulaciones
            const promotedTeamsReset = qualifiedTeamsFromCurrentStage.map(t => ({ 
              ...t, 
              wins: 0, 
              losses: 0, 
              buchholzScore: 0, 
              opponents: [],
              isPromoted: true // Marcamos que este equipo fue promovido por simulación
            }));

            debugLog(`[${nextStageId}] Se van a combinar ${originalTeamsInNextStage.length} equipos (originales de ${nextStageId}) con ${promotedTeamsReset.length} equipos promovidos de ${stageId}.`);

            // Combinamos los equipos originales (del backend) con los promovidos de esta fase
            nextStageObject.teams = [
              ...originalTeamsInNextStage, // Usar la copia de los equipos originales de la siguiente fase
              ...promotedTeamsReset
            ];
            
            // Eliminamos posibles duplicados (mismo ID) dando prioridad a los originales
            const teamIds = new Set();
            nextStageObject.teams = nextStageObject.teams.filter(team => {
              if (teamIds.has(team.id)) {
                return false; // ya existe un equipo con este ID
              }
              teamIds.add(team.id);
              return true;
            });
            
            debugLog(`[${nextStageId}] Equipos DESPUÉS de combinar y eliminar duplicados: Total ${nextStageObject.teams.length}. Nombres: ${nextStageObject.teams.map(t=>t.name).join(', ') || 'Ninguno'}`);
          } else {
            debugLog(`No hubo equipos clasificados desde ${stageId} para ${nextStageId} según las funciones de PhaseCompletion, o la función no fue llamada.`);
            // Si no hay equipos clasificados, los equipos de la siguiente fase deben permanecer como estaban originalmente.
            nextStageObject.teams = originalTeamsInNextStage;
            debugLog(`[${nextStageId}] Equipos en ${nextStageId} se mantienen como los originales: Total ${nextStageObject.teams.length}. Nombres: ${nextStageObject.teams.map(t=>t.name).join(', ') || 'Ninguno'}`);
          }
        }
      }
    }

    let lastNonPlayoffStageId: string | null = null;
    for (let i = stageKeys.length - 1; i >= 0; i--) {
        const sId = stageKeys[i];
        const s = localMajorData.stages[sId];
        if (!s) continue;
        const isPlayoff = s.name.toLowerCase().includes('playoff') || s.type === 'PLAYOFF' || sId === 'phase4';
        if (!isPlayoff) {
            lastNonPlayoffStageId = sId;
            break;
        }
    }
    
    let playoffStageId: string | null = stageKeys.find(key => 
        localMajorData.stages[key]?.name.toLowerCase().includes('playoff') || 
        localMajorData.stages[key]?.type === 'PLAYOFF' || 
        key === 'phase4'
    ) || null;

    if (lastNonPlayoffStageId && playoffStageId && localMajorData.stages[playoffStageId]) {
      debugLog(`
--- Preparando promoción de ${lastNonPlayoffStageId} a ${playoffStageId} ---`);
      
      // Guardamos los equipos originales de la fase de playoffs (del backend)
      const originalPlayoffTeams = getOriginalTeamsForStage(playoffStageId);
      const originalPlayoffsFromCurrentData = localMajorData.stages[playoffStageId].teams
        ? localMajorData.stages[playoffStageId].teams.filter(t => t.isFromBackend || (!t.isPromoted && !t.isFromBackend))
        : [];
      
      // Combinamos equipos originales de ambas fuentes
      const allOriginalPlayoffTeams = [
        ...originalPlayoffTeams, 
        ...originalPlayoffsFromCurrentData.filter(t => !originalPlayoffTeams.some(ot => ot.id === t.id))
      ];
      
      debugLog(`[${playoffStageId}] Equipos ORIGINALES en playoffs antes de promoción: ${allOriginalPlayoffTeams.length} equipos.`);
      
      let qualifiedTeams: Team[] = [];
      // Usar la función de completion apropiada para la ÚLTIMA fase no-playoff
      if (lastNonPlayoffStageId === 'phase1') {
        qualifiedTeams = await simulatePhase1Completion();
        // Recalcular el seeding para los equipos que pasan a playoffs desde phase1 (seeds 1-8)
        if (qualifiedTeams.length > 0) {
          qualifiedTeams = recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeams, 1);
        }
      } else if (lastNonPlayoffStageId === 'phase2') {
        qualifiedTeams = await simulatePhase2Completion();
        // Recalcular el seeding para los equipos que pasan a playoffs desde phase2 (seeds 1-8)
        if (qualifiedTeams.length > 0) {
          qualifiedTeams = recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeams, 1);
        }
      } else if (lastNonPlayoffStageId === 'phase3') { // Esta es la más común para ir a Playoffs
        qualifiedTeams = await simulatePhase3Completion();
        // Recalcular el seeding para los equipos que pasan a playoffs desde phase3 (seeds 1-8)
        if (qualifiedTeams.length > 0) {
          qualifiedTeams = recalculateNextPhaseSeedForQualifiedTeams(qualifiedTeams, 1);
        }
      }
      
       if (qualifiedTeams.length > 0) {
            debugLog(`
EQUIPOS CLASIFICADOS DE ${localMajorData.stages[lastNonPlayoffStageId].name} A ${localMajorData.stages[playoffStageId].name} (Playoffs):`);
            qualifiedTeams.forEach(team => {
                debugLog(`- ${team.name} (Seed: ${team.seed}, Record: ${team.wins}-${team.losses}, Buchholz: ${team.buchholzScore})`);
            });
            
            // Marca los equipos promovidos para identificarlos en futuras simulaciones
            const promotedPlayoffTeams = qualifiedTeams.map(t => ({
                ...t, 
                wins: 0, 
                losses: 0, 
                buchholzScore: 0, 
                opponents: [],
                isPromoted: true // Marcamos equipos promovidos
            }));
            
            // Combinamos equipos originales con promovidos
            localMajorData.stages[playoffStageId].teams = [
                ...allOriginalPlayoffTeams,
                ...promotedPlayoffTeams
            ];
            
            // Eliminamos posibles duplicados (mismo ID) dando prioridad a los originales
            const teamIds = new Set();
            localMajorData.stages[playoffStageId].teams = localMajorData.stages[playoffStageId].teams.filter(team => {
              if (teamIds.has(team.id)) {
                return false; // ya existe un equipo con este ID
              }
              teamIds.add(team.id);
              return true;
            });
            
            debugLog(`${localMajorData.stages[playoffStageId].teams.length} equipos totales asignados a ${playoffStageId} (${allOriginalPlayoffTeams.length} originales + ${promotedPlayoffTeams.length} promovidos).`);
            debugLog(`[${playoffStageId}] Equipos después de promoción desde ${lastNonPlayoffStageId} (${localMajorData.stages[playoffStageId].name}): ${localMajorData.stages[playoffStageId].teams?.length || 0} equipos.`);
        } else {
            debugLog(`No se clasificaron equipos de ${lastNonPlayoffStageId} o ${playoffStageId} no existe o no hubo equipos.`);
            // Mantener equipos originales si no hay clasificados
            localMajorData.stages[playoffStageId].teams = allOriginalPlayoffTeams;
            debugLog(`Se mantienen los ${allOriginalPlayoffTeams.length} equipos originales en ${playoffStageId}.`);
        }
    } else if (playoffStageId && !lastNonPlayoffStageId) {
        debugLog(`El torneo parece consistir solo en una fase de Playoffs (${playoffStageId}). Los equipos deben estar predefinidos.`);
        
        // Restaurar equipos originales del almacén global
        const originalPlayoffTeams = getOriginalTeamsForStage(playoffStageId);
        if (originalPlayoffTeams.length > 0) {
          localMajorData.stages[playoffStageId].teams = [...originalPlayoffTeams];
          debugLog(`Restaurados ${originalPlayoffTeams.length} equipos originales para fase de playoffs desde el almacén global.`);
        }
        
        // Log de equipos iniciales para un torneo solo de playoffs
        debugLog(`[${playoffStageId}] Equipos iniciales (torneo solo playoffs, antes de prepareTeams) (${localMajorData.stages[playoffStageId]?.name}): ${localMajorData.stages[playoffStageId]?.teams?.length || 0} equipos.`);
        prepareTeams(localMajorData.stages[playoffStageId].teams);
    }

    if (playoffStageId && localMajorData.stages[playoffStageId]) {
      const stage = localMajorData.stages[playoffStageId];
      debugLog(`
=========== PROCESANDO FASE PLAYOFFS: ${stage.name} (${playoffStageId}) ===========`);
      
      // Log de equipos al inicio del procesamiento de la fase de playoffs, antes de prepareTeams
      debugLog(`[${playoffStageId}] Equipos al inicio del bloque de playoffs ANTES de prepareTeams (${stage.name}): ${stage.teams?.length || 0} equipos.`);
      
      prepareTeams(stage.teams); 
      
      // Log de equipos DESPUÉS de prepareTeams
      debugLog(`[${playoffStageId}] Equipos en playoffs DESPUÉS de prepareTeams (${stage.name}): ${stage.teams?.length || 0} equipos.`);

      if (!stage.teams || stage.teams.length === 0) {
          debugLog(`ERROR CRÍTICO: No hay equipos en ${playoffStageId} (${stage.name}) ANTES de llamar a generateSimulatedRounds. Revisar lógica de promoción.`);
      } else {
          debugLog(`${stage.teams.length} equipos encontrados en ${playoffStageId} (${stage.name}) antes de simular sus rondas.`);
      }

      const existingPlayoffResults = preserveExistingResults(playoffStageId);
      stage.rounds = [];
      await generateSimulatedRounds(playoffStageId, existingPlayoffResults);
      printPhaseResults(stage);
      
      const champion = findChampion(stage);
      if (champion) {
        debugLog('\n🏆 CAMPEÓN DEL TORNEO 🏆');
        debugLog(`${champion.name} (Seed: ${champion.seed})`);
      }
    }
    
    debugLog('\n==========================================');
    debugLog('SIMULACIÓN COMPLETADA CON ÉXITO');
    debugLog('==========================================');
  } catch (error) {
    console.error('Error generating all rounds:', error);
  }
}

// Función para imprimir resultados de una fase
function printPhaseResults(stage: Stage): void {
  if (!stage || !stage.rounds || stage.rounds.length === 0) {
   debugLog('  No hay rondas disponibles para esta fase o la fase no existe.');
    return;
  }
  
  // Imprimir resultados por ronda
  stage.rounds.forEach((round, roundIndex) => {
   debugLog(`\n  RONDA ${round.roundNumber}:`);
    
    if (!round.matches || round.matches.length === 0) {
     debugLog('    No hay partidos en esta ronda');
      return;
    }
    
    round.matches.forEach((match, matchIndex) => {
      const team1 = stage.teams?.find(t => t.id === match.team1Id);
      const team2 = stage.teams?.find(t => t.id === match.team2Id);
      
      if (!team1 || !team2) {
       debugLog(`    Match ${matchIndex + 1}: Datos de equipos (${match.team1Id} vs ${match.team2Id}) no disponibles`);
        return;
      }
      
      const winnerName = match.winner === team1.id ? team1.name : 
                         match.winner === team2.id ? team2.name : 'Pendiente';
      const score = match.team1Score !== undefined && match.team2Score !== undefined 
                    ? `${match.team1Score}-${match.team2Score}` 
                    : (match.winner ? 'W/L' : '0-0');
      
      // debugLog(`    ${team1.name} vs ${team2.name} => ${winnerName} (${score})`);
    });
  });
  
  // Imprimir estado final de los equipos
 debugLog('\n  CLASIFICACIÓN FINAL:');
  
  // Agrupar por récord
  const teamsByRecord: { [key: string]: Team[] } = {};
  stage.teams.forEach(team => {
    const record = `${team.wins || 0}-${team.losses || 0}`;
    if (!teamsByRecord[record]) {
      teamsByRecord[record] = [];
    }
    teamsByRecord[record].push(team);
  });
  
  // Ordenar récords (3-0, 3-1, 3-2, 2-3, 1-3, 0-3, etc.)
  const sortedRecords = Object.keys(teamsByRecord).sort((a, b) => {
    const [winsA, lossesA] = a.split('-').map(Number);
    const [winsB, lossesB] = b.split('-').map(Number);
    
    // Primero comparar por victorias (mayor a menor)
    if (winsA !== winsB) return winsB - winsA;
    
    // Luego por derrotas (menor a mayor)
    return lossesA - lossesB;
  });
  
  // Imprimir equipos por récord
  sortedRecords.forEach(record => {
   debugLog(`\n  Equipos ${record}:`);
    
    // Ordenar por Buchholz dentro de cada grupo de récord
    const sortedTeams = teamsByRecord[record].sort((a, b) => {
      const buchholzA = a.buchholzScore || 0;
      const buchholzB = b.buchholzScore || 0;
      if (buchholzA !== buchholzB) return buchholzB - buchholzA;
      return (a.seed || Infinity) - (b.seed || Infinity);
    });
    
    sortedTeams.forEach(team => {
     debugLog(`    ${team.name} (Seed: ${team.seed}, Buchholz: ${team.buchholzScore || 0})`);
    });
  });
}

// Función para encontrar el campeón del torneo
function findChampion(phase3: Stage): Team | undefined {
  // El campeón es el equipo con más victorias en la fase 3
  return phase3.teams
    .sort((a, b) => {
      const winsA = a.wins || 0;
      const winsB = b.wins || 0;
      if (winsA !== winsB) return winsB - winsA;
      return (a.seed || Infinity) - (b.seed || Infinity);
    })[0];
}

// Simular resultados para una ronda específica basados en seeding
export function simulateRoundResults(stage: Stage, roundIndex: number): void {
  if (!stage.rounds[roundIndex]) {
    console.error(`La ronda ${roundIndex} no existe en la fase`);
    return;
  }
  
  const round = stage.rounds[roundIndex];
 debugLog(`Simulando resultados para ronda ${roundIndex + 1} con ${round.matches.length} partidos`);
  
  round.matches.forEach((match: Match) => {
    // Si ya hay un ganador (datos reales del backend o selección del usuario), respetarlo
    if (match.winner !== null) {
      const team1 = stage.teams.find((t: Team) => t.id === match.team1Id);
      const team2 = stage.teams.find((t: Team) => t.id === match.team2Id);
      const winnerName = match.winner === match.team1Id 
                        ? team1?.name || 'Equipo 1' 
                        : team2?.name || 'Equipo 2';
     debugLog(`Match ${match.team1Id} vs ${match.team2Id} ya tiene ganador: ${winnerName} (${match.winner})`);
      return;
    }
    
    // Buscar los equipos
    const team1 = stage.teams.find((t: Team) => t.id === match.team1Id);
    const team2 = stage.teams.find((t: Team) => t.id === match.team2Id);
    
    if (!team1 || !team2) {
      console.error(`No se encontraron los equipos ${match.team1Id} o ${match.team2Id} en la fase`);
      return;
    }
    
   debugLog(`Simulando resultado para ${team1.name} (${team1.seed}) vs ${team2.name} (${team2.seed})`);
    
    // Determinar el ganador basado en el seeding (el de menor seed gana)
    match.winner = (team1.seed || Infinity) < (team2.seed || Infinity) ? team1.id : team2.id;
    
    // Actualizar registros de los equipos
    const winningTeam = match.winner === team1.id ? team1 : team2;
    const losingTeam = match.winner === team1.id ? team2 : team1;
    
    // Registrar el récord anterior para logging
    const prevWinnerRecord = `${winningTeam.wins || 0}-${winningTeam.losses || 0}`;
    const prevLoserRecord = `${losingTeam.wins || 0}-${losingTeam.losses || 0}`;
    
    winningTeam.wins = (winningTeam.wins || 0) + 1;
    losingTeam.losses = (losingTeam.losses || 0) + 1;
    
    // debugLog(`${winningTeam.name} pasa de ${prevWinnerRecord} a ${winningTeam.wins}-${winningTeam.losses}`);
    // debugLog(`${losingTeam.name} pasa de ${prevLoserRecord} a ${losingTeam.wins}-${losingTeam.losses}`);
    
    // Actualizar oponentes para puntuación Buchholz
    if (!winningTeam.opponents) winningTeam.opponents = [];
    if (!losingTeam.opponents) losingTeam.opponents = [];
    
    // Agregar oponente si no existe ya
    if (!winningTeam.opponents.find(o => o.id === losingTeam.id)) {
      winningTeam.opponents.push({
        id: losingTeam.id,
        score: 0
      });
    }
    
    if (!losingTeam.opponents.find(o => o.id === winningTeam.id)) {
      losingTeam.opponents.push({
        id: winningTeam.id,
        score: 0
      });
    }
    
    // No se simula el score, se deja como null o los valores existentes
    // para mantener los datos reales que vienen del backend
    
    // debugLog(`Resultado simulado: ${winningTeam.name} gana a ${losingTeam.name}`);
  });
  
  // Actualizar puntuaciones Buchholz
 debugLog('Actualizando puntuaciones Buchholz después de la simulación');
  updateBuchholzScores(stage);
  
  // Mostrar información de los equipos después de la actualización
 debugLog('Estado de los equipos después de la simulación:');
  stage.teams.forEach(team => {
   debugLog(`${team.name}: ${team.wins}-${team.losses}, Buchholz: ${team.buchholzScore}`);
  });
}

// Generar emparejamientos de primera ronda
export function generateFirstRoundMatches(stage: Stage): Match[] {
  try {
    if (!stage.teams || stage.teams.length < 2) {
      console.error("No hay suficientes equipos para generar partidos");
      return [];
    }
    
    // Ordenar equipos por seeding (menor es mejor)
    const sortedTeams = [...stage.teams].sort((a, b) => a.seed - b.seed);
    
    const matches: Match[] = [];
    
    // Emparejamiento de primera ronda: 1 vs 9, 2 vs 10, etc.
    const halfLength = Math.floor(sortedTeams.length / 2);
    for (let i = 0; i < halfLength; i++) {
      const highSeedTeam = sortedTeams[i];
      const lowSeedTeam = sortedTeams[i + halfLength];
      
      const match: Match = {
        team1Id: highSeedTeam.id,
        team2Id: lowSeedTeam.id,
        winner: null,
        isBO3: false
      };
      
      matches.push(match);
    }
    
    return matches;
  } catch (error) {
    console.error("Error al generar partidos de primera ronda:", error);
    return [];
  }
}

// Generar bracket de playoffs para la fase 3 (Champions Stage)
export function generatePlayoffBracket(stage: Stage): void {
  try {
    if (!stage.teams || stage.teams.length !== 8) {
      console.error("Se necesitan exactamente 8 equipos para generar un bracket de playoffs");
      return;
    }

   debugLog("Generando bracket de playoffs con 8 equipos");
    
    // Ordenar equipos por seed (1-8)
    const seededTeams = [...stage.teams].sort((a, b) => (a.seed || Infinity) - (b.seed || Infinity));
    
    // Inicializar las 3 rondas del bracket (cuartos, semis, final)
    if (!stage.rounds) stage.rounds = [];
    
    // Crear rondas si no existen
    while (stage.rounds.length < 3) {
      const roundNumber = stage.rounds.length + 1;
      stage.rounds.push({
        roundNumber,
        matches: [],
        status: roundNumber === 1 ? 'active' : 'pending'
      });
    }
    
    // Cuartos de final (1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6)
    const quarterfinals = [
      { high: 0, low: 7 }, // 1 vs 8
      { high: 3, low: 4 }, // 4 vs 5
      { high: 1, low: 6 }, // 2 vs 7
      { high: 2, low: 5 }  // 3 vs 6
    ];
    
    // Generar cuartos de final
    stage.rounds[0].matches = quarterfinals.map(pair => ({
      team1Id: seededTeams[pair.high].id,
      team2Id: seededTeams[pair.low].id,
      winner: null,
      isBO3: true // Todos los partidos de playoffs son BO3
    }));
    
   debugLog("Cuartos de final generados:");
    stage.rounds[0].matches.forEach((match, idx) => {
      const team1 = seededTeams.find(t => t.id === match.team1Id);
      const team2 = seededTeams.find(t => t.id === match.team2Id);
      // debugLog(`QF ${idx+1}: ${team1?.name} (#${team1?.seed}) vs ${team2?.name} (#${team2?.seed})`);
    });
    
    // Semifinales y Final tendrán que ser completadas con los ganadores de las rondas anteriores
    
    // Limpiar matches de semifinales y final si existen
    if (stage.rounds[1].matches.length > 0) {
      stage.rounds[1].matches = [];
    }
    
    // Crear 2 partidos vacíos para semifinales
    for (let i = 0; i < 2; i++) {
      stage.rounds[1].matches.push({
        team1Id: 0, // Se llenará después con ganadores
        team2Id: 0,
        winner: null,
        isBO3: true
      });
    }
    
    // Limpiar final si existe
    if (stage.rounds[2].matches.length > 0) {
      stage.rounds[2].matches = [];
    }
    
    // Crear partido para la final
    stage.rounds[2].matches.push({
      team1Id: 0,
      team2Id: 0,
      winner: null,
      isBO3: true
    });
    
   debugLog("Estructura de bracket de playoffs completada");
  } catch (error) {
    console.error("Error al generar bracket de playoffs:", error);
  }
}

// Actualizar bracket de playoffs tras un resultado
export function updatePlayoffBracket(stage: Stage): void {
  try {
    if (!stage.rounds || stage.rounds.length !== 3 || 
        !stage.rounds[0] || !stage.rounds[1] || !stage.rounds[2] ||
        !stage.rounds[0].matches || !stage.rounds[1].matches || !stage.rounds[2].matches) {
      console.error("Estructura de rondas o partidos incorrecta para playoffs en", stage.name);
      return;
    }
    
    // Verificamos si los cuartos de final tienen resultados para actualizar semifinales
    const quarterfinals = stage.rounds[0].matches;
    const semifinals = stage.rounds[1].matches;
    const finalMatch = stage.rounds[2].matches[0];

    // Asegurarse de que hay suficientes partidos en cada ronda para el bracket estándar
    if (quarterfinals.length < 4 || semifinals.length < 2 || !finalMatch) {
        console.error("Número insuficiente de partidos definidos para el bracket de playoffs en", stage.name);
        return;
    }

    // Lógica para cuartos -> semifinales
    // Semifinal 1: Ganador QF1 vs Ganador QF2
    if (quarterfinals[0].winner !== null && quarterfinals[1].winner !== null) {
      if (semifinals[0].team1Id !== quarterfinals[0].winner) semifinals[0].team1Id = quarterfinals[0].winner!;
      if (semifinals[0].team2Id !== quarterfinals[1].winner) semifinals[0].team2Id = quarterfinals[1].winner!;
      debugLog(`Playoffs: Semifinal 1 actualizada: ${semifinals[0].team1Id} vs ${semifinals[0].team2Id}`);
    } else {
        // Si alguno de los QF no está completo, la SF podría estar parcialmente llena o vacía
        if (quarterfinals[0].winner !== null && semifinals[0].team1Id !== quarterfinals[0].winner) {
            semifinals[0].team1Id = quarterfinals[0].winner!;
        } else if (quarterfinals[0].winner === null && semifinals[0].team1Id !== 0) {
            // semifinals[0].team1Id = 0; // Opcional: limpiar si el partido QF se revierte
        }
        if (quarterfinals[1].winner !== null && semifinals[0].team2Id !== quarterfinals[1].winner) {
            semifinals[0].team2Id = quarterfinals[1].winner!;
        } else if (quarterfinals[1].winner === null && semifinals[0].team2Id !== 0) {
            // semifinals[0].team2Id = 0;
        }
    }

    // Semifinal 2: Ganador QF3 vs Ganador QF4
    if (quarterfinals[2].winner !== null && quarterfinals[3].winner !== null) {
      if (semifinals[1].team1Id !== quarterfinals[2].winner) semifinals[1].team1Id = quarterfinals[2].winner!;
      if (semifinals[1].team2Id !== quarterfinals[3].winner) semifinals[1].team2Id = quarterfinals[3].winner!;
      debugLog(`Playoffs: Semifinal 2 actualizada: ${semifinals[1].team1Id} vs ${semifinals[1].team2Id}`);
    } else {
        if (quarterfinals[2].winner !== null && semifinals[1].team1Id !== quarterfinals[2].winner) {
            semifinals[1].team1Id = quarterfinals[2].winner!;
        } else if (quarterfinals[2].winner === null && semifinals[1].team1Id !== 0) {
            // semifinals[1].team1Id = 0;
        }
        if (quarterfinals[3].winner !== null && semifinals[1].team2Id !== quarterfinals[3].winner) {
            semifinals[1].team2Id = quarterfinals[3].winner!;
        } else if (quarterfinals[3].winner === null && semifinals[1].team2Id !== 0) {
            // semifinals[1].team2Id = 0;
        }
    }

    // Lógica para semifinales -> final
    // Final: Ganador SF1 vs Ganador SF2
    if (semifinals[0].winner !== null && semifinals[1].winner !== null) {
      if (finalMatch.team1Id !== semifinals[0].winner) finalMatch.team1Id = semifinals[0].winner!;
      if (finalMatch.team2Id !== semifinals[1].winner) finalMatch.team2Id = semifinals[1].winner!;
      debugLog(`Playoffs: Final actualizada: ${finalMatch.team1Id} vs ${finalMatch.team2Id}`);
    } else {
        if (semifinals[0].winner !== null && finalMatch.team1Id !== semifinals[0].winner) {
            finalMatch.team1Id = semifinals[0].winner!;
        } else if (semifinals[0].winner === null && finalMatch.team1Id !== 0) {
            // finalMatch.team1Id = 0;
        }
        if (semifinals[1].winner !== null && finalMatch.team2Id !== semifinals[1].winner) {
            finalMatch.team2Id = semifinals[1].winner!;
        } else if (semifinals[1].winner === null && finalMatch.team2Id !== 0) {
            // finalMatch.team2Id = 0;
        }
    }

    // La actualización de estados de ronda (active/pending/completed) se hace en updateRoundStatusesLocal
    // llamada desde dataService después de esta función.

  } catch (error) {
    console.error("Error al actualizar bracket de playoffs:", error);
  }
}

// Generar emparejamientos para las siguientes rondas
export function generateNextRoundMatches(stage: Stage, roundIndex: number): Match[] {
  if (stage.type === "PLAYOFF" || stage.name?.toLowerCase().includes("playoff") || stage.name?.toLowerCase().includes("champions")) {
    return stage.rounds?.[roundIndex]?.matches || [];
  }
  debugLog(`Placeholder para generar partidos de ronda ${roundIndex + 1} para fase Suzia ${stage.name}. Usar matchService.generateNextRoundMatches.`);
  return []; 
} 