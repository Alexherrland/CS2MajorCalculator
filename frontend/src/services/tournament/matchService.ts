import { Stage, Team, Opponent, Match } from '../../types/hltvTypes';
import { debugLog } from './simulationService';
// Verificar si dos equipos han jugado antes
export function havePlayedBefore(stage: Stage, team1Id: number, team2Id: number): boolean {
  if (!stage.rounds) return false;
  return stage.rounds.some((round) => 
    round.matches.some((match) => 
      (match.team1Id === team1Id && match.team2Id === team2Id) || 
      (match.team1Id === team2Id && match.team2Id === team1Id)
    )
  );
}

// Verificar si una ronda está completa
export function isRoundComplete(round: any): boolean {
  return round.matches.every((match: Match) => match.winner !== null);
}

// Actualizar puntuaciones Buchholz para cada equipo
export function updateBuchholzScores(stage: Stage): void {
  if (!stage || !stage.teams) return;
  stage.teams.forEach((team: Team) => {
    team.buchholzScore = 0;
  });

  const opponentsInStage: { [teamId: number]: Set<number> } = {};
  stage.teams.forEach(t => opponentsInStage[t.id] = new Set());

  stage.rounds?.forEach((round) => {
    round.matches.forEach((match) => {
      if (match.winner && match.team1Id && match.team2Id) {
        const team1 = stage.teams.find((t: Team) => t.id === match.team1Id);
        const team2 = stage.teams.find((t: Team) => t.id === match.team2Id);
        
        if (team1 && team2) {
          opponentsInStage[team1.id].add(team2.id);
          opponentsInStage[team2.id].add(team1.id);
        }
      }
    });
  });

  stage.teams.forEach((team: Team) => {
    let totalBuchholz = 0;
    opponentsInStage[team.id]?.forEach((opponentId: number) => {
      const opponentTeam = stage.teams.find((t: Team) => t.id === opponentId);
      if (opponentTeam) {
        const opponentRecordDiff = (opponentTeam.wins || 0) - (opponentTeam.losses || 0);
        totalBuchholz += opponentRecordDiff;
      }
    });
    team.buchholzScore = totalBuchholz;
  });
}

// Generar emparejamientos de primera ronda
export function generateFirstRoundMatches(stage: Stage, swissRulesType: string = 'BUCHHOLZ'): Match[] {
  try {
    if (!stage.teams || stage.teams.length < 2) {
      console.error("No hay suficientes equipos para generar partidos de primera ronda en la fase", stage.name);
      return [];
    }
    debugLog(`Generando partidos de primera ronda para ${stage.name} usando reglas: ${swissRulesType}`);
    
    const sortedTeams = [...stage.teams].sort((a, b) => (a.seed || Infinity) - (b.seed || Infinity));
    const matches: Match[] = [];
    const numMatches = Math.floor(sortedTeams.length / 2);

    // Emparejamiento estándar para Suizo: seed más alto vs seed más bajo disponible en la mitad opuesta.
    // Para 16 equipos: 1v9, 2v10, ..., 8v16
    // Para 8 equipos (si una fase suiza tuviera 8): 1v5, 2v6, 3v7, 4v8
    for (let i = 0; i < numMatches; i++) {
        const team1Index = i;
        const team2Index = i + numMatches; 

        // Verificar si los índices son válidos (especialmente para números impares de equipos, aunque Suizo suele ser par)
        if (team2Index >= sortedTeams.length) {
            debugLog("Se omitió un partido en la primera ronda debido a un número impar de equipos o error de índice.");
            continue; 
        }

        const highSeedTeam = sortedTeams[team1Index];
        const lowSeedTeam = sortedTeams[team2Index];

        if (!highSeedTeam || !lowSeedTeam) {
            console.error("Error al obtener equipos para emparejamiento de primera ronda.");
            continue;
        }

        const match: Match = {
            team1Id: highSeedTeam.id,
            team2Id: lowSeedTeam.id,
            winner: null,
            isBO3: false // Primera ronda suele ser BO1 en sistema suizo
        };
        matches.push(match);
        debugLog(`Primera ronda ${stage.name}: ${highSeedTeam.name} (seed ${highSeedTeam.seed}) vs ${lowSeedTeam.name} (seed ${lowSeedTeam.seed})`);
    }
    return matches;
  } catch (error) {
    console.error("Error al generar partidos de primera ronda para", stage.name, error);
    return [];
  }
}

