import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerService, PlayerStats } from '../../../core/services/player.service';
import { MatchService, Match } from '../../../core/services/match.service';

import { NzTableModule } from 'ng-zorro-antd/table';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzSpinModule } from 'ng-zorro-antd/spin';

interface PlayerMatchHistory {
  match: Match;
  team: 'A' | 'B';
  rating: number;
  goals: number;
  assists: number;
  isMvp: boolean;
}

@Component({
  selector: 'app-players-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzTableModule,
    NzInputModule,
    NzSelectModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    NzStatisticModule,
    NzTagModule,
    NzDrawerModule,
    NzDividerModule,
    NzSpinModule
  ],
  templateUrl: './players-list.component.html',
  styleUrls: ['./players-list.component.scss']
})
export class PlayersListComponent implements OnInit {
  private playerService = inject(PlayerService);

  // Filter signals
  searchQuery = signal<string>('');
  positionFilter = signal<string>('ALL');
  selectedMatchId = signal<string>('ALL');
  matchSpecificStats = signal<PlayerStats[]>([]);

  // Expose matches for dropdown
  get matches() {
    return this.matchService.matches();
  }

  // Computed Leaderboard
  filteredStats = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const pos = this.positionFilter();
    const isGlobal = this.selectedMatchId() === 'ALL';
    let stats = isGlobal ? this.playerService.playerStats() : this.matchSpecificStats();

    if (query) {
      stats = stats.filter(s => 
        s.nickname.toLowerCase().includes(query) || 
        (s.name && s.name.toLowerCase().includes(query))
      );
    }

    if (pos !== 'ALL') {
      stats = stats.filter(s => s.preferred_position === pos);
    }

    // Sort by G+A descending, then goals descending, then rating descending
    return [...stats].sort((a, b) => {
      const gaA = a.goals + a.assists;
      const gaB = b.goals + b.assists;
      if (gaB !== gaA) return gaB - gaA;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return b.average_rating - a.average_rating;
    });
  });

  // Top Performers for Cards
  topScorer = computed(() => {
    const source = this.selectedMatchId() === 'ALL' ? this.playerService.playerStats() : this.matchSpecificStats();
    const list = source.filter(s => s.goals > 0);
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.goals - a.goals)[0];
  });

  topAssistant = computed(() => {
    const source = this.selectedMatchId() === 'ALL' ? this.playerService.playerStats() : this.matchSpecificStats();
    const list = source.filter(s => s.assists > 0);
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.assists - a.assists)[0];
  });

  topRated = computed(() => {
    const source = this.selectedMatchId() === 'ALL' ? this.playerService.playerStats() : this.matchSpecificStats();
    const list = source.filter(s => s.matches_played > 0);
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.average_rating - a.average_rating)[0];
  });

  // Drawer State
  isDrawerVisible = false;
  selectedPlayerDetails = signal<PlayerStats | null>(null);
  playerHistory = signal<PlayerMatchHistory[]>([]);
  isLoadingHistory = false;

  private matchService = inject(MatchService);

  ngOnInit(): void {
    this.playerService.loadAll();
  }

  async onMatchChange(matchId: string): Promise<void> {
    this.selectedMatchId.set(matchId);
    
    if (matchId === 'ALL') {
      this.matchSpecificStats.set([]);
      return;
    }

    try {
      const match = this.matchService.matches().find(m => m.id === matchId);
      if (!match) return;

      const teamAWin = match.team_a_score > match.team_b_score;
      const teamBWin = match.team_b_score > match.team_a_score;
      const isDraw = match.team_a_score === match.team_b_score;

      const { players, events } = await this.matchService.getMatchDetails(matchId);
      const allPlayers = this.playerService.players();

      const specificStats: PlayerStats[] = players.map(mp => {
        const pInfo = allPlayers.find(p => p.id === mp.player_id);
        const goals = events.filter(e => e.event_type === 'goal' && e.player_id === mp.player_id).length;
        const assists = events.filter(e => e.event_type === 'goal' && e.assistant_id === mp.player_id).length;
        
        let wins = 0, losses = 0, draws = 0;
        if (isDraw) {
          draws = 1;
        } else if ((mp.team === 'A' && teamAWin) || (mp.team === 'B' && teamBWin)) {
          wins = 1;
        } else {
          losses = 1;
        }

        return {
          player_id: mp.player_id,
          name: pInfo?.name || '',
          nickname: pInfo?.nickname || 'Desconocido',
          preferred_position: pInfo?.preferred_position || 'MF',
          matches_played: 1,
          goals,
          assists,
          average_rating: mp.match_rating || 6.0,
          base_rating: pInfo?.base_rating || 6.0,
          is_active: pInfo?.is_active ?? true,
          win_rate: wins * 100 // Para un solo partido, si gana es 100%, si no es 0%
        };
      });

      this.matchSpecificStats.set(specificStats);
    } catch (e) {
      console.error('Error fetching match stats:', e);
      this.matchSpecificStats.set([]);
    }
  }

  async openPlayerDrawer(stats: PlayerStats): Promise<void> {
    this.selectedPlayerDetails.set(stats);
    this.isDrawerVisible = true;
    this.isLoadingHistory = true;

    try {
      const allMatches = this.matchService.matches();
      const historyList: PlayerMatchHistory[] = [];

      for (const match of allMatches) {
        const { players, events } = await this.matchService.getMatchDetails(match.id);
        
        // Check if player participated in this match
        const mp = players.find(p => p.player_id === stats.player_id);
        if (mp) {
          // Count goals and assists in this match
          const goals = events.filter(e => e.event_type === 'goal' && e.player_id === stats.player_id).length;
          const assists = events.filter(e => e.event_type === 'goal' && e.assistant_id === stats.player_id).length;

          // Check if MVP
          const isMvp = events.some(e => e.event_type === 'mvp' && e.player_id === stats.player_id);

          historyList.push({
            match,
            team: mp.team,
            rating: mp.match_rating || 6.0,
            goals,
            assists,
            isMvp
          });
        }
      }

      this.playerHistory.set(historyList);
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoadingHistory = false;
    }
  }

  closePlayerDrawer(): void {
    this.isDrawerVisible = false;
    this.selectedPlayerDetails.set(null);
    this.playerHistory.set([]);
  }

  getPositionLabel(pos: string): string {
    switch (pos) {
      case 'GK': return 'Portero';
      case 'DF': return 'Defensa';
      case 'MF': return 'Mediocampista';
      case 'FW': return 'Delantero';
      default: return pos;
    }
  }

  getPositionColor(pos: string): string {
    switch (pos) {
      case 'GK': return 'orange';
      case 'DF': return 'blue';
      case 'MF': return 'green';
      case 'FW': return 'magenta';
      default: return 'default';
    }
  }
}
