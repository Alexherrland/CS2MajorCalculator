import React from 'react';
import { FantasyPlayoffPickData, FantasyTeamDetail } from '../../types/fantasyTypes';

// Replicando el estilo de TeamCard de FantasyStagePicks.tsx
const UserProfileTeamCard: React.FC<{ team: FantasyTeamDetail; categoryContext?: string }> = ({ team, categoryContext }) => {
  const logoSrc = team.logo && (team.logo.startsWith('http') || team.logo.startsWith('/')) 
                  ? team.logo 
                  : `/team-logos/${team.name.toLowerCase().replace(/\s+/g, '').replace(/[^\w-]/g, '')}.png`; // Sanitize name

  const isUnderdogBonus = team.is_bonus_active || false;
  const isImpossible = team.is_role_impossible; 

  // Para playoffs, la lógica de 'isFulfilled' (verde) es compleja y requiere datos que no tenemos (ej. estado finalizado del torneo/ronda).
  // Por ahora, no se implementará el color verde para W-L en playoffs, solo rojo (imposible) o neutro.
  const isFulfilled = false; // Se mantiene en false para playoffs por ahora.

  const borderColorClass = isImpossible
    ? 'border-red-500 border-2' 
    : isUnderdogBonus
    ? 'border-yellow-400' 
    : 'border-neutral-700';

  const cardStyle = {
    boxShadow: isUnderdogBonus && !isImpossible ? '0 0 12px 2px rgba(250, 176, 5, 0.7)': undefined,
  };

  let wlRecordBgClass = 'bg-neutral-600 bg-opacity-70'; // Gris neutro por defecto
  if (isImpossible) {
    wlRecordBgClass = 'bg-red-700 bg-opacity-80'; // Rojo si es imposible
  }

  const showRecord = typeof team.current_wins === 'number' && typeof team.current_losses === 'number';

  return (
    <div
      style={cardStyle}
      className={`p-2 rounded-lg shadow-md transition-all flex flex-col items-center justify-between relative 
                  bg-neutral-800 
                  ${borderColorClass}
                  border w-32 h-36`}
      title={isImpossible ? `${team.name} (Rol imposible para este pick)` : team.name}
    >
      {isUnderdogBonus && !isImpossible && (
        <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-sm shadow-md z-10">
          x1.5 Pts
        </div>
      )}
      <div className="flex-grow flex items-center justify-center w-full h-full p-1 relative">
        <img
          src={logoSrc}
          alt={`${team.name} logo`}
          className="max-w-[90px] max-h-[90px] object-contain rounded-sm"
          onError={(e) => { 
            (e.target as HTMLImageElement).style.display = 'none';
            const parent = (e.target as HTMLImageElement).parentElement;
            if (parent) {
              const fallbackText = document.createElement('span');
              fallbackText.className = 'text-neutral-500 text-xs px-1 text-center';
              fallbackText.textContent = team.name; 
              parent.appendChild(fallbackText);
            }
          }}
        />
        {showRecord && (
          <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 text-white text-[0.65rem] font-semibold px-1.5 py-0.5 rounded shadow-md z-10 whitespace-nowrap ${wlRecordBgClass}`}>
            {team.current_wins}W - {team.current_losses}L
          </div>
        )}
      </div>
      
      {/* Contenedor para Puntos y Seed, siempre abajo */}
      <div className="w-full mt-1 text-center">
        {team.points_earned !== null && (
          <div className={`bg-blue-700 text-white text-xs font-semibold px-2 py-0.5 rounded shadow-md z-20 mb-0.5`}>
            {team.points_earned} Pts
          </div>
        )}
        <p className="text-xs text-neutral-400">Seed: {team.seed}</p>
      </div>
    </div>
  );
};

interface UserProfilePlayoffPicksDisplayProps {
  pickData: FantasyPlayoffPickData;
  // TODO: Considerar pasar las reglas del torneo (rules.num_quarter_final_winners, etc.) si queremos mostrar (X/Y)
}

const UserProfilePlayoffPicksDisplay: React.FC<UserProfilePlayoffPicksDisplayProps> = ({ pickData }) => {
  const renderTeamPicksList = (teams: FantasyTeamDetail[], categoryTitle: string, expectedCount?: number) => {
    const title = expectedCount ? `${categoryTitle} (${teams.length}/${expectedCount})` : `${categoryTitle} (${teams.length})`;
    
    if (!teams || teams.length === 0) {
      return (
        <div className="mb-8">
          <h4 className="text-lg font-semibold text-neutral-100 mb-3">{title}:</h4>
          <p className="text-sm text-neutral-500 italic">Ninguna selección realizada para esta categoría.</p>
        </div>
      );
    }
    return (
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-neutral-100 mb-3">{title}:</h4>
        <div className="flex flex-wrap gap-4">
          {teams.map(team => (
            // ya no se pasa isBonusContext, el componente lo toma de team.is_bonus_active
            <UserProfileTeamCard key={`${categoryTitle}-${team.id}`} team={team} categoryContext={categoryTitle} />
          ))}
        </div>
      </div>
    );
  };

  // Las reglas no están en pickData. Por ahora, no podemos mostrar el total esperado (Y de X/Y)
  // const rules = pickData.tournament_rules; // Suponiendo que las reglas vienen en pickData

  return (
    <div className="bg-neutral-900/70 p-4 sm:p-6 rounded-lg shadow-xl my-4 border border-neutral-700/60">
      {renderTeamPicksList(pickData.quarter_final_winners_details, 'Ganadores Cuartos de Final')}
      {renderTeamPicksList(pickData.semi_final_winners_details, 'Ganadores Semifinales')}
      {pickData.final_winner_details ? 
        renderTeamPicksList([pickData.final_winner_details], 'Campeón del Torneo') :
        renderTeamPicksList([], 'Campeón del Torneo')}
    </div>
  );
};

export default UserProfilePlayoffPicksDisplay; 