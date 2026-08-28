import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatchService, Match, MatchPlayer, MatchEvent } from '../../../core/services/match.service';
import { PlayerService, Player } from '../../../core/services/player.service';
import { AuthService } from '../../../core/services/auth.service';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';

interface MatchDetails {
  match: Match;
  teamA: { player: Player; rating: number; isMvp: boolean; goals: number; own_goals: number; assists: number; }[];
  teamB: { player: Player; rating: number; isMvp: boolean; goals: number; own_goals: number; assists: number; }[];
  goals: { minute: number; scorerId?: string; assistantId?: string | null; scorer?: string; assistant?: string; team?: 'A' | 'B' }[];
  mvpNickname?: string;
}

@Component({
  selector: 'app-matches-history',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzTableModule,
    NzModalModule,
    NzIconModule,
    NzTagModule,
    NzGridModule,
    NzDividerModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzButtonModule,
    NzSelectModule
  ],
  templateUrl: './matches-history.component.html',
  styleUrls: ['./matches-history.component.scss']
})
export class MatchesHistoryComponent {
  private matchService = inject(MatchService);
  private playerService = inject(PlayerService);
  private modal = inject(NzModalService);
  private msg = inject(NzMessageService);
  authService = inject(AuthService); // Inyectamos como public para el template

  // Expose matches list signal
  matches = this.matchService.matches;
  allPlayersList = this.playerService.players;
  teamColors = ['Rojo', 'Amarillo', 'Azul', 'Verde', 'Rosado', 'Naranja', 'Blanco', 'Negro'];

  // Pagination & Grouping
  pageSize = signal(10);

  groupedMatches = computed(() => {
    const allMatches = this.matches();
    const limit = this.pageSize();
    const sliced = allMatches.slice(0, limit);

    const groups: { monthYear: string; matches: Match[] }[] = [];
    const map = new Map<string, Match[]>();

    sliced.forEach(match => {
      const d = new Date(match.date);
      const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      const monthYearRaw = formatter.format(d);
      const monthYear = monthYearRaw.charAt(0).toUpperCase() + monthYearRaw.slice(1);

      if (!map.has(monthYear)) {
        map.set(monthYear, []);
        groups.push({ monthYear, matches: map.get(monthYear)! });
      }
      map.get(monthYear)!.push(match);
    });

    return groups;
  });

  hasMore = computed(() => this.matches().length > this.pageSize());

  loadMore() {
    this.pageSize.update(v => v + 10);
  }

  // Selected match details state
  selectedMatchDetails = signal<MatchDetails | null>(null);
  isModalVisible = false;
  isLoadingDetails = signal(false);

  // Edit Mode state
  isEditMode = false;
  editScoreA = 0;
  editScoreB = 0;
  editTeamAColor = 'Verde';
  editTeamBColor = 'Naranja';
  editTeamA: { player: Player; rating: number; isMvp: boolean; goals: number; own_goals: number; assists: number; }[] = [];
  editTeamB: { player: Player; rating: number; isMvp: boolean; goals: number; own_goals: number; assists: number; }[] = [];
  editGoals: { id?: string; minute: number; scorerId: string; assistantId?: string | null; scorer?: string; assistant?: string; team?: 'A' | 'B' }[] = [];

  // Add goal form
  newGoalMinute: number | null = null;
  newGoalScorerId: string | null = null;
  newGoalAssistantId: string | null = null;

  async deleteMatch(match: Match): Promise<void> {
    try {
      await this.matchService.deleteMatch(match.id);
      this.msg.success('Partido eliminado correctamente');
    } catch (e) {
      console.error(e);
      this.msg.error('Error al eliminar el partido');
    }
  }

  toggleEditMode(): void {
    const details = this.selectedMatchDetails();
    if (!details) return;

    if (this.isEditMode) {
      // cancel edit
      this.isEditMode = false;
    } else {
      // enter edit, copy state
      this.isEditMode = true;
      this.editScoreA = details.match.team_a_score;
      this.editScoreB = details.match.team_b_score;
      this.editTeamAColor = details.match.team_a_color || 'Verde';
      this.editTeamBColor = details.match.team_b_color || 'Naranja';
      this.editTeamA = details.teamA.map(p => ({ ...p }));
      this.editTeamB = details.teamB.map(p => ({ ...p }));
      this.editGoals = details.goals.map((g: any) => ({ ...g }));
    }
  }

  async saveEdits(): Promise<void> {
    const details = this.selectedMatchDetails();
    if (!details) return;

    try {
      this.isLoadingDetails.set(true);

      const matchUpdates: Partial<Match> = {
        team_a_score: this.editScoreA,
        team_b_score: this.editScoreB,
        team_a_color: this.editTeamAColor,
        team_b_color: this.editTeamBColor
      };

      const playersToSave: MatchPlayer[] = [];
      this.editTeamA.forEach(item => {
        playersToSave.push({
          match_id: details.match.id,
          player_id: item.player.id,
          team: 'A',
          match_rating: item.rating
        });
      });
      this.editTeamB.forEach(item => {
        playersToSave.push({
          match_id: details.match.id,
          player_id: item.player.id,
          team: 'B',
          match_rating: item.rating
        });
      });

      const eventsToSave: Omit<MatchEvent, 'match_id'>[] = [];
      this.editGoals.forEach(g => {
        eventsToSave.push({
          event_type: 'goal',
          minute: g.minute,
          player_id: g.scorerId,
          assistant_id: g.assistantId || null
        });
      });
      const currentMvp = [...this.editTeamA, ...this.editTeamB].find(p => p.isMvp);
      if (currentMvp) {
        eventsToSave.push({
          event_type: 'mvp',
          player_id: currentMvp.player.id
        });
      }

      await this.matchService.updateMatch(details.match.id, matchUpdates, playersToSave, eventsToSave);
      
      this.msg.success('Partido actualizado correctamente');
      this.isEditMode = false;
      await this.openMatchDetails({ ...details.match, ...matchUpdates } as Match);
    } catch (e) {
      console.error(e);
      this.msg.error('Error al guardar los cambios');
      this.isLoadingDetails.set(false);
    }
  }

