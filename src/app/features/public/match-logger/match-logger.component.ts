import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Player, PlayerService } from '../../../core/services/player.service';
import { MatchService, MatchPlayer, MatchEvent } from '../../../core/services/match.service';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTagModule } from 'ng-zorro-antd/tag';

interface RosterPlayer {
  player: Player;
  played: boolean;
  team: 'A' | 'B';
  rating: number;
  isMvp: boolean;
  is_gk?: boolean;
}

@Component({
  selector: 'app-match-logger',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzInputModule,
    NzButtonModule,
    NzSelectModule,
    NzCheckboxModule,
    NzGridModule,
    NzIconModule,
    NzInputNumberModule,
    NzDividerModule,
    NzDatePickerModule,
    NzRadioModule,
    NzTagModule
  ],
  templateUrl: './match-logger.component.html',
  styleUrls: ['./match-logger.component.scss']
})
export class MatchLoggerComponent {
  private playerService = inject(PlayerService);
  private matchService = inject(MatchService);
  private message = inject(NzMessageService);
  private router = inject(Router);

  // Match core details
  matchDate: Date = new Date();
  youtubeUrl = '';
  matchNotes = '';
  
  teamAName = 'Verde';
  teamBName = 'Naranja';
  teamColors = ['Rojo', 'Amarillo', 'Azul', 'Verde', 'Rosado', 'Naranja', 'Blanco', 'Negro'];

  // Parser text
  rawNotesText = '';

  // List of active players for selection
  players = this.playerService.players;

  // Local state for the log form
  roster: Omit<RosterPlayer, 'isMvp'>[] = [];
  goalsTimeline: Omit<MatchEvent, 'match_id'>[] = [];

  // Computed scores based on goals timeline
  teamAScore = 0;
  teamBScore = 0;

  constructor() {
    this.playerService.loadAll().then(() => {
      this.initRoster();
    });
  }

  private initRoster(): void {
    const list = this.players().filter(p => p.is_active);
    this.roster = list.map(player => {
      const isGK = false;
      const baseRating = isGK ? player.base_rating : (player.preferred_position === 'GK' ? 6.0 : player.base_rating);
      return {
        player,
        played: false,
        is_gk: isGK,
        team: 'A',
        rating: Math.round(((baseRating * 0.4) + 3.5) * 10) / 10
      };
    });
  }

  // Parse notes and pre-populate roster and goals timeline
  processNotes(): void {
    if (!this.rawNotesText.trim()) {
      this.message.warning('Por favor ingresa texto para parsear.');
      return;
    }

    const { events, teamPlayers, scores } = this.matchService.parseNotes(
      this.rawNotesText,
      this.players()
    );

    if (events.length === 0) {
      this.message.warning('No se pudieron detectar goles en el texto. Revisa el formato.');
      return;
    }

    // Reset current state
    this.goalsTimeline = [...events];

    // Map parsed team players to local roster
    const teamPlayerIds = new Map(teamPlayers.map(tp => [tp.player_id, tp.team]));

    this.roster.forEach(item => {
      if (teamPlayerIds.has(item.player.id)) {
        item.played = true;
        item.team = teamPlayerIds.get(item.player.id) || 'A';
      }
    });

    this.calculateScores();
    this.message.success(`Parser finalizado. Se detectaron ${events.length} goles.`);
  }

  calculateScores(): void {
    let scoreA = 0;
    let scoreB = 0;

    this.goalsTimeline.forEach(goal => {
      const rosterItem = this.roster.find(r => r.player.id === goal.player_id);
      if (rosterItem && rosterItem.played) {
        if (goal.event_type === 'own_goal') {
          // Point goes to opposing team
          if (rosterItem.team === 'A') scoreB++;
          else scoreA++;
        } else {
          // Normal goal
          if (rosterItem.team === 'A') scoreA++;
          else scoreB++;
        }
      }
    });

    this.teamAScore = scoreA;
    this.teamBScore = scoreB;
    
    this.calculateRatings();
  }

