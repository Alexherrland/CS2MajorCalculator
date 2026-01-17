import { Team, Stage } from '../../types/hltvTypes';
import { getCurrentData } from './dataService';
import { debugLog } from './simulationService';

// Simular la finalización de la fase 1 y promocionar equipos a fase 2
export async function simulatePhase1Completion(): Promise<Team[]> {
  try {
    const localMajorData = getCurrentData();
    if (!localMajorData || !localMajorData.stages || !localMajorData.stages.phase1) {
      debugLog('No hay datos para simular la compleción de phase1');
      return [];
    }

    debugLog('Iniciando finalización de Fase 1. Equipos actuales en Fase 1: ' + localMajorData.stages.phase1.teams.length);

    // Filtrar equipos con 3 victorias (clasificados a la siguiente fase)
    const qualifiedTeams = localMajorData.stages.phase1.teams.filter(team => (team.wins || 0) === 3);
    debugLog(`${qualifiedTeams.length} equipos con 3 victorias en Fase 1.`);

    // También se puede implementar otra lógica para determinar los equipos que avanzan
    // por ejemplo, clasificar por récord y luego por Buchholz

    if (qualifiedTeams.length > 0) {
      debugLog('Equipos clasificados inicialmente por victorias (top 8): ' + qualifiedTeams.map(t => t.name).join(', '));

      // Si hay una siguiente fase (phase2), configurarla con los equipos clasificados
      if (localMajorData.stages.phase2) {
        debugLog('Fase 1 completada. Siguiente fase es REGULAR: phase2 (' + localMajorData.stages.phase2.name + ')');
        
        // IMPORTANTE: Preservar los equipos originales de la fase 2
        const originalPhase2Teams = localMajorData.stages.phase2.teams ? 
          localMajorData.stages.phase2.teams.filter(t => !t.isPromoted) : 
          [];
        
        debugLog(`Promoviendo ${qualifiedTeams.length} equipos de Fase 1 a ${localMajorData.stages.phase2.name} (phase2)`);
        
        // Creación de un conjunto para IDs existentes
        const existingTeamIds = new Set(originalPhase2Teams.map(t => t.id));
        
        // Filtrar equipos promovidos para no duplicar con originales
        const newPromotedTeams = qualifiedTeams
          .filter(team => !existingTeamIds.has(team.id))
          .map(team => ({
            ...team,
            wins: 0,
            losses: 0,
            buchholzScore: 0,
            opponents: [],
            isPromoted: true
          }));
        
        // Combinar equipos originales con nuevos promovidos
        localMajorData.stages.phase2.teams = [
          ...originalPhase2Teams,
          ...newPromotedTeams
        ];
        
        debugLog(`Total de ${localMajorData.stages.phase2.teams.length} equipos en ${localMajorData.stages.phase2.name} después de combinar ${originalPhase2Teams.length} iniciales y ${newPromotedTeams.length} clasificados.`);

        return qualifiedTeams; // Retornar equipos clasificados para otras acciones si se necesita
      } else {
        debugLog('La fase phase2 no existe en los datos del torneo.');
      }
    } else {
      debugLog('No hay equipos con suficientes victorias para clasificar de Fase 1.');
    }

    return qualifiedTeams;
  } catch (error) {
    console.error('Error al simular la compleción de phase1:', error);
    return [];
  }
}

// Simular la promoción de equipos de la fase 2 a la fase 3
export async function simulatePhase2Completion(): Promise<Team[]> {
  try {
    const localMajorData = getCurrentData();
    if (!localMajorData || !localMajorData.stages || !localMajorData.stages.phase2) {
      debugLog('No hay datos para simular la compleción de phase2');
      return [];
    }

    debugLog('Iniciando finalización de Fase 2. Equipos actuales: ' + localMajorData.stages.phase2.teams.length);

    // Filtrar equipos con 3 victorias (clasificados a la siguiente fase)
    const qualifiedTeams = localMajorData.stages.phase2.teams.filter(team => (team.wins || 0) === 3);
    debugLog(`${qualifiedTeams.length} equipos con 3 victorias en Fase 2.`);

    // También se puede implementar otra lógica para determinar los equipos que avanzan
    // por ejemplo, clasificar por récord y luego por Buchholz

    if (qualifiedTeams.length > 0) {
      debugLog('Equipos clasificados de Fase 2: ' + qualifiedTeams.map(t => t.name).join(', '));

      // Si hay una siguiente fase (phase3), configurarla con los equipos clasificados
      if (localMajorData.stages.phase3) {
        debugLog('Fase 2 completada. Siguiente fase es REGULAR: phase3 (' + localMajorData.stages.phase3.name + ')');
        
        // IMPORTANTE: Preservar los equipos originales de la fase 3
        const originalPhase3Teams = localMajorData.stages.phase3.teams ? 
          localMajorData.stages.phase3.teams.filter(t => !t.isPromoted) : 
          [];
        
        debugLog(`Promoviendo ${qualifiedTeams.length} equipos de Fase 2 a ${localMajorData.stages.phase3.name} (phase3)`);
        
        // Creación de un conjunto para IDs existentes
        const existingTeamIds = new Set(originalPhase3Teams.map(t => t.id));
        
        // Filtrar equipos promovidos para no duplicar con originales
        const newPromotedTeams = qualifiedTeams
          .filter(team => !existingTeamIds.has(team.id))
          .map(team => ({
            ...team,
            wins: 0,
            losses: 0,
            buchholzScore: 0,
            opponents: [],
            isPromoted: true
          }));
        
        // Combinar equipos originales con nuevos promovidos
        localMajorData.stages.phase3.teams = [
          ...originalPhase3Teams,
          ...newPromotedTeams
        ];
        
        debugLog(`Total de ${localMajorData.stages.phase3.teams.length} equipos en ${localMajorData.stages.phase3.name} después de combinar ${originalPhase3Teams.length} iniciales y ${newPromotedTeams.length} clasificados.`);

        return qualifiedTeams; // Retornar equipos clasificados para otras acciones si se necesita
      } else {
        debugLog('La fase phase3 no existe en los datos del torneo.');
      }
    } else {
      debugLog('No hay equipos con suficientes victorias para clasificar de Fase 2.');
    }

    return qualifiedTeams;
  } catch (error) {
    console.error('Error al simular la compleción de phase2:', error);
    return [];
  }
}

