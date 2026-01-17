import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUserProfile, getLocalMajorData, getMajorData } from '../../services/tournamentService'; // Importar getLocalMajorData o getMajorData
import { TwitchUserProfile } from '../../types/fantasyTypes';
import GridPattern from '../GridPattern'; // Import GridPattern
import { MajorData, Stage } from '../../types/hltvTypes'; // Importar MajorData y Stage

// Iconos SVG en línea
const ShieldCheckIconSVG = ({ className = "w-10 h-10" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const ListBulletIconSVG = ({ className = "w-10 h-10" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

const UserCircleIconSVG = ({ className = "w-10 h-10" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ArrowRightCircleIconSVG = ({ className = "w-10 h-10" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l3-3m0 0l-3-3m3 3h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BookOpenIconSVG = ({ className = "w-10 h-10" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const FantasyDashboard: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<TwitchUserProfile | null>(null);
  const [majorData, setMajorData] = useState<MajorData | null>(null);
  const [activeSwissStageId, setActiveSwissStageId] = useState<number | null>(null);
  const [activeTournamentIdForPlayoffs, setActiveTournamentIdForPlayoffs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const user = await getCurrentUserProfile();
        setCurrentUser(user);

        let tournamentData = getLocalMajorData(); 
        if (!tournamentData) {
          tournamentData = await getMajorData(false, null); 
        }
        setMajorData(tournamentData);

        if (tournamentData && tournamentData.stages) {
          const allStagesArray: (Stage & { id: number; type: string; fantasyStatus: string; order?: number; tournament?: number | { id: number } })[] = Object.values(tournamentData.stages);
          
          // Encontrar la primera fase suiza (SWISS) abierta
          const swissStages = allStagesArray.filter(
            stage => typeof stage.id === 'number' && stage.type === 'SWISS'
          );
          
          const openSwissStage = swissStages.sort((a,b) => (a.order || 0) - (b.order || 0)).find(
            stage => stage.fantasyStatus === 'OPEN'
          );
          setActiveSwissStageId(openSwissStage ? openSwissStage.id : null);
          
          // Encontrar el ID del torneo para los playoffs basado en la stage con order: 4
          let foundPlayoffTournamentId: number | null = null;
          const playoffStage = allStagesArray.find(stage => stage.order === 4);

          if (playoffStage) {
            if (typeof playoffStage.tournament === 'number') {
              foundPlayoffTournamentId = playoffStage.tournament;
            } else if (playoffStage.tournament && typeof playoffStage.tournament.id === 'number') {
              foundPlayoffTournamentId = playoffStage.tournament.id;
            } else {
              console.warn('Playoff stage (order: 4) encontrada, pero su ID de torneo falta o tiene un formato inesperado.', playoffStage);
            }
          } else {
            console.log('No se encontró ninguna fase con order: 4 (playoffs) en los datos del major actual.');
          }
          setActiveTournamentIdForPlayoffs(foundPlayoffTournamentId);
        }
      } catch (err) {
        console.error("Error fetching data for dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const cardLinkClassName = "block p-6 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-xl";
  const cardTitleClassName = "text-xl font-semibold text-white mb-2";
  const cardDescriptionClassName = "text-neutral-200 text-sm";
  const iconClassName = "w-10 h-10 text-primary-400 mb-3";

  // Estilos para fondos de tarjetas (ejemplos)
  const cardBackgrounds = {
    picksFaseGrupos: "bg-gradient-to-br from-blue-500 to-blue-700",
    picksPlayoffs: "bg-gradient-to-br from-purple-500 to-purple-700",
    leaderboard: "bg-gradient-to-br from-green-500 to-green-700",
    miPerfil: "bg-gradient-to-br from-yellow-500 to-yellow-700",
    comoJugar: "bg-neutral-800" // Fondo para la sección de reglas
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] relative isolate bg-black flex items-center justify-center text-white">
        <GridPattern />
        <p className="relative z-10">Cargando Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] relative isolate bg-black text-white"> 
      <GridPattern />
      <div className="relative z-10 max-w-5xl mx-auto p-4 sm:p-8 pt-8">
        {/* Sección de Bienvenida Rediseñada */}
        {currentUser && (
          <section className="mb-12 p-8 bg-gradient-to-r from-primary-500 to-secondary-600 rounded-xl shadow-xl text-white transition-all duration-500 ease-in-out hover:shadow-2xl">
            <div className="flex flex-col sm:flex-row items-center justify-between">
              <div className="mb-4 sm:mb-0">
                <h2 className="text-3xl font-bold">
                  ¡Hola, <span className="font-extrabold">{currentUser.twitch_username || currentUser.user.username}</span>!
                </h2>
                <p className="text-lg text-primary-200">Listo para dominar el Fantasy del Major?</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-sm uppercase text-primary-300 tracking-wider">Tus Puntos Fantasy</p>
                <p className="text-5xl font-bold text-white tabular-nums">
                  {currentUser.total_fantasy_points}
                </p>
              </div>
            </div>
          </section>
        )}
        {/* Acciones de Fantasy*/}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Card para Picks de Fase */}
          {activeSwissStageId ? (
            <Link to={`/fantasy/stage/${activeSwissStageId}/picks`} className={`${cardLinkClassName} ${cardBackgrounds.picksFaseGrupos}`}>
              <ArrowRightCircleIconSVG className={iconClassName} />
              <h3 className={cardTitleClassName}>Picks de Grupos</h3>
              <p className={cardDescriptionClassName}>
                Predice los equipos 3-0, 0-3 y los que avanzan en la fase {' '}
                {majorData?.stages?.[`phase${activeSwissStageId}`]?.name || 'actual'}.
              </p>
            </Link>
          ) : (
            <div className={`${cardLinkClassName} ${cardBackgrounds.picksFaseGrupos} opacity-70 cursor-not-allowed`}>
              <ArrowRightCircleIconSVG className={`${iconClassName} opacity-50`} />
              <h3 className={cardTitleClassName}>Picks de Grupos</h3>
              <p className={cardDescriptionClassName}>
                Fase de grupos no abierta para picks.
              </p>
            </div>
          )}

          {/* Card para Picks de Playoffs */}
          {activeTournamentIdForPlayoffs ? ( 
            <Link to={`/fantasy/tournament/${activeTournamentIdForPlayoffs}/playoffs/picks`} className={`${cardLinkClassName} ${cardBackgrounds.picksPlayoffs}`}>
              <ShieldCheckIconSVG className={iconClassName} />
              <h3 className={cardTitleClassName}>Picks de Playoffs</h3>
              <p className={cardDescriptionClassName}>
                Define tu bracket: Cuartos, Semis y Campeón del Major {majorData?.name ? `(${majorData.name})` : ''}.
              </p>
            </Link>
          ) : (
             <div className={`${cardLinkClassName} ${cardBackgrounds.picksPlayoffs} opacity-70 cursor-not-allowed`}>
              <ShieldCheckIconSVG className={`${iconClassName} opacity-50`} />
              <h3 className={cardTitleClassName}>Picks de Playoffs</h3>
              <p className={cardDescriptionClassName}>
                Picks de Playoffs no disponibles.
              </p>
            </div>
          )}
          
          {/* Card para Leaderboard */}
          <Link to="/fantasy/leaderboard" className={`${cardLinkClassName} ${cardBackgrounds.leaderboard}`}>
            <ListBulletIconSVG className={iconClassName} />
            <h3 className={cardTitleClassName}>Leaderboard</h3>
            <p className={cardDescriptionClassName}>
              Consulta la tabla de posiciones y sigue la competencia.
            </p>
          </Link>

          {/* Card para Mi Perfil Fantasy */}
          {currentUser ? (
            <Link to={`/fantasy/profile/${currentUser.user.username}`} className={`${cardLinkClassName} ${cardBackgrounds.miPerfil}`}>
              <UserCircleIconSVG className={iconClassName} />
              <h3 className={cardTitleClassName}>Mi Perfil Fantasy</h3>
              <p className={cardDescriptionClassName}>
                Revisa tu historial de picks y puntos.
              </p>
            </Link>
          ) : (
             <div 
                // onClick={() => { /* Podríamos llamar a twitchLogin() aquí */ }} 
                className={`${cardLinkClassName} ${cardBackgrounds.miPerfil} opacity-80 hover:opacity-100`}
             >
              <UserCircleIconSVG className={iconClassName} />
              <h3 className={cardTitleClassName}>Mi Perfil Fantasy</h3>
              <p className={cardDescriptionClassName}>
                Inicia sesión para ver tu perfil. (Login en Navbar)
              </p>
            </div>
          )}
        </section>

        {/* Sección de Reglas Remodelada */}
        <section className={`mb-12 p-6 ${cardBackgrounds.comoJugar} rounded-xl shadow-lg`}>
          <div className="flex items-center mb-6">
            <BookOpenIconSVG className="w-8 h-8 text-primary-400 mr-3 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white">¿Cómo Jugar al Fantasy? Guía Rápida</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-primary-300 mb-3">Fase de Grupos (Sistema Suizo)</h3>
              <p className="text-neutral-300 mb-2">Tu misión es predecir el rendimiento de los equipos:</p>
              <ul className="list-none space-y-3">
                <li className="flex items-start p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700 transition-colors">
                  <span className="text-green-400 font-bold mr-2 text-lg">●</span> 
                  <div>
                    <strong>Equipos 3-0:</strong> Acierta qué equipos pasarán invictos.
                    <span className="block text-xs text-neutral-400 italic">Puntos: Alto valor por predicción correcta. Bonificación por "underdogs".</span>
                  </div>
                </li>
                <li className="flex items-start p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700 transition-colors">
                  <span className="text-red-400 font-bold mr-2 text-lg">●</span>
                  <div>
                    <strong>Equipos 0-3:</strong> Identifica los equipos que no ganarán ningún partido.
                    <span className="block text-xs text-neutral-400 italic">Puntos: Valor considerable. También puede haber bonificación.</span>
                  </div>
                </li>
                <li className="flex items-start p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700 transition-colors">
                  <span className="text-blue-400 font-bold mr-2 text-lg">●</span>
                  <div>
                    <strong>Equipos que Avanzan:</strong> Elige el resto de equipos que clasificarán.
                    <span className="block text-xs text-neutral-400 italic">Puntos: Moderado por cada acierto. La clave está en el volumen de aciertos.</span>
                  </div>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-primary-300 mb-3">Fase de Playoffs (Eliminatoria Directa)</h3>
              <p className="text-neutral-300 mb-2">Aquí construyes tu bracket hacia la gloria:</p>
              <ul className="list-none space-y-3">
                <li className="flex items-start p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700 transition-colors">
                  <span className="text-yellow-400 font-bold mr-2 text-lg">●</span>
                  <div>
                    <strong>Cuartos de Final:</strong> Predice los 4 ganadores.
                     <span className="block text-xs text-neutral-400 italic">Puntos: Significativos por cada equipo correcto.</span>
                  </div>
                </li>
                <li className="flex items-start p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700 transition-colors">
                  <span className="text-orange-400 font-bold mr-2 text-lg">●</span>
                  <div>
                    <strong>Semifinales:</strong> Acierta los 2 equipos que llegarán a la final.
                    <span className="block text-xs text-neutral-400 italic">Puntos: Muy valiosos. Un paso crucial.</span>
                  </div>
                </li>
                <li className="flex items-start p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700 transition-colors">
                  <span className="text-purple-400 font-bold mr-2 text-lg">●</span>
                  <div>
                    <strong>Campeón del Major:</strong> ¡La predicción más importante!
                    <span className="block text-xs text-neutral-400 italic">Puntos: La mayor cantidad. Define al ganador del Fantasy.</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-700">
            <h3 className="text-lg font-semibold text-primary-200 mb-2">Puntos Clave:</h3>
            <ul className="list-disc list-inside text-neutral-300 space-y-1 text-sm">
              <li>Las selecciones se bloquean al inicio de cada fase</li>
              <li>Los puntos se actualizan tras finalizar los partidos/fases correspondientes.</li>
            </ul>
          </div>
        </section>
        
      </div>
    </div>
  );
};

export default FantasyDashboard; 