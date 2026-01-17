import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GridPattern from '../GridPattern';
import { getStageFantasyInfo, submitFantasyPhasePicks } from '../../services/tournamentService';
import { StageFantasyInfo, FantasyPhasePickPayload, FantasyTeamDetail } from '../../types/fantasyTypes';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  UniqueIdentifier
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface TeamCardProps {
  team: FantasyTeamDetail;
  isSelected?: boolean;
  isDragging?: boolean;
  isDragOverlay?: boolean;
  displayBonusOverride?: boolean;
  overrideIsImpossible?: boolean;
  isRoleFulfilled?: boolean;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, isSelected, isDragging, isDragOverlay, displayBonusOverride, overrideIsImpossible, isRoleFulfilled }) => {
  const showBonusUI = displayBonusOverride !== undefined ? displayBonusOverride : (team.is_bonus_active || false);
  
  const applyImpossibleStyle = overrideIsImpossible !== undefined ? overrideIsImpossible : team.is_role_impossible;
  const applyFulfilledStyle = !applyImpossibleStyle && (isRoleFulfilled !== undefined ? isRoleFulfilled : false);

  const borderColorClass = applyImpossibleStyle
    ? 'border-red-500 border-2'
    : showBonusUI
    ? 'border-yellow-400'
    : 'border-neutral-700';

  const style = {
    opacity: isDragging ? 0.5 : 1,
    transform: isDragOverlay ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isDragOverlay ? '0 0 15px rgba(0,0,0,0.5)' : (showBonusUI && !applyImpossibleStyle ? '0 0 12px 2px rgba(250, 176, 5, 0.7)': undefined),
    cursor: isDragOverlay ? 'grabbing' : (applyImpossibleStyle ? 'not-allowed' : 'grab'),
  };

  const logoSrc = team.logo && (team.logo.startsWith('http') || team.logo.startsWith('/')) 
                  ? team.logo 
                  : `/team-logos/${team.name.toLowerCase().replace(/\s+/g, '').replace(/[^\w-]/g, '')}.png`;

  let wlRecordBgClass = 'bg-neutral-600 bg-opacity-70';
  if (applyImpossibleStyle) {
    wlRecordBgClass = 'bg-red-700 bg-opacity-80';
  } else if (applyFulfilledStyle) {
    wlRecordBgClass = 'bg-green-600 bg-opacity-80';
  }
  
  const showRecord = typeof team.current_wins === 'number' && typeof team.current_losses === 'number';

  return (
    <div
      style={style}
      className={`p-2 rounded-lg shadow-md transition-all flex flex-col items-center justify-between relative
                  bg-neutral-800
                  ${borderColorClass}
                  ${isDragOverlay ? 'z-50' : ''}
                  border w-32 h-36`}
      title={applyImpossibleStyle ? `${team.name} (Rol imposible para este slot)` : team.name}
    >
      {showBonusUI && !applyImpossibleStyle && (
        <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-sm shadow-md z-10">
          x1.5 Pts
        </div>
      )}
      <div className="flex-grow flex items-center justify-center w-full h-full p-1 relative">
        <img
          src={logoSrc}
          alt={`${team.name} logo`}
          className="w-24 h-24 object-contain rounded-sm"
          onError={(e) => { (e.target as HTMLImageElement).src = '/team-logos/default.png'; }}
        />
        {showRecord && (
          <div 
            className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 text-white text-[0.65rem] font-semibold px-1.5 py-0.5 rounded shadow-md z-10 whitespace-nowrap ${wlRecordBgClass}`}
          >
            {team.current_wins}W - {team.current_losses}L
          </div>
        )}
      </div>
      <p className="text-sm text-neutral-300 mt-1 text-center">Seed: {team.seed}</p>
    </div>
  );
};

interface DraggableTeamCardProps {
  id: UniqueIdentifier;
  team: FantasyTeamDetail;
  isSelected?: boolean;
  onCardClick?: () => void;
  draggableData: Record<string, any>;
  displayBonusOverride?: boolean;
  overrideIsImpossible?: boolean;
  isRoleFulfilled?: boolean;
}

const DraggableTeamCard: React.FC<DraggableTeamCardProps> = ({ id, team, isSelected, onCardClick, draggableData, displayBonusOverride, overrideIsImpossible, isRoleFulfilled }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: draggableData,
    disabled: overrideIsImpossible,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
    cursor: onCardClick ? 'pointer' : (isDragging ? 'grabbing' : 'grab'),
  };
  
  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (onCardClick && !overrideIsImpossible) {
          e.stopPropagation();
          onCardClick();
        }
      }}
    >
      <TeamCard team={team} isSelected={isSelected} isDragging={isDragging} displayBonusOverride={displayBonusOverride} overrideIsImpossible={overrideIsImpossible} isRoleFulfilled={isRoleFulfilled} />
    </div>
  );
};

interface DroppableSlotProps {
  id: UniqueIdentifier;
  team: FantasyTeamDetail | null;
  fantasyStatus: StageFantasyInfo['fantasy_status'];
  categoryTitle: string;
  onRemoveClick?: () => void;
}

const DroppableSlot: React.FC<DroppableSlotProps> = ({ id: slotId, team, fantasyStatus, categoryTitle, onRemoveClick }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
    data: { type: 'slot', slotId: slotId, category: categoryTitle }, 
  });

  const canDrop = fantasyStatus === 'OPEN';
  const baseClasses = "w-36 h-44 rounded-lg shadow-md flex flex-col justify-center items-center p-1"; 
  const borderStyle = isOver && canDrop ? "border-primary-500 ring-2 ring-primary-400" : "border-neutral-600";
  const bgStyle = canDrop ? "bg-neutral-800/70" : "bg-neutral-700/50";
  const finalDropzoneClass = `${baseClasses} ${bgStyle} border-2 border-dashed ${borderStyle} transition-all`;

  const showBonusInSlot = team ? (team.is_bonus_active && categoryTitle !== 'zone-03') : false;
  
  let isCurrentRoleImpossibleForTeamInSlot = false;
  let isCurrentRoleFulfilledForTeamInSlot = false;

  if (team && typeof team.current_wins === 'number' && typeof team.current_losses === 'number') {
    const wins = team.current_wins;
    const losses = team.current_losses;
    if (categoryTitle === 'zone-30') {
      isCurrentRoleFulfilledForTeamInSlot = wins === 3 && losses === 0;
      isCurrentRoleImpossibleForTeamInSlot = losses > 0 || (wins === 3 && losses === 0);
    } else if (categoryTitle === 'zone-03') {
      isCurrentRoleFulfilledForTeamInSlot = losses === 3 && wins === 0;
      isCurrentRoleImpossibleForTeamInSlot = wins > 0 || (losses === 3 && wins === 0);
    } else if (categoryTitle === 'zone-advance') {
      isCurrentRoleImpossibleForTeamInSlot = losses >= 3;
    }
  }

  return (
    <div ref={canDrop ? setNodeRef : null} className={finalDropzoneClass}>
      {team ? (
        <DraggableTeamCard 
          id={`picked-${slotId}-${team.id}`}
          team={team} 
          isSelected={true} 
          onCardClick={fantasyStatus === 'OPEN' && onRemoveClick ? onRemoveClick : undefined}
          draggableData={{ team: team, type: 'team', origin: 'slot', slotId: slotId, category: categoryTitle }}
          displayBonusOverride={showBonusInSlot}
          overrideIsImpossible={isCurrentRoleImpossibleForTeamInSlot}
          isRoleFulfilled={isCurrentRoleFulfilledForTeamInSlot}
        />
      ) : (
        canDrop ? (
          <p className="text-neutral-500 text-sm text-center">Arrastrar aquí</p> 
        ) : (
          <p className="text-neutral-600 text-sm text-center">Bloqueado</p> 
        )
      )}
    </div>
  );
};

const getTeamIdAtSlot = (
  category: string, 
  index: number, 
  p30: (number | null)[], 
  pA: (number | null)[], 
  p03: (number | null)[]
): number | null => {
  if (category === 'zone-30') return p30[index] !== undefined ? p30[index] : null;
  if (category === 'zone-advance') return pA[index] !== undefined ? pA[index] : null;
  if (category === 'zone-03') return p03[index] !== undefined ? p03[index] : null;
  return null;
};

const placeTeamInSlot = (
  teamId: number | null, 
  category: string, 
  index: number, 
  p30: (number | null)[], 
  pA: (number | null)[], 
  p03: (number | null)[]
) => {
  if (category === 'zone-30' && index < p30.length) p30[index] = teamId;
  else if (category === 'zone-advance' && index < pA.length) pA[index] = teamId;
  else if (category === 'zone-03' && index < p03.length) p03[index] = teamId;
};

const FantasyStagePicks: React.FC = () => {
  const { stageId } = useParams<{ stageId: string }>();
  const [stageInfo, setStageInfo] = useState<StageFantasyInfo | null>(null);
  
  const [pickedTeams30, setPickedTeams30] = useState<(number | null)[]>([]);
  const [pickedTeamsAdvance, setPickedTeamsAdvance] = useState<(number | null)[]>([]);
  const [pickedTeams03, setPickedTeams03] = useState<(number | null)[]>([]);
  
  const [availableTeams, setAvailableTeams] = useState<FantasyTeamDetail[]>([]);
  const [underdogBonusTeamIds, setUnderdogBonusTeamIds] = useState<number[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<FantasyTeamDetail | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const { setNodeRef: setAvailableZoneNodeRef } = useDroppable({ id: 'zone-available', data: {type: 'zone', category: 'available'} });

  useEffect(() => {
    if (stageId) {
      setIsLoading(true);
      getStageFantasyInfo(parseInt(stageId))
        .then(data => {
          setStageInfo(data);
          if (data.underdog_bonus_team_ids) {
            setUnderdogBonusTeamIds(data.underdog_bonus_team_ids);
          }
          let initialAvailable = [...data.teams];
          const pickedIdsInSlots = new Set<number>();

          const num30 = data.rules?.num_teams_3_0 || 0;
          const numAdvance = data.rules?.num_teams_advance || 0;
          const num03 = data.rules?.num_teams_0_3 || 0;

          let initialPicked30 = new Array(num30).fill(null);
          let initialPickedAdvance = new Array(numAdvance).fill(null);
          let initialPicked03 = new Array(num03).fill(null);

          if (data.user_pick) {
            data.user_pick.teams_3_0_details.forEach((team, index) => {
              if (index < num30) {
                initialPicked30[index] = team.id;
                pickedIdsInSlots.add(team.id);
              }
            });
            data.user_pick.teams_advance_details.forEach((team, index) => {
              if (index < numAdvance) {
                initialPickedAdvance[index] = team.id;
                pickedIdsInSlots.add(team.id);
              }
            });
            data.user_pick.teams_0_3_details.forEach((team, index) => {
              if (index < num03) {
                initialPicked03[index] = team.id;
                pickedIdsInSlots.add(team.id);
              }
            });
          }
          setPickedTeams30(initialPicked30);
          setPickedTeamsAdvance(initialPickedAdvance);
          setPickedTeams03(initialPicked03);
          
          initialAvailable = initialAvailable.filter(team => !pickedIdsInSlots.has(team.id));
          setAvailableTeams(initialAvailable.sort((a,b) => a.seed - b.seed));
          setError(null);
        })
        .catch(err => {
          console.error("Error fetching stage fantasy info:", err);
          setError("No se pudo cargar la información de los picks para esta fase. " + (err.response?.data?.error || err.message));
          setStageInfo(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, [stageId]);

  const handleRemoveTeamFromSlot = (slotCategory: string, slotIndex: number) => {
    const currentCategoryPicks = 
      slotCategory === 'zone-30' ? [...pickedTeams30] :
      slotCategory === 'zone-advance' ? [...pickedTeamsAdvance] :
      [...pickedTeams03];
    
    const teamIdToRemove = currentCategoryPicks[slotIndex];
    if (teamIdToRemove === null) return;

    currentCategoryPicks[slotIndex] = null;

    if (slotCategory === 'zone-30') setPickedTeams30(currentCategoryPicks);
    else if (slotCategory === 'zone-advance') setPickedTeamsAdvance(currentCategoryPicks);
    else setPickedTeams03(currentCategoryPicks);

    const teamToAddBack = stageInfo?.teams.find(t => t.id === teamIdToRemove);
    if (teamToAddBack) {
      setAvailableTeams(prev => [...prev, teamToAddBack].sort((a, b) => a.seed - b.seed));
    }
  };

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === 'team' && event.active.data.current?.team) {
      setActiveDragItem(event.active.data.current.team as FantasyTeamDetail);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!active || !over || !active.data.current || !over.data.current) {
        console.warn("DragEnd: active or over data missing.");
        return;
    }

    const activeTeam = active.data.current.team as FantasyTeamDetail | undefined;
    if (!activeTeam) {
        console.warn("DragEnd: activeTeam missing.");
        return;
    }

    const sourceType = active.data.current.type as string;
    const sourceOrigin = active.data.current.origin as 'available' | 'slot' | undefined;
    const sourceSlotId = active.data.current.slotId as string | undefined;
    const sourceCategory = active.data.current.category as string | undefined;

    const targetType = over.data.current.type as string;
    const targetSlotId = over.data.current.slotId as string | undefined;
    const targetCategory = over.data.current.category as string | undefined;

    let newP30 = [...pickedTeams30];
    let newPAdvance = [...pickedTeamsAdvance];
    let newP03 = [...pickedTeams03];
    let newAvailable = [...availableTeams];

    let originalTeamSourceCategory: string | null = null;
    let originalTeamSourceIndex: number | null = null;

    if (sourceOrigin === 'available') {
        newAvailable = newAvailable.filter(t => t.id !== activeTeam.id);
    } else if (sourceOrigin === 'slot' && sourceSlotId && sourceCategory) {
        const sourceSlotIndex = parseInt(sourceSlotId.split('-').pop() || '-1');
        if (sourceSlotIndex !== -1) {
            originalTeamSourceCategory = sourceCategory;
            originalTeamSourceIndex = sourceSlotIndex;
            placeTeamInSlot(null, sourceCategory, sourceSlotIndex, newP30, newPAdvance, newP03);
        } else {
            console.warn("DragEnd: Could not parse sourceSlotIndex from sourceSlotId:", sourceSlotId);
            return;
        }
    } else {
        console.warn("DragEnd: Invalid source origin or missing data", {sourceOrigin, sourceSlotId, sourceCategory});
        return;
    }
    
    if (targetType === 'slot' && targetSlotId && targetCategory) {
        const targetSlotIndex = parseInt(targetSlotId.split('-').pop() || '-1');
        if (targetSlotIndex === -1) {
            console.warn("DragEnd: Could not parse targetSlotIndex from targetSlotId:", targetSlotId);
            if (originalTeamSourceCategory && originalTeamSourceIndex !== null) {
                placeTeamInSlot(activeTeam.id, originalTeamSourceCategory, originalTeamSourceIndex, newP30, newPAdvance, newP03);
            } else if (!newAvailable.find(t => t.id === activeTeam.id)) {
                 newAvailable.push(activeTeam);
            }
        } else {
            const teamIdInTargetSlot = getTeamIdAtSlot(targetCategory, targetSlotIndex, newP30, newPAdvance, newP03);

            placeTeamInSlot(activeTeam.id, targetCategory, targetSlotIndex, newP30, newPAdvance, newP03);

            if (teamIdInTargetSlot && teamIdInTargetSlot !== activeTeam.id) {
                const displacedTeam = stageInfo?.teams.find(t => t.id === teamIdInTargetSlot);
                if (displacedTeam) {
                    if (originalTeamSourceCategory && originalTeamSourceIndex !== null) {
                        placeTeamInSlot(displacedTeam.id, originalTeamSourceCategory, originalTeamSourceIndex, newP30, newPAdvance, newP03);
                    } else {
                        if (!newAvailable.find(t => t.id === displacedTeam.id)) {
                            newAvailable.push(displacedTeam);
                        }
                    }
                }
            }
        }
    } else if (targetType === 'zone' && targetCategory === 'available') {
        if (!newAvailable.find(t => t.id === activeTeam.id)) {
            newAvailable.push(activeTeam);
        }
    } else {
        if (originalTeamSourceCategory && originalTeamSourceIndex !== null) {
            placeTeamInSlot(activeTeam.id, originalTeamSourceCategory, originalTeamSourceIndex, newP30, newPAdvance, newP03);
        } else if (!newAvailable.find(t => t.id === activeTeam.id)) {
            newAvailable.push(activeTeam);
        }
    }

    setPickedTeams30([...newP30]);
    setPickedTeamsAdvance([...newPAdvance]);
    setPickedTeams03([...newP03]);
    setAvailableTeams(newAvailable.sort((a, b) => a.seed - b.seed));
  }

  const handleSubmitPicks = async () => {
    if (!stageId || !stageInfo || stageInfo.fantasy_status !== 'OPEN') return;
    if (!stageInfo.rules) {
        alert("La configuración de las reglas para esta fase no está disponible. No se pueden enviar los picks.");
        setError("Faltan las reglas de la fase para poder guardar.");
        return;
    }
    const finalTeams30 = pickedTeams30.filter(id => id !== null) as number[];
    const finalTeamsAdvance = pickedTeamsAdvance.filter(id => id !== null) as number[];
    const finalTeams03 = pickedTeams03.filter(id => id !== null) as number[];

    if (finalTeams30.length !== stageInfo.rules.num_teams_3_0) {
        alert(`Debes seleccionar exactamente ${stageInfo.rules.num_teams_3_0} equipos para la categoría '3-0'.`);
        return;
    }
    if (finalTeamsAdvance.length !== stageInfo.rules.num_teams_advance) {
        alert(`Debes seleccionar exactamente ${stageInfo.rules.num_teams_advance} equipos para la categoría 'Avanzarán'.`);
        return;
    }
    if (finalTeams03.length !== stageInfo.rules.num_teams_0_3) {
        alert(`Debes seleccionar exactamente ${stageInfo.rules.num_teams_0_3} equipos para la categoría '0-3'.`);
        return;
    }
    const payload: FantasyPhasePickPayload = {
      teams_3_0_ids: finalTeams30,
      teams_advance_ids: finalTeamsAdvance,
      teams_0_3_ids: finalTeams03,
    };
    setSubmitMessage('Enviando picks...');
    setError(null);
    setIsLoading(true);
    try {
      await submitFantasyPhasePicks(parseInt(stageId), payload);
      setSubmitMessage('¡Picks guardados con éxito!');
      const updatedData = await getStageFantasyInfo(parseInt(stageId));
      setStageInfo(updatedData);
      const pickedIds = new Set<number>();
      if (updatedData.user_pick) {
        const s30 = updatedData.user_pick.teams_3_0_details;
        const sAd = updatedData.user_pick.teams_advance_details;
        const s03 = updatedData.user_pick.teams_0_3_details;
        const num30Rule = updatedData.rules?.num_teams_3_0 || 0;
        const newPicks30_res = new Array(num30Rule).fill(null);
        s30.forEach((team, idx) => { if(idx < num30Rule) newPicks30_res[idx] = team.id; pickedIds.add(team.id); });
        setPickedTeams30(newPicks30_res);
        const numAdvanceRule = updatedData.rules?.num_teams_advance || 0;
        const newPicksAdvance_res = new Array(numAdvanceRule).fill(null);
        sAd.forEach((team, idx) => { if(idx < numAdvanceRule) newPicksAdvance_res[idx] = team.id; pickedIds.add(team.id); });
        setPickedTeamsAdvance(newPicksAdvance_res);
        const num03Rule = updatedData.rules?.num_teams_0_3 || 0;
        const newPicks03_res = new Array(num03Rule).fill(null);
        s03.forEach((team, idx) => { if(idx < num03Rule) newPicks03_res[idx] = team.id; pickedIds.add(team.id); });
        setPickedTeams03(newPicks03_res);
      } else {
        setPickedTeams30(new Array(updatedData.rules?.num_teams_3_0 || 0).fill(null));
        setPickedTeamsAdvance(new Array(updatedData.rules?.num_teams_advance || 0).fill(null));
        setPickedTeams03(new Array(updatedData.rules?.num_teams_0_3 || 0).fill(null));
      }
      setAvailableTeams(updatedData.teams.filter(team => !pickedIds.has(team.id)).sort((a,b) => a.seed - b.seed));
      setTimeout(() => setSubmitMessage(null), 3000);
    } catch (err: any) {
      console.error("Error submitting picks:", err);
      setError("Error al guardar los picks: " + (err.response?.data?.error || err.response?.data?.detail || err.message));
      setSubmitMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const commonPageClasses = "min-h-[calc(100vh-4rem)] relative isolate bg-black text-white";
  const commonContainerClasses = "relative z-10 container mx-auto p-4 sm:p-8 pt-8 text-white";

  if (isLoading && !stageInfo) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
        <GridPattern />
        <p className="relative z-10">Cargando información de la fase...</p>
    </div>
  );
  if (error && !stageInfo) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
        <GridPattern />
        <p className="relative z-10 text-red-500">Error: {error}</p>
    </div>
  );
  if (!stageInfo) return (
    <div className={`${commonPageClasses} flex items-center justify-center`}>
        <GridPattern />
        <p className="relative z-10">No se encontró información para esta fase.</p>
    </div>
  );
  
  const getTeamDataForSlot = (teamId: number | null): FantasyTeamDetail | null => {
    if (teamId === null) return null;
    return stageInfo?.teams.find(t => t.id === teamId) || null;
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={commonPageClasses}>
        <GridPattern />
        <div className={commonContainerClasses.replace("p-4 text-white", "p-4")}>
         <h1 className="text-3xl font-bold mb-2">Picks de Fantasy - {stageInfo.name}</h1>
         <p className="mb-1 text-neutral-400">Estado: <span className={`font-semibold ${stageInfo.fantasy_status === 'OPEN' ? 'text-green-400' : 'text-red-400'}`}>{stageInfo.fantasy_status}</span></p>
         {stageInfo.fantasy_status !== 'OPEN' && <p className="mb-4 text-sm text-yellow-400">Las elecciones para esta fase están cerradas.</p>}

         <div className="flex flex-col gap-8 mt-6">
           
           {stageInfo.rules ? (
             <div className="space-y-8"> 
               <div className="flex flex-row justify-between items-start gap-4">
                 <div className="flex-1 min-w-0">
                   <h3 className="text-xl font-semibold mb-3 text-neutral-200 text-center">Equipos 3-0 ({pickedTeams30.filter(t=>t!==null).length}/{stageInfo.rules.num_teams_3_0})</h3>
                   <div className="flex flex-row flex-wrap justify-center gap-3">
                     {pickedTeams30.map((teamId, index) => {
                       const teamData = getTeamDataForSlot(teamId);
                       return (
                         <DroppableSlot 
                             key={`slot-30-${index}`} 
                             id={`slot-30-${index}`} 
                             team={teamData}
                             fantasyStatus={stageInfo.fantasy_status}
                             categoryTitle="zone-30"
                             onRemoveClick={() => handleRemoveTeamFromSlot('zone-30', index)}
                         />
                       );
                     })}
                   </div>
                 </div>

                 <div className="flex-1 min-w-0">
                   <h3 className="text-xl font-semibold mb-3 text-neutral-200 text-center">Equipos 0-3 ({pickedTeams03.filter(t=>t!==null).length}/{stageInfo.rules.num_teams_0_3})</h3>
                   <div className="flex flex-row flex-wrap justify-center gap-3">
                     {pickedTeams03.map((teamId, index) => {
                       const teamData = getTeamDataForSlot(teamId);
                       return (
                         <DroppableSlot 
                             key={`slot-03-${index}`} 
                             id={`slot-03-${index}`} 
                             team={teamData}
                             fantasyStatus={stageInfo.fantasy_status}
                             categoryTitle="zone-03"
                             onRemoveClick={() => handleRemoveTeamFromSlot('zone-03', index)}
                         />
                       );
                     })}
                   </div>
                 </div>
               </div>

               <div>
                 <h3 className="text-xl font-semibold mb-3 text-neutral-200 text-center">Avanzarán ({pickedTeamsAdvance.filter(t=>t!==null).length}/{stageInfo.rules.num_teams_advance})</h3>
                 <div className="flex flex-row flex-wrap justify-center gap-3">
                   {pickedTeamsAdvance.map((teamId, index) => {
                     const teamData = getTeamDataForSlot(teamId);
                     return (
                       <DroppableSlot 
                           key={`slot-advance-${index}`} 
                           id={`slot-advance-${index}`} 
                           team={teamData}
                           fantasyStatus={stageInfo.fantasy_status}
                           categoryTitle="zone-advance"
                           onRemoveClick={() => handleRemoveTeamFromSlot('zone-advance', index)}
                       />
                     );
                   })}
                 </div>
               </div>
             </div>
           ) : (
             <div className="space-y-6 flex items-center justify-center bg-neutral-800/30 p-4 rounded-lg shadow-inner border-2 border-dashed border-neutral-700 min-h-[150px]">
               <p className="text-yellow-400 text-center">
                 La configuración de reglas para esta fase (ej: número de equipos por categoría) no está disponible. <br/>Por favor, contacta a un administrador.
               </p>
             </div>
           )}
           <div 
             id="zone-available" 
             ref={setAvailableZoneNodeRef} 
             className="bg-neutral-900/70 p-4 rounded-lg shadow-xl min-h-[200px] border border-neutral-700"
           >
             <h2 className="text-2xl font-semibold mb-4 text-neutral-100 text-center">Equipos Disponibles</h2>
             {availableTeams.length === 0 && (
                <p className="text-neutral-500 text-center py-4">No hay más equipos disponibles o todos han sido seleccionados.</p>
             )}
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 justify-center">
               {availableTeams
                 .slice() 
                 .sort((a, b) => a.seed - b.seed) 
                 .map(team => (
                   <DraggableTeamCard 
                     key={`available-${team.id}`} 
                     id={`available-${team.id}`} 
                     team={team}
                     draggableData={{ team: team, type: 'team', origin: 'available' }}
                   />
               ))}
             </div>
           </div>
         </div>

         {stageInfo.fantasy_status === 'OPEN' && (
           <div className="mt-8 text-center">
             <button
               onClick={handleSubmitPicks}
               disabled={isLoading}
               className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-colors disabled:opacity-50"
             >
               {isLoading ? 'Guardando...' : 'Guardar Picks'}
             </button>
           </div>
         )}
         {submitMessage && <p className="mt-4 text-center text-green-400">{submitMessage}</p>}
         {error && !submitMessage && <p className="mt-4 text-center text-red-500">{error}</p>}
        </div>
      </div>
      <DragOverlay>
        {activeDragItem ? (
          <TeamCard 
            team={activeDragItem} 
            isDragOverlay 
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default FantasyStagePicks; 