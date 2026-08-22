import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Player, PlayerService } from '../../../core/services/player.service';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzInputModule } from 'ng-zorro-antd/input';

interface TeamCombination {
  teamA: Player[];
  teamB: Player[];
  ratingDiff: number;
  positionPenalty: number;
  score: number; // Combined score
}

@Component({
  selector: 'app-team-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzCardModule,
    NzCheckboxModule,
    NzButtonModule,
    NzRadioModule,
    NzGridModule,
    NzIconModule,
    NzTagModule,
    NzDividerModule,
    NzAlertModule,
    NzInputModule
  ],
  templateUrl: './team-builder.component.html',
  styleUrls: ['./team-builder.component.scss']
})
export class TeamBuilderComponent {
  private playerService = inject(PlayerService);
  private message = inject(NzMessageService);

  // Filter signal
  searchQuery = signal<string>('');

  // Active players list
  activePlayers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    let list = this.playerService.players().filter(p => p.is_active);
    
    if (query) {
      list = list.filter(p => 
        p.nickname.toLowerCase().includes(query) || 
        (p.name && p.name.toLowerCase().includes(query))
      );
    }
    return list;
  });

  // Selected players map: { [id: string]: boolean }
  selectedPlayersMap = signal<{ [id: string]: boolean }>({});

  // Balancing mode: 'NUMERIC' | 'POSITIONAL' | 'HYBRID'
  balanceMode = signal<'NUMERIC' | 'POSITIONAL' | 'HYBRID'>('HYBRID');

  // Generated suggestion lists
  suggestions = signal<TeamCombination[]>([]);
  selectedSuggestionIndex = signal<number>(0);

  // Computed counts
  selectedCount = computed(() => {
    return Object.values(this.selectedPlayersMap()).filter(Boolean).length;
  });

  constructor() {
    // Autoselect first 14 active players as default to make testing easy
    this.playerService.loadAll().then(() => {
      const active = this.activePlayers();
      const initialMap: { [id: string]: boolean } = {};
      active.slice(0, 14).forEach(p => {
        initialMap[p.id] = true;
      });
      this.selectedPlayersMap.set(initialMap);
    });
  }

  togglePlayer(playerId: string): void {
    const current = { ...this.selectedPlayersMap() };
    current[playerId] = !current[playerId];
    this.selectedPlayersMap.set(current);
  }

  selectPreset(count: number): void {
    const active = this.activePlayers();
    const initialMap: { [id: string]: boolean } = {};
    active.slice(0, count).forEach(p => {
      initialMap[p.id] = true;
    });
    this.selectedPlayersMap.set(initialMap);
  }

  clearSelection(): void {
    this.selectedPlayersMap.set({});
    this.suggestions.set([]);
  }

  generateTeams(): void {
    const list = this.activePlayers().filter(p => this.selectedPlayersMap()[p.id]);

    if (list.length < 4) {
      this.message.warning('Por favor selecciona al menos 4 jugadores.');
      return;
    }

    const n = list.length;
    const teamSize = Math.floor(n / 2);

    // Generate all combinations for Team A
    const allCombos: Player[][] = [];
    const getCombos = (start: number, combo: Player[]) => {
      if (combo.length === teamSize) {
        allCombos.push([...combo]);
        return;
      }
      for (let i = start; i < list.length; i++) {
        combo.push(list[i]);
        getCombos(i + 1, combo);
        combo.pop();
      }
    };
    getCombos(0, []);

    // Build combinations evaluation
    const combinations: TeamCombination[] = allCombos.map(teamA => {
      const teamAIds = new Set(teamA.map(p => p.id));
      const teamB = list.filter(p => !teamAIds.has(p.id));

      // Calculate rating sums
      const sumA = teamA.reduce((s, p) => s + this.getPlayerRating(p), 0);
      const sumB = teamB.reduce((s, p) => s + this.getPlayerRating(p), 0);
      const ratingDiff = Math.abs(sumA - sumB);

      // Calculate position penalty
      const posA = this.getPositionCounts(teamA);
      const posB = this.getPositionCounts(teamB);

      const positionPenalty =
        Math.abs(posA.GK - posB.GK) +
        Math.abs(posA.DF - posB.DF) +
        Math.abs(posA.MF - posB.MF) +
        Math.abs(posA.FW - posB.FW);

      // Score for hybrid sorting (lower is better)
      const score = ratingDiff + (positionPenalty * 1.5);

      return {
        teamA,
        teamB,
        ratingDiff,
        positionPenalty,
        score
      };
    });

    // Sort based on selected balance mode
    let sorted: TeamCombination[] = [];
    const mode = this.balanceMode();

    if (mode === 'NUMERIC') {
      // Sort strictly by rating difference
      sorted = combinations.sort((a, b) => a.ratingDiff - b.ratingDiff);
    } else if (mode === 'POSITIONAL') {
      // Sort strictly by position penalty, then sub-sort by rating diff
      sorted = combinations.sort((a, b) => {
        if (a.positionPenalty !== b.positionPenalty) {
          return a.positionPenalty - b.positionPenalty;
        }
        return a.ratingDiff - b.ratingDiff;
      });
    } else {
      // Hybrid mode: sort by combined score
      sorted = combinations.sort((a, b) => a.score - b.score);
    }

    // Filter duplicates (Team A vs Team B is symmetric, e.g. A=[1,2], B=[3,4] is same as A=[3,4], B=[1,2])
    const uniqueSuggestions: TeamCombination[] = [];
    const seenCombos = new Set<string>();

    for (const combo of sorted) {
      const idsA = combo.teamA.map(p => p.id).sort().join(',');
      const idsB = combo.teamB.map(p => p.id).sort().join(',');
      const comboKey = idsA < idsB ? `${idsA}|${idsB}` : `${idsB}|${idsA}`;

      if (!seenCombos.has(comboKey)) {
        seenCombos.add(comboKey);
        uniqueSuggestions.push(combo);
      }

      if (uniqueSuggestions.length >= 3) break; // Limit to top 3 suggestions
    }

    this.suggestions.set(uniqueSuggestions);
    this.selectedSuggestionIndex.set(0);
    this.message.success('Equipos generados correctamente.');
  }

  private getPositionCounts(team: Player[]): { GK: number, DF: number, MF: number, FW: number } {
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    team.forEach(p => {
      if (p.preferred_position in counts) {
        counts[p.preferred_position]++;
      }
    });
    return counts;
  }

  getSuggestionTitle(index: number): string {
    return `Sugerencia ${index + 1}`;
  }

  getCurrentCombo(): TeamCombination | null {
    const list = this.suggestions();
    const index = this.selectedSuggestionIndex();
    if (list.length > 0 && index < list.length) {
      return list[index];
    }
    return null;
  }

  getTeamRatingAverage(team: Player[]): string {
    if (team.length === 0) return '0.0';
    const sum = team.reduce((s, p) => s + this.getPlayerRating(p), 0);
    return (sum / team.length).toFixed(1);
  }

  getTeamRatingSum(team: Player[]): string {
    const sum = team.reduce((s, p) => s + this.getPlayerRating(p), 0);
    return sum.toFixed(1);
  }

  getPlayerRating(player: Player): number {
    const stats = this.playerService.playerStats().find(s => s.player_id === player.id);
    return stats && stats.matches_played > 0 ? stats.average_rating : player.base_rating;
  }

  copyTeamsToClipboard(): void {
    const combo = this.getCurrentCombo();
    if (!combo) return;

    let text = `⚽ *EQUIPOS BALANCEADOS* ⚽\n\n`;

    text += `🟢 *EQUIPO VERDE* (Rating: ${this.getTeamRatingAverage(combo.teamA)} avg)\n`;
    combo.teamA.forEach((p, idx) => {
      text += `${idx + 1}. ${p.nickname} [${p.preferred_position}]\n`;
    });

    text += `\n🟠 *EQUIPO NARANJA* (Rating: ${this.getTeamRatingAverage(combo.teamB)} avg)\n`;
    combo.teamB.forEach((p, idx) => {
      text += `${idx + 1}. ${p.nickname} [${p.preferred_position}]\n`;
    });

    text += `\n_Diferencia de rating: ${combo.ratingDiff.toFixed(1)}_\n`;
    text += `_Generado con SPORT-TIFY_ 🚀`;

    navigator.clipboard.writeText(text).then(() => {
      this.message.success('Copiado al portapapeles. Listo para WhatsApp.');
    }).catch(err => {
      console.error('Could not copy text: ', err);
      this.message.error('No se pudo copiar automáticamente.');
    });
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
}
