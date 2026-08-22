import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Player, PlayerService } from './player.service';

export interface Match {
  id: string;
  date: string;
  youtube_url?: string;
  team_a_score: number;
  team_b_score: number;
  team_a_color?: string;
  team_b_color?: string;
  notes?: string;
  created_at?: string;
}

export interface MatchPlayer {
  match_id: string;
  player_id: string;
  team: 'A' | 'B';
  match_rating?: number;
}

export interface MatchEvent {
  id?: string;
  match_id?: string;
  event_type: 'goal' | 'card_yellow' | 'card_red' | 'mvp';
  minute?: number;
  time_str?: string;
  player_id: string;
  assistant_id?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MatchService {
  private supabaseService = inject(SupabaseService);
  private playerService = inject(PlayerService);

  private matchesState = signal<Match[]>([]);
  matches = this.matchesState.asReadonly();

  constructor() {
    this.loadMatches();
  }

  async loadMatches(): Promise<void> {
    if (this.supabaseService.isMock) {
      const stored = localStorage.getItem('fut_matches') || '[]';
      this.matchesState.set(JSON.parse(stored));
      return;
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('matches')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      this.matchesState.set(data || []);
    } catch (e) {
      console.error('Error loading matches from Supabase, using mock.', e);
      const stored = localStorage.getItem('fut_matches') || '[]';
      this.matchesState.set(JSON.parse(stored));
    }
  }

  // Dual mode match saving
  async saveMatch(
    matchData: Omit<Match, 'id'>, 
    players: Omit<MatchPlayer, 'match_id'>[], 
    events: Omit<MatchEvent, 'match_id'>[]
  ): Promise<void> {
    if (this.supabaseService.isMock) {
      const matchId = 'm-' + Math.random().toString(36).substring(2, 9);
      
      const newMatch: Match = {
        ...matchData,
        id: matchId
      };

      // 1. Save match
      const currentMatches = JSON.parse(localStorage.getItem('fut_matches') || '[]');
      currentMatches.unshift(newMatch);
      localStorage.setItem('fut_matches', JSON.stringify(currentMatches));

      // 2. Save match players
      const currentMPs = JSON.parse(localStorage.getItem('fut_match_players') || '[]');
      const newMPs = players.map(p => ({ ...p, match_id: matchId }));
      localStorage.setItem('fut_match_players', JSON.stringify([...currentMPs, ...newMPs]));

      // 3. Save events
      const currentEvents = JSON.parse(localStorage.getItem('fut_events') || '[]');
      const newEvents = events.map(e => ({
        ...e,
        id: 'ev-' + Math.random().toString(36).substring(2, 9),
        match_id: matchId
      }));
      localStorage.setItem('fut_events', JSON.stringify([...currentEvents, ...newEvents]));

      // Refresh cache
      this.matchesState.set(currentMatches);
      this.playerService.recalculateMockStats(this.playerService.players());
      return;
    }

    // Supabase transaction simulation
    const { data: match, error: matchErr } = await this.supabaseService.client
      .from('matches')
      .insert([matchData])
      .select()
      .single();

    if (matchErr) throw matchErr;
    const matchId = match.id;

    // Save match players
    const matchPlayersData = players.map(p => ({ ...p, match_id: matchId }));
    const { error: mpErr } = await this.supabaseService.client
      .from('match_players')
      .insert(matchPlayersData);

    if (mpErr) throw mpErr;

    // Save events
    if (events.length > 0) {
      const eventsData = events.map(e => ({ ...e, match_id: matchId }));
      const { error: evErr } = await this.supabaseService.client
        .from('match_events')
        .insert(eventsData);

      if (evErr) throw evErr;
    }

    await this.loadMatches();
    await this.playerService.loadAll();
  }

  async deleteMatch(matchId: string): Promise<void> {
    if (this.supabaseService.isMock) {
      const currentMatches = JSON.parse(localStorage.getItem('fut_matches') || '[]');
      const currentMPs = JSON.parse(localStorage.getItem('fut_match_players') || '[]');
      const currentEvents = JSON.parse(localStorage.getItem('fut_events') || '[]');

      localStorage.setItem('fut_matches', JSON.stringify(currentMatches.filter((m: any) => m.id !== matchId)));
      localStorage.setItem('fut_match_players', JSON.stringify(currentMPs.filter((mp: any) => mp.match_id !== matchId)));
      localStorage.setItem('fut_events', JSON.stringify(currentEvents.filter((e: any) => e.match_id !== matchId)));

      await this.loadMatches();
      await this.playerService.loadAll();
      return;
    }

    const { error } = await this.supabaseService.client
      .from('matches')
      .delete()
      .eq('id', matchId);

    if (error) throw error;

    await this.loadMatches();
    await this.playerService.loadAll();
  }

  async updateMatch(
    matchId: string, 
    matchData: Partial<Match>, 
    players: MatchPlayer[], 
    events: Omit<MatchEvent, 'match_id'>[]
  ): Promise<void> {
    if (this.supabaseService.isMock) {
      // In mock mode, we reuse saveMatch but override the ID creation
      await this.deleteMatch(matchId);
      
      const newMatch: Match = {
        ...(matchData as Match),
        id: matchId
      };

      const currentMatches = JSON.parse(localStorage.getItem('fut_matches') || '[]');
      currentMatches.unshift(newMatch);
      localStorage.setItem('fut_matches', JSON.stringify(currentMatches));

      const currentMPs = JSON.parse(localStorage.getItem('fut_match_players') || '[]');
      const newMPs = players.map(p => ({ ...p, match_id: matchId }));
      localStorage.setItem('fut_match_players', JSON.stringify([...currentMPs, ...newMPs]));

      const currentEvents = JSON.parse(localStorage.getItem('fut_events') || '[]');
      const newEvents = events.map(e => ({
        ...e,
        id: 'ev-' + Math.random().toString(36).substring(2, 9),
        match_id: matchId
      }));
      localStorage.setItem('fut_events', JSON.stringify([...currentEvents, ...newEvents]));

      await this.loadMatches();
      await this.playerService.loadAll();
      return;
    }

    // 1. Update Match properties
    if (Object.keys(matchData).length > 0) {
      const { error: matchErr } = await this.supabaseService.client
        .from('matches')
        .update(matchData)
        .eq('id', matchId);
      if (matchErr) throw matchErr;
    }

    // 2. To keep it simple, we delete all players and events and recreate them
    await this.supabaseService.client.from('match_events').delete().eq('match_id', matchId);
    await this.supabaseService.client.from('match_players').delete().eq('match_id', matchId);

    // Re-insert players
    if (players.length > 0) {
      const matchPlayersData = players.map(p => ({ ...p, match_id: matchId }));
      const { error: mpErr } = await this.supabaseService.client
        .from('match_players')
        .insert(matchPlayersData);
      if (mpErr) throw mpErr;
    }

    // Re-insert events
    if (events.length > 0) {
      const eventsData = events.map(e => {
        const { id, ...eventWithoutId } = e; // Remove ID to let DB autogenerate if needed, or keep it. Actually, events in this flow might have arbitrary UUIDs. Let's just pass them as they are. 
        // We will remove id just in case.
        return { ...eventWithoutId, match_id: matchId };
      });
      const { error: evErr } = await this.supabaseService.client
        .from('match_events')
        .insert(eventsData);
      if (evErr) throw evErr;
    }

    await this.loadMatches();
    await this.playerService.loadAll();
  }

  async getMatchDetails(matchId: string): Promise<{ players: MatchPlayer[], events: MatchEvent[] }> {
    if (this.supabaseService.isMock) {
      const allMPs = JSON.parse(localStorage.getItem('fut_match_players') || '[]');
      const allEvents = JSON.parse(localStorage.getItem('fut_events') || '[]');
      
      const players = allMPs.filter((mp: any) => mp.match_id === matchId);
      const events = allEvents.filter((e: any) => e.match_id === matchId);
      
      return { players, events };
    }

    try {
      const { data: players, error: mpErr } = await this.supabaseService.client
        .from('match_players')
        .select('*')
        .eq('match_id', matchId);

      if (mpErr) throw mpErr;

      const { data: events, error: evErr } = await this.supabaseService.client
        .from('match_events')
        .select('*')
        .eq('match_id', matchId);

      if (evErr) throw evErr;

      return { players: players || [], events: events || [] };
    } catch (e) {
      console.error('Error fetching match details from Supabase', e);
      return { players: [], events: [] };
    }
  }

  /**
   * Parser of video notes
   * Soportes:
   * 1. Formato por Jugador (Tus notas actuales):
   *    Equipo Azul (17 goles)
   *    Solarte (7 goles): 05:57, 08:30, 19:35
   * 2. Formato estructurado tipo Tabla/CSV (Goles + Asistencias):
   *    05:57 - Solarte - Didier
   *    08:30 - Solarte
   */
  parseNotes(
    text: string, 
    playersList: Player[]
  ): { 
    events: Omit<MatchEvent, 'match_id'>[], 
    teamPlayers: { player_id: string, nickname: string, team: 'A' | 'B' }[],
    scores: { teamA: number, teamB: number }
  } {
    const events: Omit<MatchEvent, 'match_id'>[] = [];
    const teamPlayers: { player_id: string, nickname: string, team: 'A' | 'B' }[] = [];
    let scoreA = 0;
    let scoreB = 0;

    if (!text || text.trim().length === 0) {
      return { events, teamPlayers, scores: { teamA: 0, teamB: 0 } };
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Check if it's the current player-grouped format by scanning for "Name (X goles):" or just "Name:"
    const isPlayerGroupedFormat = lines.some(line => {
      const cleanLine = line.replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '').trim();
      return /^([A-Za-zÀ-ÿ0-9\s]+)(?:\s*\(\d+\s*gol(?:es)?\))?\s*:\s*([0-9:,\-\s]+)$/i.test(cleanLine);
    });

    if (isPlayerGroupedFormat) {
      let currentTeam: 'A' | 'B' = 'A';
      let teamSeenCount = 0;

      for (const line of lines) {
        // Detect Team headers like "Equipo Azul (17 goles)" or "Equipo Naranja"
        if (/^equipo\s/i.test(line.replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '').trim())) {
          teamSeenCount++;
          if (teamSeenCount === 1) {
            currentTeam = 'A';
          } else if (teamSeenCount === 2) {
            currentTeam = 'B';
          }
          continue;
        }

        // Match player goals line: "Solarte (7 goles): 05:57, 08:30" or "Solarte: 05:57 - 08:30"
        const cleanLine = line.replace(/^[^a-zA-ZÀ-ÿ0-9]+/, '').trim();
        const match = cleanLine.match(/^([A-Za-zÀ-ÿ0-9\s]+)(?:\s*\(\d+\s*gol(?:es)?\))?\s*:\s*([0-9:,\-\s]+)$/i);
        if (match) {
          const nickname = match[1].trim();
          const timesStr = match[2];

          // Find player in db list
          const player = playersList.find(p => p.nickname.toLowerCase() === nickname.toLowerCase());
          if (player) {
            // Keep track of which team they played for in this parsed match
            if (!teamPlayers.some(tp => tp.player_id === player.id)) {
              teamPlayers.push({ player_id: player.id, nickname: player.nickname, team: currentTeam });
            }

            // Split and parse times (separated by comma or dash)
            const times = timesStr.split(/[,-]/).map(t => t.trim()).filter(t => t.length > 0);
            times.forEach(timeStr => {
              // Convert MM:SS to minute integer
              let minute = 0;
              if (timeStr.includes(':')) {
                minute = parseInt(timeStr.split(':')[0], 10);
              } else {
                minute = parseInt(timeStr, 10) || 0;
              }

              events.push({
                event_type: 'goal',
                minute,
                time_str: timeStr,
                player_id: player.id,
                assistant_id: null
              });

              if (currentTeam === 'A') scoreA++;
              else scoreB++;
            });
          }
        }
      }
    } else {
      // Formato estructurado por línea: "05:57 - Solarte - Didier" o "08:30 - Solarte"
      for (const line of lines) {
        const parts = line.split(/[-–,]/).map(p => p.trim());
        if (parts.length >= 2) {
          const timeStr = parts[0];
          const scorerName = parts[1];
          const assistantName = parts.length > 2 ? parts[2] : null;

          let minute = 0;
          if (timeStr.includes(':')) {
            minute = parseInt(timeStr.split(':')[0], 10);
          } else {
            minute = parseInt(timeStr, 10) || 0;
          }

          const scorer = playersList.find(p => p.nickname.toLowerCase() === scorerName.toLowerCase());
          if (scorer) {
            let assistant_id: string | null = null;
            if (assistantName) {
              const assistant = playersList.find(p => p.nickname.toLowerCase() === assistantName.toLowerCase());
              if (assistant) assistant_id = assistant.id;
            }

            events.push({
              event_type: 'goal',
              minute,
              player_id: scorer.id,
              assistant_id
            });
          }
        }
      }
      
      // Since this CSV-like format doesn't indicate teams, we default scores to total goals,
      // but teams and player-team mappings will be completed visually in the GUI.
      scoreA = events.length; 
      scoreB = 0;
    }

    return { 
      events, 
      teamPlayers, 
      scores: { teamA: scoreA, teamB: scoreB } 
    };
  }
}