  calculateRatings(): void {
    this.roster.filter(r => r.played).forEach(item => {
      const p = item.player;
      const isGK = !!item.is_gk;

      // Base Rating: Si es arquero pero juega de campo, toma 6.0 estándar en vez de su rating de arquero (ej. 9.0)
      const baseRating = isGK ? p.base_rating : (p.preferred_position === 'GK' ? 6.0 : p.base_rating);
      
      // A. Nota Inicial: (Base Rating * 0.4) + 3.5
      let rating = (baseRating * 0.4) + 3.5;
      
      // B. Impacto de Partido (Ataque y Resultado)
      const isTeamA = item.team === 'A';
      const myTeamScore = isTeamA ? this.teamAScore : this.teamBScore;
      const enemyTeamScore = isTeamA ? this.teamBScore : this.teamAScore;

      // Result modifier
      if (myTeamScore > enemyTeamScore) {
        rating += 0.5; // Win
      } else if (myTeamScore < enemyTeamScore) {
        rating -= 0.5; // Loss
      }

      // Posición efectiva en el partido para multiplicadores
      const effectivePos = isGK ? 'GK' : (p.preferred_position === 'GK' ? 'MF' : p.preferred_position);

      // Goals scored by this player (excluding own goals)
      const goalsScored = this.goalsTimeline.filter(g => g.player_id === p.id && g.event_type === 'goal').length;
      if (goalsScored > 0) {
        if (effectivePos === 'FW') rating += (goalsScored * 0.4);
        else if (effectivePos === 'MF') rating += (goalsScored * 0.5);
        else if (effectivePos === 'DF') rating += (goalsScored * 0.6);
        else if (effectivePos === 'GK') rating += (goalsScored * 1.0);
      }

      // Own goals penalty
      const ownGoals = this.goalsTimeline.filter(g => g.player_id === p.id && g.event_type === 'own_goal').length;
      if (ownGoals > 0) {
        rating -= (ownGoals * 0.1);
      }

      // Assists by this player
      const assistsMade = this.goalsTimeline.filter(g => g.assistant_id === p.id).length;
      if (assistsMade > 0) {
        if (effectivePos === 'FW' || effectivePos === 'MF') rating += (assistsMade * 0.3);
        else if (effectivePos === 'DF' || effectivePos === 'GK') rating += (assistsMade * 0.4);
      }

      // C. Impacto Defensivo (Goles recibidos por el equipo)
      if (enemyTeamScore > 0) {
        let penaltyPerGoal = 0;
        if (effectivePos === 'GK') penaltyPerGoal = 0.15;
        else if (effectivePos === 'DF') penaltyPerGoal = 0.12;
        else if (effectivePos === 'MF') penaltyPerGoal = 0.10;
        else if (effectivePos === 'FW') penaltyPerGoal = 0.08;
        
        let defensivePenalty = enemyTeamScore * penaltyPerGoal;
        
        // Capped at 0.20
        if (defensivePenalty > 0.20) defensivePenalty = 0.20;

        rating -= defensivePenalty;
      }

      // Format and clamp rating to [1.0, 10.0]
      rating = Math.max(1.0, Math.min(10.0, rating));
      // Round to 1 decimal place
      item.rating = Math.round(rating * 10) / 10;
    });
  }

  addGoal(): void {
    const activePlayersInMatch = this.roster.filter(r => r.played).map(r => r.player);
    if (activePlayersInMatch.length === 0) {
      this.message.warning('Debes marcar al menos un jugador convocado en la plantilla antes de añadir goles.');
      return;
    }

    this.goalsTimeline.push({
      event_type: 'goal',
      minute: 0,
      time_str: '',
      player_id: activePlayersInMatch[0].id,
      assistant_id: null
    });
    this.calculateScores();
  }

  removeGoal(index: number): void {
    this.goalsTimeline.splice(index, 1);
    this.calculateScores();
  }

  // Get active players currently checked in the roster for the dropdowns
  getConvocados(): Player[] {
    return this.roster.filter(r => r.played).map(r => r.player);
  }

  getPositionLabel(pos: string): string {
    switch (pos) {
      case 'GK': return 'POR';
      case 'DF': return 'DEF';
      case 'MF': return 'MC';
      case 'FW': return 'DEL';
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

  async saveMatch(): Promise<void> {
    const activeRoster = this.roster.filter(r => r.played);

    if (activeRoster.length < 4) {
      this.message.error('Debe haber al menos 4 jugadores convocados.');
      return;
    }

    if (this.teamAScore === 0 && this.teamBScore === 0 && this.goalsTimeline.length > 0) {
      this.message.warning('Los marcadores están en 0 pero tienes goles registrados. Por favor verifica los equipos.');
    }

    const matchData = {
      date: this.matchDate.toISOString().split('T')[0],
      youtube_url: this.youtubeUrl || undefined,
      team_a_score: this.teamAScore,
      team_b_score: this.teamBScore,
      team_a_color: this.teamAName,
      team_b_color: this.teamBName,
      notes: this.matchNotes || undefined
    };

    const playersData: Omit<MatchPlayer, 'match_id'>[] = activeRoster.map(r => ({
      player_id: r.player.id,
      team: r.team,
      match_rating: r.rating,
      is_gk: r.is_gk
    }));

    // Formulate database events
    const eventsData: Omit<MatchEvent, 'match_id'>[] = this.goalsTimeline.map(goal => ({
      event_type: goal.event_type,
      minute: goal.minute || (goal.time_str && goal.time_str.includes(':') ? parseInt(goal.time_str.split(':')[0], 10) : parseInt(goal.time_str || '0', 10)),
      time_str: goal.time_str,
      player_id: goal.player_id,
      assistant_id: goal.assistant_id || null
    }));

    try {
      await this.matchService.saveMatch(matchData, playersData, eventsData);
      this.message.success('Partido registrado exitosamente.');
      this.router.navigate(['/']);
    } catch (e) {
      console.error(e);
      this.message.error('Error al guardar el partido. Verifica la consola.');
    }
  }
}
