import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  getMajorData, 
  // getCurrentStage, // No usaremos getCurrentStage directamente, sino que el stage vendrá con getMajorData
  updateMatchResult, 
  changeStage 
} from '../services/tournamentService';
import BuchholzRounds from './BuchholzRounds';
import PlayoffBracket from './PlayoffBracket';
import StageSelector from './StageSelector';
import GridPattern from './GridPattern';
import { Team, Round, MajorData } from '../types/hltvTypes';

interface TournamentPageProps {}

const TournamentPage: React.FC<TournamentPageProps> = () => {
  const { slug } = useParams<{ slug: string }>();
  const [tournamentData, setTournamentData] = useState<MajorData | null>(null);
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);
  // const [view, setView] = useState<'rounds' | 'standings'>('rounds'); // Podríamos reintroducirlo si es necesario

  useEffect(() => {
    if (slug) {
      // No pasar currentStageId aquí directamente, loadTournamentData lo manejará
      loadTournamentData(slug); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]); // Quitar currentStageId de las dependencias si se añade para evitar bucles

  const loadTournamentData = async (tournamentSlug: string, stageToRestore?: string): Promise<void> => { // Acepta stage opcional
    try {
      const majorDetails = await getMajorData(true, tournamentSlug);
      setTournamentData(majorDetails);
      if (stageToRestore && majorDetails && majorDetails.stages[stageToRestore]) { // Priorizar el stage a restaurar
        setCurrentStageId(stageToRestore);
      } else if (majorDetails && majorDetails.currentStage && majorDetails.stages[majorDetails.currentStage]) {
        // Usar majorDetails.currentStage si viene (puede ser la fase activa del torneo no-live)
        setCurrentStageId(majorDetails.currentStage);
      } else if (majorDetails && majorDetails.stages && Object.keys(majorDetails.stages).length > 0) {
        setCurrentStageId(Object.keys(majorDetails.stages)[0]);
      }
    } catch (error) {
      console.error(`Error loading tournament ${tournamentSlug}:`, error);
      setTournamentData(null);
    }
  };

  const handleMatchResult = async (roundIndex: number, matchIndex: number, winnerId: number): Promise<void> => {
    if (!tournamentData || !currentStageId || !slug) return;
    
    const stageIdBeforeUpdate = currentStageId; // Guardar el stage actual

    const updatedTournamentData = await updateMatchResult(roundIndex, matchIndex, winnerId, slug, currentStageId);
    
    // Actualizar el estado local con los datos completos devueltos
    if (updatedTournamentData) {
      setTournamentData(updatedTournamentData);
      // Asegurarse de que el stageId visual no cambie si el avance es dentro de la misma fase
      if (stageIdBeforeUpdate && updatedTournamentData.stages[stageIdBeforeUpdate]) {
        setCurrentStageId(stageIdBeforeUpdate);
      } else {
        // Si la fase cambiara (improbable en playoffs), usar la nueva
        setCurrentStageId(updatedTournamentData.currentStage); 
      }
    }
  };

  const handleStageChange = async (stageId: string): Promise<void> => {
    if (!tournamentData) return;
    setCurrentStageId(stageId);
    // Aquí no llamamos a changeStage del servicio porque eso cambia el currentStage global.
    // Solo cambiamos el stageId local para este componente.
    // Los datos de la nueva etapa ya están en tournamentData.stages[stageId]
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
          onMatchResult={handleMatchResult} // Pasamos el handleMatchResult adaptado
        />
      );
    }

    return (
      <BuchholzRounds 
        stage={currentStageId} // Usamos el ID de la fase actual
        rounds={stageToRender.rounds}
        teams={stageToRender.teams}
        onMatchResult={handleMatchResult} // Pasamos el handleMatchResult adaptado
        onStageChange={handleStageChange} // Pasamos el handleStageChange adaptado
        currentStage={currentStageId} // Para consistencia con BuchholzRoundsProps
      />
    );
    // Podríamos añadir la vista 'standings' aquí si se requiere
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
          <p className="text-sm text-neutral-400">Tipo: {tournamentData.tournamentType} - Reglas Suizas: {tournamentData.swissRulesType}</p>
          <div className="h-1 w-24 bg-gradient-to-r from-primary-500 to-secondary-500 mx-auto mt-2"></div>
        </div>

        {currentStageId && tournamentData.stages[currentStageId] && (
          <div className="pb-8">
            <StageSelector 
              currentStage={currentStageId} 
              onStageChange={handleStageChange} // Pasamos el handleStageChange adaptado
              availableStages={Object.keys(tournamentData.stages).map(stageKey => ({
                id: stageKey, 
                name: tournamentData.stages[stageKey].name,
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

export default TournamentPage; 