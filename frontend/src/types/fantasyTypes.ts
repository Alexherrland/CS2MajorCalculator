import { Team } from './hltvTypes';

export interface BaseUser {
  id: number;
  username: string;
  email?: string;
}

export interface TwitchUserProfile {
  user: BaseUser;
  twitch_id: string | null;
  twitch_username: string | null;
  twitch_profile_image_url: string | null;
  total_fantasy_points: number;
  // Añadimos opcionalmente el slug del perfil de usuario si se expone así desde el backend
  // o se puede construir en el frontend a partir del username.
  // slug?: string; 
}

// Renombrado de FantasyTeamPick a FantasyTeamDetail y se añaden nuevos campos
export interface FantasyTeamDetail {
  id: number;
  name: string;
  logo?: string;
  seed: number;
  points_earned: number | null; // Puntos que este equipo dio para este pick específico
  is_role_impossible: boolean; // Si el equipo ya no puede cumplir el rol pickeado
  current_wins?: number; // Victorias actuales en la fase (para suizas)
  current_losses?: number; // Derrotas actuales en la fase (para suizas)
  is_bonus_active?: boolean; // Si el bonus por seed bajo estaba activo para este equipo
}

export interface FantasyPhasePickData {
  id: number;
  user_profile: TwitchUserProfile; 
  stage: number; 
  stage_name: string;
  teams_3_0_details: FantasyTeamDetail[]; // Actualizado
  teams_advance_details: FantasyTeamDetail[]; // Actualizado
  teams_0_3_details: FantasyTeamDetail[]; // Actualizado
  points_earned: number; // Puntos totales del pick
  is_locked: boolean;
  is_finalized: boolean;
  updated_at: string;
}

export interface FantasyPhasePickPayload {
  teams_3_0_ids: number[];
  teams_advance_ids: number[];
  teams_0_3_ids: number[];
}

export interface FantasyPlayoffPickData {
  id: number;
  user_profile: TwitchUserProfile; 
  tournament_id: number;
  tournament_name: string;
  quarter_final_winners_details: FantasyTeamDetail[]; // Actualizado
  semi_final_winners_details: FantasyTeamDetail[]; // Actualizado
  final_winner_details: FantasyTeamDetail | null; // Actualizado
  points_earned: number; // Puntos totales del pick
  is_locked: boolean;
  is_finalized: boolean;
  updated_at: string;
}

export interface FantasyPlayoffPickPayload {
  quarter_final_winners_ids?: number[];
  semi_final_winners_ids?: number[];
  final_winner_id?: number | null;
}

export interface PaginatedLeaderboardResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  // user: BaseUser; // Originalmente estaba así, lo cambiamos por UserProfile completo
  user_profile: TwitchUserProfile; // Contiene BaseUser y datos de Twitch
  total_fantasy_points: number;
  rank?: number; // Rank puede ser proveído por el backend
}

export interface UserFantasyProfileData extends TwitchUserProfile {
  phase_picks: FantasyPhasePickData[];
  playoff_picks: FantasyPlayoffPickData[];
  // Considerar añadir posición en el leaderboard si el backend la puede proveer fácilmente
  // leaderboard_position?: number;
}

// StageTeamInfoForFantasy se elimina, ya que FantasyTeamDetail ahora cubre esta información.

export interface StageFantasyInfo {
    id: number; // Stage ID
    name: string;
    fantasy_status: 'OPEN' | 'LOCKED' | 'FINALIZED';
    teams: FantasyTeamDetail[]; // Actualizado desde StageTeamInfoForFantasy[]
    underdog_bonus_team_ids?: number[]; // Mantener si aún es relevante por separado, aunque FantasyTeamDetail tiene is_bonus_active
    rules: {
        num_teams_3_0: number;
        num_teams_advance: number;
        num_teams_0_3: number;
        // podrían añadirse más reglas si fuera necesario
    };
    user_pick?: FantasyPhasePickData; // Las elecciones del usuario actual para esta fase, si existen
}

export interface TournamentFantasyPlayoffInfo {
    tournament_id: number;
    tournament_name: string;
    fantasy_status: 'OPEN' | 'LOCKED' | 'FINALIZED'; // O un estado análogo para los playoffs del torneo
    teams: FantasyTeamDetail[]; // Actualizado desde Team[] para consistencia con el nuevo serializador
    rules: {
        num_quarter_final_winners: number;
        num_semi_final_winners: number;
        num_final_winner: number;
    };
    user_pick?: FantasyPlayoffPickData; // Las elecciones del usuario actual, si existen
} 