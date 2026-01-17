import React from 'react';

interface StageInfo {
  id: string;      // Identificador único de la fase (ej: "phase1", "phase2")
  name: string;    // Nombre legible de la fase (ej: "Fase 1", "Playoffs")
  icon?: React.FC<{ className?: string }>; // Icono opcional
}

interface StageSelectorProps {
  currentStage: string;
  onStageChange: (stageId: string) => void;
  availableStages: StageInfo[]; // Nueva prop para las fases disponibles
}

// Iconos SVG para cada fase (inspirados en Heroicons)
const ChallengerIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.324h5.388a.563.563 0 01.328.958l-3.898 2.599a.563.563 0 00-.186.507l1.407 4.224a.563.563 0 01-.82.61l-4.404-2.64a.563.563 0 00-.656 0l-4.403 2.64a.563.563 0 01-.82-.61l1.407-4.224a.563.563 0 00-.186-.507L3.05 9.892a.563.563 0 01.328-.958h5.388a.562.562 0 00.475-.324L11.48 3.5z" />
  </svg>
);

const LegendsIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const ChampionsIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0012.75 9.75h-1.5A3.375 3.375 0 007.5 13.5v4.5m4.406-9.194a3.375 3.375 0 014.188 0M9.688 9.556a3.375 3.375 0 014.624 0M12 3.375c-3.87 0-7.125 2.036-7.125 4.562c0 .856.345 1.653.906 2.278M12 3.375c3.87 0 7.125 2.036 7.125 4.562c0 .856-.345 1.653-.906 2.278" />
  </svg>
);

const StageSelector: React.FC<StageSelectorProps> = ({ currentStage, onStageChange, availableStages }) => {
  // Usar availableStages en lugar de la lista fija
  // Mapear los iconos basados en una lógica o pasarlos directamente si es necesario
  const stagesToDisplay = availableStages.map(stage => {
    let icon = ChallengerIcon; // Icono por defecto
    if (stage.name.toLowerCase().includes('legends') || stage.name.toLowerCase().includes('fase 2') || stage.name.toLowerCase().includes('fase 3')) {
      icon = LegendsIcon;
    } else if (stage.name.toLowerCase().includes('playoff') || stage.name.toLowerCase().includes('champions') || stage.name.toLowerCase().includes('fase 4')) {
      icon = ChampionsIcon;
    }
    return { ...stage, icon }; 
  });

  return (
    <div className="flex justify-center items-center my-8">
      <div className="bg-neutral-800/50 backdrop-blur-sm p-1.5 rounded-xl shadow-lg flex space-x-1">
        {stagesToDisplay.map((stage) => {
          const isActive = currentStage === stage.id;
          return (
            <button
              key={stage.id}
              onClick={() => onStageChange(stage.id)}
              className={`
                flex items-center justify-center space-x-2
                px-4 py-2.5 rounded-lg 
                text-sm font-medium 
                transition-all duration-300 ease-in-out
                focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-opacity-75
                ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md scale-105'
                    : 'text-neutral-400 hover:bg-neutral-700/60 hover:text-neutral-200'
                }
              `}
            >
              <stage.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'}`} />
              <span>{stage.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StageSelector; 