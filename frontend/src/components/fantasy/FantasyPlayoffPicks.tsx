import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GridPattern from '../GridPattern';
import { /* getUserFantasyPlayoffPicks, */ submitFantasyPlayoffPicks, getTournamentFantasyPlayoffInfo } from '../../services/tournamentService'; // Importar la función real
import { TournamentFantasyPlayoffInfo, FantasyPlayoffPickPayload, FantasyTeamDetail } from '../../types/fantasyTypes'; // FantasyTeamPick no es necesario directamente aquí si Team lo cubre

const FantasyPlayoffPicks: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [playoffInfo, setPlayoffInfo] = useState<TournamentFantasyPlayoffInfo | null>(null);
  const [selectedQFWinners, setSelectedQFWinners] = useState<Set<number>>(new Set());
  const [selectedSFWinners, setSelectedSFWinners] = useState<Set<number>>(new Set());
  const [selectedFinalWinner, setSelectedFinalWinner] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (tournamentId) {
      setIsLoading(true);
      // Usar la función real del servicio
      getTournamentFantasyPlayoffInfo(parseInt(tournamentId))
        .then(data => {
          setPlayoffInfo(data);
          if (data.user_pick) {
            setSelectedQFWinners(new Set(data.user_pick.quarter_final_winners_details.map(t => t.id)));
            setSelectedSFWinners(new Set(data.user_pick.semi_final_winners_details.map(t => t.id)));
            setSelectedFinalWinner(data.user_pick.final_winner_details?.id || null);
          }
          setError(null);
        })
        .catch(err => {
          console.error("Error fetching playoff fantasy info:", err);
          setError("No se pudo cargar la información de los picks para playoffs. " + (err.response?.data?.error || err.message));
          setPlayoffInfo(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, [tournamentId]);

  const handleTeamSelection = (
    teamId: number, 
    category: 'qf' | 'sf' | 'final',
  ) => {
    if (playoffInfo?.fantasy_status !== 'OPEN') return;

    // Verificar is_role_impossible primero
    const teamFullInfo = playoffInfo?.teams.find(t => t.id === teamId);
    if (teamFullInfo?.is_role_impossible) {
      alert("Este equipo ya no puede cumplir el rol necesario.");
      return;
    }

    if (category === 'qf') {
      const newSelection = new Set(selectedQFWinners);
      if (newSelection.has(teamId)) newSelection.delete(teamId);
      else if (newSelection.size < playoffInfo.rules.num_quarter_final_winners) newSelection.add(teamId);
      else alert(`Puedes seleccionar como máximo ${playoffInfo.rules.num_quarter_final_winners} ganadores de Cuartos de Final.`);
      setSelectedQFWinners(newSelection);
      if (!newSelection.has(teamId)) {
        if (selectedSFWinners.has(teamId)) {
            setSelectedSFWinners(prev => { const s = new Set(Array.from(prev)); s.delete(teamId); return s; });
        }
        if (selectedFinalWinner === teamId) {
            setSelectedFinalWinner(null);
        }
      }
    } else if (category === 'sf') {
      if (!selectedQFWinners.has(teamId)) {
        alert("Este equipo primero debe ser seleccionado como ganador de Cuartos de Final.");
        return;
      }
      const newSelection = new Set(selectedSFWinners);
      if (newSelection.has(teamId)) newSelection.delete(teamId);
      else if (newSelection.size < playoffInfo.rules.num_semi_final_winners) newSelection.add(teamId);
      else alert(`Puedes seleccionar como máximo ${playoffInfo.rules.num_semi_final_winners} ganadores de Semifinales.`);
      setSelectedSFWinners(newSelection);
      if (!newSelection.has(teamId) && selectedFinalWinner === teamId) {
        setSelectedFinalWinner(null);
      }
    } else if (category === 'final') {
      if (!selectedSFWinners.has(teamId)) {
        alert("Este equipo primero debe ser seleccionado como ganador de Semifinales.");
        return;
      }
      setSelectedFinalWinner(prev => prev === teamId ? null : teamId);
    }
  };

  const handleSubmitPicks = async () => {
    if (!tournamentId || !playoffInfo || playoffInfo.fantasy_status !== 'OPEN') return;

    if (selectedQFWinners.size !== playoffInfo.rules.num_quarter_final_winners) {
        alert(`Debes seleccionar ${playoffInfo.rules.num_quarter_final_winners} ganadores de Cuartos.`);
        return;
    }
    if (selectedSFWinners.size !== playoffInfo.rules.num_semi_final_winners) {
        alert(`Debes seleccionar ${playoffInfo.rules.num_semi_final_winners} ganadores de Semifinales.`);
        return;
    }
    if (!selectedFinalWinner && playoffInfo.rules.num_final_winner === 1) {
        alert(`Debes seleccionar un Campeón.`);
        return;
    }
    for (const sfWinnerId of Array.from(selectedSFWinners)) { // Corregido aquí
        if (!selectedQFWinners.has(sfWinnerId)) {
            alert("Todos los ganadores de Semifinales deben estar entre los ganadores de Cuartos de Final seleccionados.");
            return;
        }
    }
    if (selectedFinalWinner && !selectedSFWinners.has(selectedFinalWinner)) {
        alert("El Campeón debe estar entre los ganadores de Semifinales seleccionados.");
        return;
    }

    const payload: FantasyPlayoffPickPayload = {
      quarter_final_winners_ids: Array.from(selectedQFWinners),
      semi_final_winners_ids: Array.from(selectedSFWinners),
      final_winner_id: selectedFinalWinner,
    };

    setSubmitMessage('Enviando picks de playoffs...');
    setError(null);
    setIsLoading(true);

    try {
      const result = await submitFantasyPlayoffPicks(parseInt(tournamentId), payload);
      setSubmitMessage('¡Picks de Playoffs guardados con éxito!');
      // Actualizar la información de playoffs después de enviar, incluyendo el user_pick
      const updatedData = await getTournamentFantasyPlayoffInfo(parseInt(tournamentId)); 
      setPlayoffInfo(updatedData);
      // Re-aplicar selecciones desde updatedData.user_pick para asegurar consistencia visual
      if (updatedData.user_pick) {
            setSelectedQFWinners(new Set(updatedData.user_pick.quarter_final_winners_details.map(t => t.id)));
            setSelectedSFWinners(new Set(updatedData.user_pick.semi_final_winners_details.map(t => t.id)));
            setSelectedFinalWinner(updatedData.user_pick.final_winner_details?.id || null);
      }
      setTimeout(() => setSubmitMessage(null), 3000);
    } catch (err: any) {
      console.error("Error submitting playoff picks:", err);
      setError("Error al guardar los picks de playoffs: " + (err.response?.data?.error || err.response?.data?.detail || err.message));
      setSubmitMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const commonPageClasses = "min-h-[calc(100vh-4rem)] relative isolate bg-black text-white";
  const commonContainerClasses = "relative z-10 container mx-auto p-4 sm:p-8 pt-8 text-white";

  if (isLoading && !playoffInfo) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
      <GridPattern />
      <p className="relative z-10">Cargando información de playoffs...</p>
    </div>
  );
  if (error && !playoffInfo) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
      <GridPattern />
      <p className="relative z-10 text-red-500">Error: {error}</p>
    </div>
  );
  if (!playoffInfo) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
      <GridPattern />
      <p className="relative z-10">No se encontró información de playoffs para este torneo.</p>
    </div>
  );

  // La lista de equipos playoffInfo.teams es ahora FantasyTeamDetail[]
  // Actualizar la firma de renderTeamCard y su lógica interna
  const renderTeamCard = (team: FantasyTeamDetail, category: 'qf' | 'sf' | 'final', isSelected: boolean, onSelect: () => void) => {
    const isFantasyOpen = playoffInfo.fantasy_status === 'OPEN';
    let isCurrentlySelectable = true;
    let cantSelectReason = "";
    let titleText = team.name;

    if (category === 'sf' && !selectedQFWinners.has(team.id)) {
        isCurrentlySelectable = false;
        cantSelectReason = "Elige primero en QF";
    }
    if (category === 'final' && !selectedSFWinners.has(team.id)) {
        isCurrentlySelectable = false;
        cantSelectReason = "Elige primero en SF";
    }

    let cardOuterClasses = "p-3 rounded-lg shadow-md transition-all transform hover:scale-105 border relative"; // Añadido relative para el tag de bonus
    let teamNameClasses = "font-semibold";
    let finalOnClick = (isFantasyOpen && isCurrentlySelectable && !team.is_role_impossible) ? onSelect : undefined;
    
    const isBonusActive = team.is_bonus_active || false;

    if (team.is_role_impossible) {
        cardOuterClasses += " bg-neutral-700 opacity-50 cursor-not-allowed border-red-500 border-2";
        teamNameClasses += " text-neutral-400"; // Atenuar nombre
        titleText = `${team.name} (Rol imposible)`;
        cantSelectReason = "Rol imposible de cumplir"; // Sobrescribir razón
    } else if (!isFantasyOpen || !isCurrentlySelectable) {
        cardOuterClasses += " bg-neutral-700 opacity-60 cursor-not-allowed border-neutral-700";
        teamNameClasses += isSelected ? " text-primary-300 opacity-70" : " text-white opacity-70";
        // cantSelectReason ya está seteado
    } else { // Seleccionable, fantasy abierto y no imposible
        cardOuterClasses += " bg-neutral-800 hover:bg-neutral-700 cursor-pointer";
        if (isSelected) {
            cardOuterClasses += " ring-2 ring-primary-500 border-primary-400";
            teamNameClasses += " text-primary-300";
        } else if (isBonusActive) {
            cardOuterClasses += " border-yellow-400"; // Similar a otros team cards
            teamNameClasses += " text-white";
            // Podríamos añadir boxShadow aquí también si queremos consistencia:
            // style={{ boxShadow: '0 0 10px rgba(250, 176, 5, 0.6)' }} en el div, o una clase
        } else {
            cardOuterClasses += " border-neutral-700";
            teamNameClasses += " text-white";
        }
    }

    const logoSrc = team.logo || '/team-logos/default.png';

    return (
      <div 
        key={team.id}
        onClick={finalOnClick}
        title={titleText}
        className={cardOuterClasses}
        style={ (isBonusActive && !team.is_role_impossible && !isSelected && isFantasyOpen && isCurrentlySelectable) ? { boxShadow: '0 0 10px 1px rgba(250, 176, 5, 0.5)' } : {}}
      >
        {isBonusActive && !team.is_role_impossible && (!isFantasyOpen || isCurrentlySelectable) && (
           <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-sm shadow-md z-10">
             x1.5 Pts
           </div>
        )}
        <div className="flex items-center space-x-3">
          <img 
            src={logoSrc} 
            alt={team.name} 
            className="w-10 h-10 object-contain rounded-sm bg-neutral-900 p-0.5"
            onError={(e) => {(e.target as HTMLImageElement).src = '/team-logos/default.png'}}
          />
          <div>
            <p className={teamNameClasses}>{team.name}</p>
            <p className="text-xs text-neutral-400">Seed: {team.seed}</p>
            {/* Mostrar current_wins y current_losses si existen y son relevantes para playoffs (probablemente no) */}
            {/* {team.current_wins !== undefined && <p className="text-xs text-neutral-500">W: {team.current_wins} L: {team.current_losses}</p>} */}
            {cantSelectReason && <p className="text-xs text-yellow-500 mt-0.5">{cantSelectReason}</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={commonPageClasses}>
      <GridPattern />
      <div className={commonContainerClasses.replace("p-4 text-white", "p-4")}>
        <h1 className="text-3xl font-bold mb-2">Picks de Playoffs - {playoffInfo.tournament_name}</h1>
        <p className="mb-1 text-neutral-400">Estado: <span className={`font-semibold ${playoffInfo.fantasy_status === 'OPEN' ? 'text-green-400' : 'text-red-400'}`}>{playoffInfo.fantasy_status}</span></p>
        {playoffInfo.fantasy_status !== 'OPEN' && <p className="mb-4 text-sm text-yellow-400">Las elecciones para playoffs están cerradas.</p>}

        <div className="space-y-8 mt-6">
          <div>
            <h2 className="text-2xl font-semibold mb-3">Ganadores Cuartos de Final <span className="text-base text-neutral-400 font-normal">(Elige {playoffInfo.rules.num_quarter_final_winners})</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {playoffInfo.teams.map(team => renderTeamCard(team, 'qf', selectedQFWinners.has(team.id), () => handleTeamSelection(team.id, 'qf')))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">Ganadores Semifinales <span className="text-base text-neutral-400 font-normal">(Elige {playoffInfo.rules.num_semi_final_winners})</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {playoffInfo.teams.filter(t => selectedQFWinners.has(t.id)).map(team => renderTeamCard(team, 'sf', selectedSFWinners.has(team.id), () => handleTeamSelection(team.id, 'sf')))}
              {playoffInfo.teams.filter(t => !selectedQFWinners.has(t.id)).map(team => renderTeamCard(team, 'sf', false, () => {})) /* Show disabled cards */}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-3">Campeón del Torneo <span className="text-base text-neutral-400 font-normal">(Elige {playoffInfo.rules.num_final_winner})</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {playoffInfo.teams.filter(t => selectedSFWinners.has(t.id)).map(team => renderTeamCard(team, 'final', selectedFinalWinner === team.id, () => handleTeamSelection(team.id, 'final')))}
              {playoffInfo.teams.filter(t => !selectedSFWinners.has(t.id)).map(team => renderTeamCard(team, 'final', false, () => {})) /* Show disabled cards */}
            </div>
          </div>
        </div>

        {playoffInfo.fantasy_status === 'OPEN' && (
          <div className="mt-8 text-center">
            <button 
              onClick={handleSubmitPicks}
              disabled={isLoading}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Guardando...' : 'Guardar Picks de Playoffs'}
            </button>
          </div>
        )}
        {submitMessage && <p className="mt-4 text-center text-green-400">{submitMessage}</p>}
        {error && !submitMessage && <p className="mt-4 text-center text-red-500">{error}</p>} 
      </div>
    </div>
  );
};

export default FantasyPlayoffPicks; 