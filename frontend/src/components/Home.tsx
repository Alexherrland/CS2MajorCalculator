import React, { useState, useEffect } from 'react';
import { 
  getMajorData, 
  updateMatchResult, 
  changeStage 
} from '../services/tournamentService';
import BuchholzRounds from './BuchholzRounds';
import PlayoffBracket from './PlayoffBracket';
import StageSelector from './StageSelector';
import GridPattern from './GridPattern';
import { Team, Round, MajorData as MajorTournamentData } from '../types/hltvTypes';

const Home: React.FC = () => {
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  const [tournamentData, setTournamentData] = useState<MajorTournamentData | null>(null);

  useEffect(() => {
    loadTournamentData();
  }, []);

  const loadTournamentData = async (stageToRestore?: string): Promise<void> => {
    try {
      const data = await getMajorData();
      setTournamentData(data);
      if (stageToRestore && data && data.stages[stageToRestore]) {
        setCurrentStageId(stageToRestore);
      } else if (data && data.currentStage && data.stages[data.currentStage]) {
        setCurrentStageId(data.currentStage);
      } else if (data && data.stages && Object.keys(data.stages).length > 0) {
        setCurrentStageId(Object.keys(data.stages)[0]);
      }
    } catch (error) {
      console.error("Error loading tournament data for Home:", error);
      setTournamentData(null);
    }
  };

  const handleMatchResult = async (roundIndex: number, matchIndex: number, winnerId: number): Promise<void> => {
    if (!tournamentData || !currentStageId) return;
    
    const stageIdBeforeUpdate = currentStageId;

    const updatedTournamentData = await updateMatchResult(roundIndex, matchIndex, winnerId, null, currentStageId);
    
    // Actualizar el estado local con los datos completos devueltos
    if (updatedTournamentData) {
      setTournamentData(updatedTournamentData);
      // Asegurarse de que el stageId visual no cambie si el avance es dentro de la misma fase
      if (stageIdBeforeUpdate && updatedTournamentData.stages[stageIdBeforeUpdate]) {
        setCurrentStageId(stageIdBeforeUpdate);
      } else {
        setCurrentStageId(updatedTournamentData.currentStage);
      }
    } 
  };

  const handleStageChange = async (stageId: string): Promise<void> => {
    if (!tournamentData) return;
    setCurrentStageId(stageId);
  };

  const renderStageContent = () => {
    if (!tournamentData || !currentStageId || !tournamentData.stages[currentStageId]) {
      return <div className="text-center text-white">Cargando datos de la fase...</div>;
    }
    const stageToRender = tournamentData.stages[currentStageId];

    if (currentStageId === 'phase4' || stageToRender.type === 'PLAYOFF' || stageToRender.name.toLowerCase().includes('playoff')) {
      return (
        <PlayoffBracket 
          teams={stageToRender.teams}
          rounds={stageToRender.rounds}
          onMatchResult={handleMatchResult}
        />
      );
    }

    return (
      <BuchholzRounds 
        stage={currentStageId}
        rounds={stageToRender.rounds}
        teams={stageToRender.teams}
        onMatchResult={handleMatchResult}
        onStageChange={handleStageChange}
        currentStage={currentStageId}
      />
    );
  };

  if (!tournamentData) {
    return <div className="min-h-screen relative isolate bg-black flex items-center justify-center"><p className="text-xl text-white">Cargando torneo...</p></div>;
  }

  return (
    <div className="min-h-screen relative isolate bg-black">
      <GridPattern />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="pt-8 pb-6 flex flex-col items-center text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-secondary-400">
            {tournamentData.name}
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-primary-500 to-secondary-500 mx-auto"></div>
        </div>

        {currentStageId && tournamentData.stages[currentStageId] && (
          <div className="pb-8">
            <StageSelector 
              currentStage={currentStageId} 
              onStageChange={handleStageChange} 
              availableStages={Object.keys(tournamentData.stages).map(stageKey => ({
                id: stageKey, // phase1, phase2, etc.
                name: tournamentData.stages[stageKey].name, // Nombre legible de la fase
                // Icono se asignará dentro de StageSelector o podrías definir una lógica aquí
              }))}
            />
          </div>
        )}

        {currentStageId && tournamentData.stages[currentStageId] && (
          <div className="relative">
            {renderStageContent()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home; 