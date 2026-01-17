import axios from 'axios';
import { MajorData, StageData, Team, TournamentInfo } from '../types/hltvTypes';
import {
  TwitchUserProfile,
  StageFantasyInfo,
  FantasyPhasePickPayload,
  FantasyPhasePickData,
  FantasyPlayoffPickPayload,
  FantasyPlayoffPickData,
  PaginatedLeaderboardResponse,
  UserFantasyProfileData,
  TournamentFantasyPlayoffInfo
} from '../types/fantasyTypes';
import { 
  fetchMajorData, 
  getCurrentStageData, 
  changeStageSelection, 
  updateMatchWinner,
  getCurrentData,
  getStageTeams as getTeamsForStage
} from './tournament/dataService';
import { DEBUG_MODE } from './tournament/simulationService';

// Configuración de axios para depurar problemas
axios.interceptors.request.use(request => {
  console.log('Request:', request.url);
  return request;
});

axios.interceptors.response.use(
  response => {
    console.log('Response:', response.status, response.data);
    return response;
  },
  error => {
    console.error('API Error:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Función para obtener el valor de una cookie por su nombre
function getCookie(name: string): string | null {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // ¿Comienza esta cadena de cookies con el nombre que queremos?
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api/v1'
});

// Obtener el token CSRF de las cookies (Django usa 'csrftoken' por defecto)
const csrftoken = getCookie('csrftoken');

if (csrftoken) {
  apiClient.defaults.headers.common['X-CSRFToken'] = csrftoken;
} else {
  // Es útil advertir si el token no se encuentra, pero no bloquees la app por ello aquí.
  // El backend rechazará las solicitudes si es necesario.
  console.warn('CSRF token not found. POST/PUT/DELETE requests might fail if CSRF protection is active on the server.');
}

// API central para manejar datos del torneo
export const getMajorData = async (forceRefresh = false, slug: string | null = null): Promise<MajorData> => {
  return fetchMajorData(forceRefresh, slug);
};

// Obtener la etapa actual
export const getCurrentStage = async (): Promise<StageData> => {
  return getCurrentStageData();
};

// Cambiar a otra etapa
export const changeStage = async (stageId: string): Promise<StageData> => {
  return changeStageSelection(stageId);
};

// Obtener la data actual (no es una función async, accede a la data ya cargada)
export const getLocalMajorData = (): MajorData | null => {
  return getCurrentData();
};

// Actualizar resultado de un partido
export const updateMatchResult = async (
  roundIndex: number, 
  matchIndex: number, 
  winnerId: number,
  tournamentSlug: string | null = null,
  currentStageId: string | null = null
): Promise<MajorData | null> => {
  return updateMatchWinner(roundIndex, matchIndex, winnerId, tournamentSlug, currentStageId);
};

// Obtener equipos de una etapa específica
export const getStageTeams = async (stageId: string): Promise<Team[]> => {
  return getTeamsForStage(stageId);
};

// Obtener la lista de todos los torneos
export const getAllTournaments = async (): Promise<TournamentInfo[]> => {
  try {
    const response = await apiClient.get<TournamentInfo[]>('/tournaments/');
    return response.data;
  } catch (error) {
    console.error('Error fetching all tournaments:', error);
    return [];
  }
};

// --- Autenticación y Perfil de Usuario ---
export const getCurrentUserProfile = async (): Promise<TwitchUserProfile | null> => {
  try {
    const response = await apiClient.get<TwitchUserProfile>('/me/', { withCredentials: true });
    return response.data;
  } catch (error) {
    console.warn('Error fetching current user profile:', error);
    return null;
  }
};

export const twitchLogin = () => {
  window.location.href = `${process.env.REACT_APP_API_BASE_URL || '/api/v1'}/auth/twitch/login/`;
};

export const logoutUser = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/logout/', {}, { withCredentials: true });
  } catch (error) {
    console.error('Error logging out:', error);
  }
};

// --- Fantasy API --- 

// Obtener información de una fase del fantasy (equipos, reglas, y pick del usuario si existe)
export const getStageFantasyInfo = async (stageId: number): Promise<StageFantasyInfo> => {
  const response = await apiClient.get(`/stage/${stageId}/fantasy-info/`, { withCredentials: true });
  return response.data;
};

// Obtener los picks de un usuario para una fase específica
export const getUserFantasyPhasePicks = async (stageId: number): Promise<FantasyPhasePickData> => {
  const response = await apiClient.get<FantasyPhasePickData>(`/fantasy/stage/${stageId}/picks/`, { withCredentials: true });
  return response.data;
};

// Enviar/Actualizar los picks de un usuario para una fase
export const submitFantasyPhasePicks = async (stageId: number, payload: FantasyPhasePickPayload): Promise<FantasyPhasePickData> => {
  const response = await apiClient.post<FantasyPhasePickData>(`/fantasy/stage/${stageId}/picks/`, payload, { withCredentials: true });
  return response.data;
};


// Obtener los picks de playoffs de un usuario para un torneo específico
export const getUserFantasyPlayoffPicks = async (tournamentId: number): Promise<FantasyPlayoffPickData> => {
  const response = await apiClient.get<FantasyPlayoffPickData>(`/fantasy/tournament/${tournamentId}/playoff-picks/`, { withCredentials: true });
  return response.data;
};

// Enviar/Actualizar los picks de playoffs de un usuario para un torneo
export const submitFantasyPlayoffPicks = async (tournamentId: number, payload: FantasyPlayoffPickPayload): Promise<FantasyPlayoffPickData> => {
  const response = await apiClient.post<FantasyPlayoffPickData>(`/fantasy/tournament/${tournamentId}/playoff-picks/`, payload, { withCredentials: true });
  return response.data;
};

// Obtener el leaderboard del fantasy (paginado)
export const getFantasyLeaderboard = async (page: number = 1): Promise<PaginatedLeaderboardResponse> => {
  const response = await apiClient.get<PaginatedLeaderboardResponse>(`/fantasy/leaderboard/?page=${page}`);
  return response.data;
};

// Obtener el perfil público de fantasy de un usuario
export const getUserFantasyProfile = async (username: string): Promise<UserFantasyProfileData> => {
  const response = await apiClient.get<UserFantasyProfileData>(`/fantasy/profile/${username}/`);
  return response.data;
};

export { DEBUG_MODE };



// Obtener la información de un torneo específico para la selección de picks de playoffs
export const getTournamentFantasyPlayoffInfo = async (tournamentId: number): Promise<TournamentFantasyPlayoffInfo> => {
  const response = await apiClient.get<TournamentFantasyPlayoffInfo>(`/tournament/${tournamentId}/playoff-fantasy-info/`, { withCredentials: true });
  return response.data;
}; 