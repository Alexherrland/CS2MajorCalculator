import React from 'react';
import { FantasyPhasePickData, FantasyTeamDetail } from '../../types/fantasyTypes';

const UserProfileTeamCard: React.FC<{ team: FantasyTeamDetail; categoryContext?: string }> = ({ team, categoryContext }) => {
  const logoSrc = team.logo && (team.logo.startsWith('http') || team.logo.startsWith('/')) 
                  ? team.logo 
                  : `/team-logos/${team.name.toLowerCase().replace(/\s+/g, '').replace(/[^\w-]/g, '')}.png`; // Sanitize name
  
  const isUnderdogBonus = team.is_bonus_active || false;
  const isImpossible = team.is_role_impossible;

  let isFulfilled = false;
  if (!isImpossible && typeof team.current_wins === 'number' && typeof team.current_losses === 'number') {
    if (categoryContext === 'Equipos 3-0' && team.current_wins === 3 && team.current_losses === 0) {
      isFulfilled = true;
    } else if (categoryContext === 'Equipos 0-3' && team.current_losses === 3 && team.current_wins === 0) {
      isFulfilled = true;
    }
    // Para 'Avanzarán', la lógica de cumplido es más compleja y depende de si la fase terminó.
    // Por ahora, no se marcará en verde a menos que el backend provea un flag explícito o se añada lógica de estado de fase.
  }

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
  } else if (isFulfilled) {
    wlRecordBgClass = 'bg-green-600 bg-opacity-80'; // Verde si está cumplido y no imposible
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
      {team.points_earned !== null && (
        <div className={`text-center bg-blue-700 text-white text-xs font-semibold px-2 py-1 rounded shadow-md z-20 mt-1 w-full`}>
          {team.points_earned} Pts
        </div>
      )}
    </div>
  );
};

interface UserProfileStagePicksDisplayProps {
  pickData: FantasyPhasePickData;
  // TODO: Para mostrar contadores (X/Y) como en la imagen, se necesitarían las reglas de la fase aquí.
  // Ejemplo: stageRules?: { num_teams_3_0: number; num_teams_advance: number; num_teams_0_3: number };
}

const UserProfileStagePicksDisplay: React.FC<UserProfileStagePicksDisplayProps> = ({ pickData /*, stageRules */ }) => {
  const renderTeamPicksList = (teams: FantasyTeamDetail[], categoryTitle: string, expectedCount?: number, centerAlign: boolean = false) => {
    // TODO: Usar expectedCount para el formato (X/Y) cuando stageRules esté disponible.
    // const title = expectedCount ? `${categoryTitle} (${teams.length}/${expectedCount})` : `${categoryTitle} (${teams.length})`;
    const title = `${categoryTitle}:`; // Formato actual: (X):
    
    if (!teams || teams.length === 0) {
      return (
        <div className="mb-6 md:mb-0">
          <h4 className={`text-lg font-semibold text-neutral-100 mb-3 ${centerAlign ? 'text-center' : 'text-left'}`}>{title}</h4>
          <p className={`text-sm text-neutral-500 italic ${centerAlign ? 'text-center' : 'text-left'}`}>Ninguna selección.</p>
        </div>
      );
    }
    return (
      <div className="mb-6 md:mb-0">
        <h4 className={`text-lg font-semibold text-neutral-100 mb-3 ${centerAlign ? 'text-center' : 'text-left'}`}>{title}</h4>
        <div className={`flex flex-wrap gap-4 ${centerAlign || teams.length > 0 ? 'justify-center' : 'justify-start'}`}>
          {teams.map(team => (
            <UserProfileTeamCard key={`${categoryTitle}-${team.id}`} team={team} categoryContext={categoryTitle} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 my-4 w-full max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:space-x-8 mb-8">
        <div className="lg:w-2/5 xl:w-1/3 mb-8 lg:mb-0 "> 
          {renderTeamPicksList(pickData.teams_3_0_details, 'Equipos 3-0'/*, stageRules?.num_teams_3_0*/)}
        </div>
        <div className="lg:w-2/5 xl:w-1/3"> 
          {renderTeamPicksList(pickData.teams_0_3_details, 'Equipos 0-3'/*, stageRules?.num_teams_0_3*/)}
        </div>
      </div>
      
      <div>
        {renderTeamPicksList(pickData.teams_advance_details, 'Avanzarán', undefined, true)}
      </div>
    </div>
  );
};

export default UserProfileStagePicksDisplay; 