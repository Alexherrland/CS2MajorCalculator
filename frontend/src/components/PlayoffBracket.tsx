import React, { useRef, useEffect, useState } from 'react';
import { Team, Match, Round } from '../types/hltvTypes';

interface PlayoffBracketProps {
  teams: Team[];
  rounds: Round[]; // Asumimos que rounds[0]=QF, rounds[1]=SF, rounds[2]=Final
  onMatchResult: (roundIndex: number, matchIndex: number, winnerId: number) => void;
}

interface Coords {
  x: number;
  y: number;
}

interface MatchPositions {
  [matchKey: string]: {
    input?: Coords; // Punto de entrada (para rondas > 0)
    output?: Coords; // Punto de salida (para rondas < final)
    element: HTMLDivElement | null;
  };
}

const PlayoffBracket: React.FC<PlayoffBracketProps> = ({ teams, rounds, onMatchResult }) => {
  const getTeamById = (id: number | null | undefined): Team | undefined => {
    if (!id) return undefined;
    return teams.find(team => team.id === id);
  };

  const quarterfinals = rounds[0]?.matches || [];
  const semifinals = rounds[1]?.matches || [];
  const finalMatch = rounds[2]?.matches[0] || null;

  const bracketRef = useRef<HTMLDivElement>(null);
  const matchElementsRef = useRef<MatchPositions>({});
  const [svgLines, setSvgLines] = useState<React.JSX.Element[]>([]);

  // Efecto para calcular y dibujar las líneas SVG
  useEffect(() => {
    if (!bracketRef.current || Object.keys(matchElementsRef.current).length === 0) return;
    const bracketContainerRect = bracketRef.current.getBoundingClientRect();
    const newLines: React.JSX.Element[] = [];

    const getMatchKey = (roundIndex: number, matchIndex: number) => `r${roundIndex}m${matchIndex}`;

    // Calcular puntos de salida y entrada para cada partido visible
    Object.keys(matchElementsRef.current).forEach(key => {
      const matchRef = matchElementsRef.current[key];
      if (matchRef.element) {
        const rect = matchRef.element.getBoundingClientRect();
        // Coordenadas relativas al bracketRef
        const relativeTop = rect.top - bracketContainerRect.top;
        const relativeLeft = rect.left - bracketContainerRect.left;

        matchRef.output = { x: relativeLeft + rect.width, y: relativeTop + rect.height / 2 };
        matchRef.input = { x: relativeLeft, y: relativeTop + rect.height / 2 };
      }
    });
    
    // Conectores QF -> SF (Lado Izquierdo)
    if (semifinals[0]) {
      const sf0Key = getMatchKey(1, 0);
      const sf0Pos = matchElementsRef.current[sf0Key]?.input;
      if (sf0Pos) {
        [0, 1].forEach(qfIndex => { // QF0 y QF1 van a SF0
          const qfKey = getMatchKey(0, qfIndex);
          const qfPos = matchElementsRef.current[qfKey]?.output;
          if (qfPos && sf0Pos) {
            const midX = qfPos.x + (sf0Pos.x - qfPos.x) / 2;
            newLines.push(
              <path
                key={`line-qf${qfIndex}-sf0`}
                d={`M ${qfPos.x} ${qfPos.y} L ${midX} ${qfPos.y} L ${midX} ${sf0Pos.y} L ${sf0Pos.x} ${sf0Pos.y}`}
                stroke="rgba(100, 116, 139, 0.7)"
                strokeWidth="2"
                fill="none"
              />
            );
          }
        });
      }
    }

    // Conectores QF -> SF (Lado Derecho)
    if (semifinals[1]) {
      const sf1Key = getMatchKey(1, 1);
      const sf1Pos = matchElementsRef.current[sf1Key]?.input;
      if (sf1Pos) {
        [2, 3].forEach(qfIndex => { // QF2 y QF3 van a SF1
          const qfKey = getMatchKey(0, qfIndex);
          const qfPos = matchElementsRef.current[qfKey]?.output;
          if (qfPos && sf1Pos) {
            const midX = qfPos.x + (sf1Pos.x - qfPos.x) / 2;
            newLines.push(
              <path
                key={`line-qf${qfIndex}-sf1`}
                d={`M ${qfPos.x} ${qfPos.y} L ${midX} ${qfPos.y} L ${midX} ${sf1Pos.y} L ${sf1Pos.x} ${sf1Pos.y}`}
                stroke="rgba(100, 116, 139, 0.7)"
                strokeWidth="2"
                fill="none"
              />
            );
          }
        });
      }
    }
    
    // Conectores SF -> Final
    if (finalMatch) {
      const finalKey = getMatchKey(2, 0);
      const finalPos = matchElementsRef.current[finalKey]?.input;
      if (finalPos) {
        [0, 1].forEach(sfIndex => { // SF0 y SF1 van a la Final
          const sfKey = getMatchKey(1, sfIndex);
          const sfOutputPos = matchElementsRef.current[sfKey]?.output;
          if (sfOutputPos && finalPos) {
            const midX = sfOutputPos.x + (finalPos.x - sfOutputPos.x) / 2;
            newLines.push(
              <path
                key={`line-sf${sfIndex}-final`}
                d={`M ${sfOutputPos.x} ${sfOutputPos.y} L ${midX} ${sfOutputPos.y} L ${midX} ${finalPos.y} L ${finalPos.x} ${finalPos.y}`}
                stroke="rgba(100, 116, 139, 0.7)"
                strokeWidth="2"
                fill="none"
              />
            );
          }
        });
      }
    }

    setSvgLines(newLines);
  }, [teams, rounds, quarterfinals, semifinals, finalMatch, matchElementsRef.current]);


  const TeamDisplay: React.FC<{ 
    teamId: number | null | undefined, 
    isWinner?: boolean, 
    matchStatus?: Match['status'], 
    onClick?: () => void
  }> = 
    ({ teamId, isWinner, matchStatus, onClick }) => {
    const team = getTeamById(teamId);
    const logoUrl = team ? `/team-logos/${team.name.toLowerCase().replace(/\s+/g, '')}.png` : '/team-logos/default.png';
    const teamName = team ? team.name : 'TBD';

    let teamClasses = 'flex items-center justify-center p-3 h-32 w-full rounded bg-neutral-800 hover:bg-neutral-700 cursor-pointer transition-all group';
    let logoClasses = 'h-16 w-16 object-contain group-hover:scale-105 transition-transform';
    let nameClasses = 'text-base text-neutral-400 mt-2 truncate group-hover:text-neutral-200';

    if (matchStatus === 'FINISHED') {
      teamClasses = onClick ? teamClasses.replace('cursor-pointer', 'cursor-default') : teamClasses;
      if (isWinner) {
        teamClasses = 'flex items-center justify-center p-3 h-32 w-full rounded bg-primary-600 border-2 border-primary-400 cursor-default transition-all group';
        logoClasses = 'h-16 w-16 object-contain scale-105 brightness-110';
        nameClasses = 'text-base text-white mt-2 truncate';
      } else {
        teamClasses = 'flex items-center justify-center p-3 h-32 w-full rounded bg-neutral-800 opacity-60 grayscale cursor-default transition-all group';
        logoClasses = 'h-16 w-16 object-contain';
        nameClasses = 'text-base text-neutral-500 mt-2 truncate';
      }
    } else if (isWinner) { // Ganador simulado
        teamClasses = 'flex items-center justify-center p-3 h-32 w-full rounded bg-primary-700 hover:bg-primary-600 border-2 border-primary-500 cursor-pointer transition-all group';
        logoClasses = 'h-16 w-16 object-contain scale-105 group-hover:scale-110 transition-transform';
        nameClasses = 'text-base text-primary-200 mt-2 truncate group-hover:text-white';
    }
    
    return (
      <div title={teamName} className={teamClasses} onClick={matchStatus !== 'FINISHED' && teamId ? onClick : undefined}>
        <div className="flex flex-col items-center justify-center relative">
          {matchStatus === 'LIVE' && (
            <span className="absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 bg-danger-500 text-white text-[10px] font-bold rounded-full animate-pulse z-20">LIVE</span>
          )}
          <img src={logoUrl} alt={teamName} className={logoClasses} onError={(e) => {(e.target as HTMLImageElement).src = '/team-logos/default.png'}} />
          {team && <span className={nameClasses}>{team.name}</span>}
          {!team && <span className={nameClasses}>TBD</span>}
        </div>
      </div>
    );
  };

  const MatchDisplay: React.FC<{ match: Match | undefined, roundIndex: number, matchIndex: number, className?: string }> = 
  ({ match, roundIndex, matchIndex, className }) => {
    const matchKey = `r${roundIndex}m${matchIndex}`;
    
    const handleTeamClick = (selectedTeamId: number | null | undefined) => {
      if (selectedTeamId && match && match.status !== 'FINISHED') {
        onMatchResult(roundIndex, matchIndex, selectedTeamId);
      }
    };
    
    return (
      <div 
        ref={el => {
          if (el) matchElementsRef.current[matchKey] = { ...matchElementsRef.current[matchKey], element: el };
        }}
        className={`w-48 flex flex-col gap-0.5 bg-neutral-900/70 rounded-md shadow-xl border border-neutral-700/50 overflow-hidden ${className}`}
      >
        <TeamDisplay 
          teamId={match?.team1Id} 
          isWinner={match?.winner === match?.team1Id} 
          matchStatus={match?.status} 
          onClick={() => handleTeamClick(match?.team1Id)}
        />
        <TeamDisplay 
          teamId={match?.team2Id} 
          isWinner={match?.winner === match?.team2Id} 
          matchStatus={match?.status} 
          onClick={() => handleTeamClick(match?.team2Id)}
        />
      </div>
    );
  };
  
  const champion = finalMatch?.winner ? getTeamById(finalMatch.winner) : null;

  return (
    <div ref={bracketRef} className="relative flex justify-center items-start p-4 md:p-8 min-h-[900px] text-white overflow-x-auto select-none">
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        {svgLines}
      </svg>
      
      <div className="relative z-10 flex space-x-6 md:space-x-12 items-stretch">
        {/* Columna Cuartos de Final Izquierda */}
        <div className="flex flex-col justify-around items-center space-y-10 pt-10">
          <h3 className="text-lg font-semibold text-neutral-400 absolute top-0">Cuartos (A)</h3>
          <MatchDisplay match={quarterfinals[0]} roundIndex={0} matchIndex={0} />
          <MatchDisplay match={quarterfinals[1]} roundIndex={0} matchIndex={1} />
        </div>

        {/* Columna Semifinal Izquierda */}
        <div className="flex flex-col justify-center items-center pt-40">
          <h3 className="text-lg font-semibold text-neutral-400 absolute top-32">Semifinal (A)</h3>
          <MatchDisplay match={semifinals[0]} roundIndex={1} matchIndex={0} />
        </div>

        {/* Columna Final */}
        <div className="flex flex-col items-center space-y-4 pt-20 md:pt-48">
          <h3 className="text-xl font-bold text-primary-400 mb-2 absolute top-12 md:top-40">FINAL</h3>
          {finalMatch && <MatchDisplay match={finalMatch} roundIndex={2} matchIndex={0} />}
          <div className="mt-16 text-center p-6 bg-neutral-800 rounded-xl shadow-2xl border-2 border-yellow-400/80 w-64 min-h-[250px] flex flex-col justify-center">
            <h4 className="text-3xl font-bold text-yellow-400 mb-3">CAMPEÓN</h4>
            {champion ? (
              <>
                <img 
                  src={`/team-logos/${champion.name.toLowerCase().replace(/\s+/g, '')}.png`} 
                  alt={champion.name} 
                  className="w-30 h-36 mx-auto my-4 object-contain filter drop-shadow(0 0 10px rgba(250, 204, 21, 0.6))"
                  onError={(e) => {(e.target as HTMLImageElement).src = '/team-logos/default.png'}}
                />
                <p className="text-4xl font-semibold text-white">{champion.name}</p>
              </>
            ) : (
              <p className="text-4xl font-semibold text-neutral-500 h-36 flex items-center justify-center">TBD</p>
            )}
          </div>
        </div>

        {/* Columna Semifinal Derecha */}
        <div className="flex flex-col justify-center items-center pt-40">
          <h3 className="text-lg font-semibold text-neutral-400 absolute top-32">Semifinal (B)</h3>
          <MatchDisplay match={semifinals[1]} roundIndex={1} matchIndex={1} />
        </div>

        {/* Columna Cuartos de Final Derecha */}
        <div className="flex flex-col justify-around items-center space-y-10 pt-10">
          <h3 className="text-lg font-semibold text-neutral-400 absolute top-0">Cuartos (B)</h3>
          <MatchDisplay match={quarterfinals[2]} roundIndex={0} matchIndex={2} />
          <MatchDisplay match={quarterfinals[3]} roundIndex={0} matchIndex={3} />
        </div>
      </div>
    </div>
  );
};

export default PlayoffBracket; 