  removeGoal(index: number): void {
    this.editGoals.splice(index, 1);
  }

  addGoal(): void {
    if (this.newGoalMinute === null || !this.newGoalScorerId) {
      this.msg.warning('Debe indicar al menos el minuto y el autor del gol');
      return;
    }

    const scorer = this.allPlayersList().find(p => p.id === this.newGoalScorerId);
    const assistant = this.newGoalAssistantId ? this.allPlayersList().find(p => p.id === this.newGoalAssistantId) : null;

    const scorerItemA = this.editTeamA.find(t => t.player.id === this.newGoalScorerId);
    const team: 'A' | 'B' = scorerItemA ? 'A' : 'B';

    this.editGoals.push({
      minute: this.newGoalMinute,
      scorerId: this.newGoalScorerId,
      assistantId: this.newGoalAssistantId,
      scorer: scorer?.nickname || 'Jugador',
      assistant: assistant?.nickname,
      team
    });

    this.editGoals.sort((a, b) => a.minute - b.minute);

    this.newGoalMinute = null;
    this.newGoalScorerId = null;
    this.newGoalAssistantId = null;
  }

  updateGoal(goal: any): void {
    const scorer = this.allPlayersList().find(p => p.id === goal.scorerId);
    const assistant = goal.assistantId ? this.allPlayersList().find(p => p.id === goal.assistantId) : null;
    
    if (scorer) {
      goal.scorer = scorer.nickname;
      const scorerItemA = this.editTeamA.find(t => t.player.id === goal.scorerId);
      goal.team = scorerItemA ? 'A' : 'B';
    }
    if (assistant) {
      goal.assistant = assistant.nickname;
    } else {
      goal.assistant = undefined;
    }
  }

  async openMatchDetails(match: Match): Promise<void> {
    this.isEditMode = false;
    this.isLoadingDetails.set(true);
    this.isModalVisible = true;

    try {
      const { players, events } = await this.matchService.getMatchDetails(match.id);
      
      const allPlayers = this.playerService.players();

      // Find MVP from events
      const mvpEvent = events.find(e => e.event_type === 'mvp');
      const mvpPlayerId = mvpEvent?.player_id;
      const mvpPlayer = allPlayers.find(p => p.id === mvpPlayerId);

      // Separate teams and count goals/assists
      const teamA: { player: Player; rating: number; isMvp: boolean; goals: number; own_goals: number; assists: number; }[] = [];
      const teamB: { player: Player; rating: number; isMvp: boolean; goals: number; own_goals: number; assists: number; }[] = [];

      players.forEach(mp => {
        const player = allPlayers.find(p => p.id === mp.player_id);
        if (player) {
          const goalsCount = events.filter(e => e.event_type === 'goal' && e.player_id === player.id).length;
          const ownGoalsCount = events.filter(e => e.event_type === 'own_goal' && e.player_id === player.id).length;
          const assistsCount = events.filter(e => e.event_type === 'goal' && e.assistant_id === player.id).length;

          const item = {
            player,
            rating: mp.match_rating || 6.0,
            isMvp: player.id === mvpPlayerId,
            goals: goalsCount,
            own_goals: ownGoalsCount,
            assists: assistsCount
          };
          if (mp.team === 'A') teamA.push(item);
          else teamB.push(item);
        }
      });

      // Filter and map goals timeline
      const goals = events
        .filter(e => e.event_type === 'goal')
        .map(g => {
          const scorer = allPlayers.find(p => p.id === g.player_id)?.nickname || 'Jugador';
          const assistant = g.assistant_id 
            ? allPlayers.find(p => p.id === g.assistant_id)?.nickname 
            : undefined;

          const isTeamA = teamA.some(t => t.player.id === g.player_id);
          const team: 'A' | 'B' = isTeamA ? 'A' : 'B';

          return {
            minute: g.minute || 0,
            scorerId: g.player_id,
            assistantId: g.assistant_id,
            scorer,
            assistant,
            team
          };
        })
        .sort((a, b) => a.minute - b.minute);

      this.selectedMatchDetails.set({
        match,
        teamA,
        teamB,
        goals,
        mvpNickname: mvpPlayer?.nickname
      });
    } catch (e) {
      console.error(e);
      this.isModalVisible = false;
    } finally {
      this.isLoadingDetails.set(false);
    }
  }

  handleCloseModal(): void {
    this.isModalVisible = false;
    this.selectedMatchDetails.set(null);
  }
}
