export interface Opponent {
    id: number;
    score: number;
  }
  
  export interface Team {  
    id: number;  
    name: string;  
    logo?: string;  
    seed: number;  
    originalSeed?: number;  
    region?: string;  
    wins?: number;  
    losses?: number;  
    buchholzScore?: number;  
    opponents?: Opponent[];  
    isPromoted?: boolean;  
    isFromBackend?: boolean;
  }
  
  export interface Match {
    team1Id: number;
    team2Id: number;
    winner: number | null;
    isBO3?: boolean;
    format?: 'BO1' | 'BO3';
    status?: 'PENDING' | 'LIVE' | 'FINISHED' | 'CANCELED';
    team1Score?: number;
    team2Score?: number;
    map1_team1_score?: number | null;
    map1_team2_score?: number | null;
    map2_team1_score?: number | null;
    map2_team2_score?: number | null;
    map3_team1_score?: number | null;
    map3_team2_score?: number | null;
    hltvMatchId?: number | null;
  }
  
  export interface Round {
    roundNumber: number;
    matches: Match[];
    status: 'pending' | 'active' | 'completed';
  }
  
  export interface Stage {
    id: number;
    name: string;
    type: string;
    fantasyStatus: string;
    order: number;
    teams: Team[];
    initialTeams?: Team[];
    qualifiedTeams?: Team[];
    rounds: Round[];
  }
  
  export interface MajorData {
    name: string;
    currentStage: string;
    stages: {
      [key: string]: Stage;
    };
    currentRound?: number;
    tournamentType?: string;
    swissRulesType?: string;
  }
  
  export interface StageData {
    stageName: string;
    teams: Team[];
    rounds: Round[];
  }
  
  export interface PreviousOpponent {
    opponent: Team | undefined;
    result: string;
    round: number;
    contribution: number;
  }

export interface TournamentInfo {
  id: number;
  name: string;
  slug: string;
  startDate: string; // O Date, según cómo lo quieras manejar
  endDate: string;   // O Date
  location: string;
  tournamentType: string;
  swissRulesType: string;
  isLive: boolean;
}