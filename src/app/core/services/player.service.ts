import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Player {
  id: string;
  name: string;
  nickname: string;
  preferred_position: 'GK' | 'DF' | 'MF' | 'FW';
  base_rating: number;
  is_active: boolean;
  is_deleted?: boolean;
  created_at?: string;
}

export interface PlayerStats {
  player_id: string;
  name: string;
  nickname: string;
  preferred_position: 'GK' | 'DF' | 'MF' | 'FW';
  base_rating: number;
  is_active: boolean;
  is_deleted?: boolean;
  matches_played: number;
  goals: number;
  assists: number;
  win_rate: number;
  average_rating: number;
  role?: 'GK' | 'Outfield';
}

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private supabaseService = inject(SupabaseService);

  // Reactivity with Signals
  private playersState = signal<Player[]>([]);
  private playerStatsState = signal<PlayerStats[]>([]);

  // Public computeds
  players = computed(() => this.playersState());
  playerStats = computed(() => this.playerStatsState());

  // Default seed data for Fut 7 (14 players)
  private mockPlayersSeed: Player[] = [
    { id: 'p1', name: 'Didier Ramírez', nickname: 'Didier', preferred_position: 'MF', base_rating: 8.5, is_active: true, is_deleted: false },
    { id: 'p2', name: 'Edwin Solarte', nickname: 'Solarte', preferred_position: 'FW', base_rating: 9.0, is_active: true, is_deleted: false },
    { id: 'p3', name: 'Juan Pury', nickname: 'Pury', preferred_position: 'FW', base_rating: 8.0, is_active: true, is_deleted: false },
    { id: 'p4', name: 'Armando Díaz', nickname: 'Armando', preferred_position: 'DF', base_rating: 7.5, is_active: true, is_deleted: false },
    { id: 'p5', name: 'Jhon Alexander', nickname: 'Jhon', preferred_position: 'FW', base_rating: 8.2, is_active: true, is_deleted: false },
    { id: 'p6', name: 'Felipe Regalón', nickname: 'Regalón', preferred_position: 'MF', base_rating: 7.0, is_active: true, is_deleted: false },
    { id: 'p7', name: 'Andrés Pasto', nickname: 'Pasto', preferred_position: 'DF', base_rating: 7.5, is_active: true, is_deleted: false },
    { id: 'p8', name: 'Santiago Muñoz', nickname: 'Santi', preferred_position: 'GK', base_rating: 8.0, is_active: true, is_deleted: false },
    { id: 'p9', name: 'Oscar Ortiz', nickname: 'Oscar', preferred_position: 'MF', base_rating: 6.8, is_active: true, is_deleted: false },
    { id: 'p10', name: 'Andrés Felipe', nickname: 'Andres', preferred_position: 'DF', base_rating: 7.2, is_active: true, is_deleted: false },
    { id: 'p11', name: 'Carlos Mendoza', nickname: 'Carlos', preferred_position: 'MF', base_rating: 7.8, is_active: true, is_deleted: false },
    { id: 'p12', name: 'Juan Carlos', nickname: 'Juan', preferred_position: 'DF', base_rating: 6.5, is_active: true, is_deleted: false },
    { id: 'p13', name: 'Mateo Gómez', nickname: 'Mateo', preferred_position: 'MF', base_rating: 7.0, is_active: true, is_deleted: false },
    { id: 'p14', name: 'Leonardo Castro', nickname: 'Leo', preferred_position: 'GK', base_rating: 7.0, is_active: true, is_deleted: false }
  ];

  constructor() {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    if (this.supabaseService.isMock) {
      this.loadFromLocalStorage();
      return;
    }

    try {
      // Load raw players (only non-deleted)
      const { data: rawPlayers, error: err1 } = await this.supabaseService.client
        .from('players')
        .select('*')
        .eq('is_deleted', false)
        .order('nickname');
      
      if (err1) throw err1;
      this.playersState.set(rawPlayers || []);

      // Load player stats from view (view is updated to only show non-deleted)
      const { data: stats, error: err2 } = await this.supabaseService.client
        .from('v_player_stats')
        .select('*');
      
      if (err2) throw err2;
      this.playerStatsState.set(stats || []);
    } catch (e) {
      console.error('Error loading players from Supabase, falling back to mock.', e);
      this.loadFromLocalStorage();
    }
  }

  private loadFromLocalStorage(): void {
    const storedPlayers = localStorage.getItem('fut_players');
    let playersList: Player[] = [];

    if (storedPlayers) {
      playersList = JSON.parse(storedPlayers).filter((p: Player) => !p.is_deleted);
    } else {
      // Seed initial mock players
      playersList = [...this.mockPlayersSeed];
      localStorage.setItem('fut_players', JSON.stringify(playersList));
    }
    this.playersState.set(playersList);
    this.recalculateMockStats(playersList);
  }

  // Recalculates stats from matches & events in LocalStorage to sync the view-like data
  recalculateMockStats(playersList: Player[]): void {
    if (!this.supabaseService.isMock) return;

    const storedMatches = localStorage.getItem('fut_matches') || '[]';
    const storedEvents = localStorage.getItem('fut_events') || '[]';
    const storedMatchPlayers = localStorage.getItem('fut_match_players') || '[]';

    const matches = JSON.parse(storedMatches);
    const events = JSON.parse(storedEvents);
    const matchPlayers = JSON.parse(storedMatchPlayers);

    const statsList: PlayerStats[] = [];

    playersList.forEach(player => {
      const participations = matchPlayers.filter((mp: any) => mp.player_id === player.id);
      
      const gkParticipations = participations.filter((mp: any) => mp.is_gk);
      const outfieldParticipations = participations.filter((mp: any) => !mp.is_gk);

      // If no participations yet, just return one default stat line based on preferred position
      if (participations.length === 0) {
        statsList.push({
          player_id: player.id,
          name: player.name || '',
          nickname: player.nickname,
          preferred_position: player.preferred_position,
          base_rating: player.base_rating,
          is_active: player.is_active,
          is_deleted: player.is_deleted,
          matches_played: 0,
          goals: 0,
          assists: 0,
          win_rate: 0,
          average_rating: player.base_rating,
          role: player.preferred_position === 'GK' ? 'GK' : 'Outfield'
        });
        return;
      }

      // Helper to generate stats for a specific role
      const generateRoleStats = (parts: any[], role: 'GK' | 'Outfield') => {
        if (parts.length === 0) return;

        const matchesPlayed = parts.length;
        const matchIds = new Set(parts.map((p: any) => p.match_id));

        const goals = events.filter((e: any) => e.event_type === 'goal' && e.player_id === player.id && matchIds.has(e.match_id)).length;
        const assists = events.filter((e: any) => e.event_type === 'goal' && e.assistant_id === player.id && matchIds.has(e.match_id)).length;

        const ratings = parts.map((mp: any) => mp.match_rating).filter((r: any) => r !== undefined && r !== null);
        const averageRating = ratings.length > 0 ? ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length : player.base_rating;

        let wins = 0;
        parts.forEach((mp: any) => {
          const match = matches.find((m: any) => m.id === mp.match_id);
          if (match) {
            if (mp.team === 'A' && match.team_a_score > match.team_b_score) wins++;
            else if (mp.team === 'B' && match.team_b_score > match.team_a_score) wins++;
          }
        });
        const winRate = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;

        statsList.push({
          player_id: player.id,
          name: player.name || '',
          nickname: player.nickname,
          preferred_position: player.preferred_position,
          base_rating: player.base_rating,
          is_active: player.is_active,
          is_deleted: player.is_deleted,
          matches_played: matchesPlayed,
          goals,
          assists,
          win_rate: parseFloat(winRate.toFixed(1)),
          average_rating: parseFloat(averageRating.toFixed(2)),
          role
        });
      };

      generateRoleStats(gkParticipations, 'GK');
      generateRoleStats(outfieldParticipations, 'Outfield');
    });

    this.playerStatsState.set(statsList);
  }

  async addPlayer(playerData: Omit<Player, 'id'>): Promise<void> {
    if (this.supabaseService.isMock) {
      const newPlayer: Player = {
        ...playerData,
        is_deleted: false,
        id: 'p-' + Math.random().toString(36).substring(2, 9)
      };
      // get the full list including deleted ones to save to storage
      const storedPlayers = JSON.parse(localStorage.getItem('fut_players') || '[]');
      const updatedStorageList = [...storedPlayers, newPlayer];
      localStorage.setItem('fut_players', JSON.stringify(updatedStorageList));
      
      const updatedActiveList = [...this.playersState(), newPlayer];
      this.playersState.set(updatedActiveList);
      this.recalculateMockStats(updatedActiveList);
      return;
    }

    const { error } = await this.supabaseService.client
      .from('players')
      .insert([playerData]);
    
    if (error) throw error;
    await this.loadAll();
  }

  async updatePlayer(id: string, updates: Partial<Player>): Promise<void> {
    if (this.supabaseService.isMock) {
      const storedPlayers = JSON.parse(localStorage.getItem('fut_players') || '[]');
      const updatedStorageList = storedPlayers.map((p: Player) => p.id === id ? { ...p, ...updates } : p);
      localStorage.setItem('fut_players', JSON.stringify(updatedStorageList));
      
      const updatedActiveList = this.playersState().map(p => p.id === id ? { ...p, ...updates } : p);
      this.playersState.set(updatedActiveList);
      this.recalculateMockStats(updatedActiveList);
      return;
    }

    const { error } = await this.supabaseService.client
      .from('players')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await this.loadAll();
  }

  async deletePlayer(id: string): Promise<void> {
    if (this.supabaseService.isMock) {
      const storedPlayers = JSON.parse(localStorage.getItem('fut_players') || '[]');
      // Logical delete: set is_deleted to true
      const updatedStorageList = storedPlayers.map((p: Player) => p.id === id ? { ...p, is_deleted: true } : p);
      localStorage.setItem('fut_players', JSON.stringify(updatedStorageList));
      
      const updatedActiveList = this.playersState().filter(p => p.id !== id);
      this.playersState.set(updatedActiveList);
      this.recalculateMockStats(updatedActiveList);
      return;
    }

    const { error } = await this.supabaseService.client
      .from('players')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) throw error;
    await this.loadAll();
  }

  // Bulk Import Feature requested by Didier
  async bulkAddPlayers(inputList: string): Promise<number> {
    const nicknames = inputList
      .split(/[\n,;]+/) // Split by newline, comma, or semicolon
      .map(name => name.trim())
      .filter(name => name.length > 0);

    let addedCount = 0;
    const currentNicknames = new Set(this.playersState().map(p => p.nickname.toLowerCase()));

    const newPlayersData: Omit<Player, 'id'>[] = [];

    for (const nick of nicknames) {
      if (!currentNicknames.has(nick.toLowerCase())) {
        // Guess a default position: alternate GK/DF/MF/FW or default to MF
        let position: 'GK' | 'DF' | 'MF' | 'FW' = 'MF';
        if (nick.toLowerCase().includes('keeper') || nick.toLowerCase().includes('portero')) {
          position = 'GK';
        } else if (nick.toLowerCase().includes('defensa') || nick.toLowerCase().includes('zaguero')) {
          position = 'DF';
        }
        
        newPlayersData.push({
          name: nick,
          nickname: nick,
          preferred_position: position,
          base_rating: 6.0,
          is_active: true
        });
        addedCount++;
      }
    }

    if (newPlayersData.length === 0) return 0;

    if (this.supabaseService.isMock) {
      const newPlayers: Player[] = newPlayersData.map(data => ({
        ...data,
        id: 'p-' + Math.random().toString(36).substring(2, 9)
      }));
      const updatedList = [...this.playersState(), ...newPlayers];
      localStorage.setItem('fut_players', JSON.stringify(updatedList));
      this.playersState.set(updatedList);
      this.recalculateMockStats(updatedList);
    } else {
      const { error } = await this.supabaseService.client
        .from('players')
        .insert(newPlayersData);
      
      if (error) throw error;
      await this.loadAll();
    }

    return addedCount;
  }
}