// Simular la promoción de equipos de la fase 3 a la fase 4 (playoffs)
export async function simulatePhase3Completion(): Promise<Team[]> {
  try {
    const localMajorData = getCurrentData();
    if (!localMajorData || !localMajorData.stages || !localMajorData.stages.phase3) {
      debugLog('No hay datos para simular la compleción de phase3');
      return [];
    }

    debugLog('Iniciando finalización de Fase 3. Equipos actuales: ' + localMajorData.stages.phase3.teams.length);

    // Filtrar equipos con 3 victorias (clasificados a playoffs)
    const qualifiedTeams = localMajorData.stages.phase3.teams.filter(team => (team.wins || 0) === 3);
    debugLog(`${qualifiedTeams.length} equipos con 3 victorias en Fase 3.`);

    if (qualifiedTeams.length > 0) {
      debugLog('Equipos clasificados de Fase 3: ' + qualifiedTeams.map(t => t.name).join(', '));

      // Si hay una siguiente fase (phase4/playoffs), configurarla con los equipos clasificados
      if (localMajorData.stages.phase4) {
        debugLog('Fase 3 completada. Siguiente fase es PLAYOFFS: phase4 (' + localMajorData.stages.phase4.name + ')');
        
        // IMPORTANTE: Preservar los equipos originales de la fase de playoffs
        const originalPlayoffTeams = localMajorData.stages.phase4.teams ? 
          localMajorData.stages.phase4.teams.filter(t => !t.isPromoted) : 
          [];
        
        debugLog(`Promoviendo ${qualifiedTeams.length} equipos de Fase 3 a ${localMajorData.stages.phase4.name} (phase4)`);
        
        // Creación de un conjunto para IDs existentes
        const existingTeamIds = new Set(originalPlayoffTeams.map(t => t.id));
        
        // Filtrar equipos promovidos para no duplicar con originales
        const newPromotedTeams = qualifiedTeams
          .filter(team => !existingTeamIds.has(team.id))
          .map(team => ({
            ...team,
            wins: 0,
            losses: 0,
            buchholzScore: 0,
            opponents: [],
            isPromoted: true
          }));
        
        // Combinar equipos originales con nuevos promovidos
        localMajorData.stages.phase4.teams = [
          ...originalPlayoffTeams,
          ...newPromotedTeams
        ];
        
        debugLog(`Total de ${localMajorData.stages.phase4.teams.length} equipos en ${localMajorData.stages.phase4.name} después de combinar ${originalPlayoffTeams.length} iniciales y ${newPromotedTeams.length} clasificados.`);
        
        // Para playoffs, a veces se necesitan exactamente 8 equipos
        if (localMajorData.stages.phase4.type === 'PLAYOFF' && localMajorData.stages.phase4.teams.length < 8) {
          debugLog(`ADVERTENCIA: La fase de playoffs tiene solo ${localMajorData.stages.phase4.teams.length} equipos. Se necesitan 8 para un bracket completo.`);
        }

        return qualifiedTeams; // Retornar equipos clasificados para otras acciones si se necesita
      } else {
        debugLog('La fase phase4 (playoffs) no existe en los datos del torneo.');
      }
    } else {
      debugLog('No hay equipos con suficientes victorias para clasificar de Fase 3 a Playoffs.');
    }

    return qualifiedTeams;
  } catch (error) {
    console.error('Error al simular la compleción de phase3:', error);
    return [];
  }
} 