// Calcular seeding para comparar equipos
function calculateSeedingCriteria(team: Team, stage: Stage): [number, number, number] {
  const recordDiff = (team.wins || 0) - (team.losses || 0);
  const buchholzScore = team.buchholzScore || 0; 
  const initialSeed = team.seed || Infinity;
  return [-recordDiff, -buchholzScore, initialSeed]; // Negativo para ordenar descendentemente por récord y Buchholz
}

// Comparar seeding entre dos equipos
export function compareSeeding(a: Team, b: Team, stage: Stage): number {
  const seedingA = calculateSeedingCriteria(a, stage);
  const seedingB = calculateSeedingCriteria(b, stage);
  for (let i = 0; i < seedingA.length; i++) {
    if (seedingA[i] !== seedingB[i]) {
      return seedingA[i] - seedingB[i];
    }
  }
  return 0;
}

// Generar emparejamientos para las siguientes rondas
export function generateNextRoundMatches(stage: Stage, roundIndex: number, swissRulesType: string = 'BUCHHOLZ'): Match[] {
  debugLog(`Generando emparejamientos para ${stage.name}, Ronda ${roundIndex + 1} usando reglas: ${swissRulesType}`);
  
  // MAX_WINS_LOSSES_SWISS: Límite para clasificación/eliminación en fases suizas
  const MAX_WINS_LOSSES_SWISS = 3;

  const activeTeams = (stage.teams || []).filter(team => 
    (team.wins || 0) < MAX_WINS_LOSSES_SWISS && (team.losses || 0) < MAX_WINS_LOSSES_SWISS
  );
  
  debugLog(`Equipos activos para Ronda ${roundIndex + 1} en ${stage.name}: ${activeTeams.length}`);
  if (activeTeams.length < 2) {
    debugLog('No hay suficientes equipos activos para generar partidos.');
    return [];
  }

  const teamsByRecord: { [key: string]: Team[] } = {};
  activeTeams.forEach((team: Team) => {
    const record = `${team.wins || 0}-${team.losses || 0}`;
    if (!teamsByRecord[record]) teamsByRecord[record] = [];
    teamsByRecord[record].push(team);
  });

  debugLog(`Distribución de equipos por récord para ${stage.name}, Ronda ${roundIndex + 1}:`);
  Object.entries(teamsByRecord).forEach(([record, teams]) => {
    debugLog(`  Récord ${record}: ${teams.length} equipos - ${teams.map(t => t.name).join(', ')}`);
  });

  const matches: Match[] = [];
  const processedTeamIds = new Set<number>();

  // Procesar grupos de récord, priorizando los que ya están "completos" (pares)
  const recordGroups = Object.entries(teamsByRecord)
    .sort(([, teamsA], [, teamsB]) => teamsA.length % 2 - teamsB.length % 2); // Pares primero

  for (const [record, teamsInGroup] of recordGroups) {
    const availableTeamsInGroup = teamsInGroup
        .filter(team => !processedTeamIds.has(team.id))
        .sort((a, b) => compareSeeding(a, b, stage)); // Ordenar por seeding DENTRO del grupo de récord

    debugLog(`Procesando récord ${record} (${availableTeamsInGroup.length} equipos disponibles): ${availableTeamsInGroup.map(t => `${t.name}(${t.buchholzScore || 0})`).join(', ')}`);

    while (availableTeamsInGroup.length >= 2) {
      const team1 = availableTeamsInGroup.shift()!; // Tomar el de mejor seed
      let team2: Team | undefined = undefined;

      // availableTeamsInGroup ahora contiene solo los oponentes potenciales para team1.
      // Está ordenado de mejor seed a peor seed.
      const potentialOpponents = [...availableTeamsInGroup];

      const nonRematchCandidates: Team[] = [];
      const rematchCandidates: Team[] = [];

      potentialOpponents.forEach(pOp => {
        if (!havePlayedBefore(stage, team1.id, pOp.id)) {
          nonRematchCandidates.push(pOp);
        } else {
          rematchCandidates.push(pOp);
        }
      });
      // nonRematchCandidates y rematchCandidates están ordenados de mejor seed a peor seed.

      let opponentForTeam1: Team | undefined = undefined;

      if (nonRematchCandidates.length > 0) {
        const candidatesAvoidingLPR: Team[] = [];
        const candidatesForcingLPR: Team[] = [];

        nonRematchCandidates.forEach(nrCandidate => {
          const teamsLeftIfPaired = potentialOpponents.filter(t => t.id !== nrCandidate.id);
          let forcesLPR = false;
          if (teamsLeftIfPaired.length === 2) {
            if (havePlayedBefore(stage, teamsLeftIfPaired[0].id, teamsLeftIfPaired[1].id)) {
              forcesLPR = true;
            }
          } else if (teamsLeftIfPaired.length === 0) {
            forcesLPR = false;
          }
          // Si teamsLeftIfPaired.length > 2, la simple comprobación LPR no aplica, se asume que no fuerza LPR.

          if (forcesLPR) {
            candidatesForcingLPR.push(nrCandidate);
          } else {
            candidatesAvoidingLPR.push(nrCandidate);
          }
        });

        if (candidatesAvoidingLPR.length > 0) {
          opponentForTeam1 = candidatesAvoidingLPR[candidatesAvoidingLPR.length - 1]; // Peor seed de los que evitan LPR
          debugLog(`  ${team1.name} (grupo ${record}) elige a ${opponentForTeam1.name} (no-revancha, evita LPR).`);
        } else {
          // Todos los no-revanchas para team1 fuerzan LPR. Elegir el peor seed de ellos.
          opponentForTeam1 = candidatesForcingLPR[candidatesForcingLPR.length - 1]; // Peor seed de nonRematchCandidates
          debugLog(`  ${team1.name} (grupo ${record}) elige a ${opponentForTeam1.name} (no-revancha, pero fuerza LPR).`);
        }
      } else if (rematchCandidates.length > 0) {
        opponentForTeam1 = rematchCandidates[rematchCandidates.length - 1]; // Peor seed de las revanchas
        debugLog(`  WARN: ${team1.name} (grupo ${record}) solo tiene revanchas. Elige a ${opponentForTeam1.name} (peor seed revancha).`);
      }

      if (opponentForTeam1) {
        team2 = opponentForTeam1;
        const indexInOriginalGroup = availableTeamsInGroup.findIndex(t => t.id === team2!.id);
        if (indexInOriginalGroup !== -1) {
          availableTeamsInGroup.splice(indexInOriginalGroup, 1);
        } else {
          debugLog(`CRITICAL ERROR: Opponent ${team2.name} not found in availableTeamsInGroup for removal.`);
        }
        
        const isAdvancementMatch = (team1.wins || 0) === (MAX_WINS_LOSSES_SWISS - 1);
        const isEliminationMatch = (team1.losses || 0) === (MAX_WINS_LOSSES_SWISS - 1);
        const isBO3 = isAdvancementMatch || isEliminationMatch;

        matches.push({
          team1Id: team1.id,
          team2Id: team2.id,
          winner: null,
          isBO3
        });
        processedTeamIds.add(team1.id);
        processedTeamIds.add(team2.id);
        debugLog(`  Emparejado ${team1.name} vs ${team2.name} (${isBO3 ? 'BO3' : 'BO1'}) en grupo ${record}`);
      } else {
        // team1 no pudo ser emparejado (availableTeamsInGroup estaba vacío después del shift de team1)
        // Esto no debería ocurrir si el while loop es `availableTeamsInGroup.length >= 2` antes del shift.
        // Si ocurre, team1 no se añade a processedTeamIds y será manejado por unpairedTeams.
        debugLog(`  ${team1.name} (grupo ${record}) no pudo ser emparejado. Será considerado con los equipos restantes.`);
      }
    }
  }

  // Manejar equipos que quedaron sin emparejar (de grupos impares o si no se pudo emparejar dentro del grupo)
  let unpairedTeams = activeTeams
    .filter(team => !processedTeamIds.has(team.id))
    .sort((a, b) => compareSeeding(a, b, stage)); // Ordenar globalmente los no emparejados

  if (unpairedTeams.length > 0) {
    debugLog(`Equipos restantes sin emparejar (${unpairedTeams.length}): ${unpairedTeams.map(t => `${t.name}(${t.wins}-${t.losses}, B:${t.buchholzScore})`).join(', ')}`);
    
    while (unpairedTeams.length >= 2) {
      const team1 = unpairedTeams.shift()!;
      let team2: Team | undefined = undefined;
      let originalIndexOfTeam2 = -1; // Relativo a `unpairedTeams` después del shift de team1

      const nonRematchOpponents = unpairedTeams.filter(op => !havePlayedBefore(stage, team1.id, op.id));

      if (nonRematchOpponents.length > 0) {
        const opponentCandidate = nonRematchOpponents[nonRematchOpponents.length - 1];
        originalIndexOfTeam2 = unpairedTeams.indexOf(opponentCandidate);
        if (originalIndexOfTeam2 !== -1) {
            team2 = unpairedTeams.splice(originalIndexOfTeam2, 1)[0];
        } else {
            debugLog(`Error: opponentCandidate ${opponentCandidate?.name} no encontrado en unpairedTeams para ${team1.name}`);
        }
      } else {
        if (unpairedTeams.length > 0) { // Asegurarse de que hay alguien para emparejar
          debugLog(`WARN: ${team1.name} (restantes) debe jugar. Todos los oponentes disponibles son revancha. Emparejando con ${unpairedTeams[unpairedTeams.length - 1].name} (peor seed de restantes).`);
          originalIndexOfTeam2 = unpairedTeams.length - 1;
          team2 = unpairedTeams.splice(originalIndexOfTeam2, 1)[0];
        }
      }

      if (team2) {
        const isAdvancementMatch = (team1.wins || 0) === (MAX_WINS_LOSSES_SWISS - 1) && (team2.wins || 0) === (MAX_WINS_LOSSES_SWISS - 1);
        const isEliminationMatch = (team1.losses || 0) === (MAX_WINS_LOSSES_SWISS - 1) && (team2.losses || 0) === (MAX_WINS_LOSSES_SWISS - 1);
        const isBO3 = isAdvancementMatch || isEliminationMatch;

        matches.push({
          team1Id: team1.id,
          team2Id: team2.id,
          winner: null,
          isBO3
        });
        processedTeamIds.add(team1.id);
        processedTeamIds.add(team2.id);
        debugLog(`  Emparejado ${team1.name} vs ${team2.name} (${isBO3 ? 'BO3' : 'BO1'})`);
      } else {
        // team1 no pudo ser emparejado (p.ej., availableTeamsInGroup se vació antes de encontrar pareja para team1)
        // Esto sucedería si team1 es extraído, y luego availableTeamsInGroup queda con 0 elementos
        // antes de que el bloque 'else' (forzar revancha) pueda ejecutarse.
        // team1 no se añade a processedTeamIds, será manejado por unpairedTeams.
        debugLog(`  ${team1.name} no pudo ser emparejado y será considerado con los equipos restantes.`);
      }
    }
     // Verificar si aún queda un equipo impar después del bucle
    if (unpairedTeams.length === 1) {
        debugLog(`ADVERTENCIA: Un equipo (${unpairedTeams[0].name}) quedó sin emparejar en ${stage.name}, Ronda ${roundIndex + 1}`);
    }
  }

  debugLog(`Generados ${matches.length} partidos para ${stage.name}, Ronda ${roundIndex + 1}`);
  return matches;
} 