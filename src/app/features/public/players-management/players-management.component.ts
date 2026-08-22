import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Player, PlayerService } from '../../../core/services/player.service';

import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTagModule } from 'ng-zorro-antd/tag';

@Component({
  selector: 'app-players-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzTableModule,
    NzButtonModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzInputNumberModule,
    NzSwitchModule,
    NzIconModule,
    NzCardModule,
    NzTagModule
  ],
  templateUrl: './players-management.component.html',
  styleUrls: ['./players-management.component.scss']
})
export class PlayersManagementComponent {
  private playerService = inject(PlayerService);
  private message = inject(NzMessageService);
  private fb = inject(NonNullableFormBuilder);

  // Expose signal from service
  players = this.playerService.players;

  // Modal control state
  isModalVisible = false;
  modalTitle = 'Nuevo Jugador';
  editingPlayerId: string | null = null;

  // Bulk import state
  bulkInputText = '';
  isBulkImporting = false;

  // Typed Form
  playerForm = this.fb.group({
    nickname: ['', [Validators.required, Validators.maxLength(25)]],
    name: [''],
    preferred_position: ['MF' as 'GK' | 'DF' | 'MF' | 'FW', [Validators.required]],
    base_rating: [6.0, [Validators.required, Validators.min(1), Validators.max(10)]],
    is_active: [true, [Validators.required]]
  });

  // Filters and Sorters
  positionFilters = [
    { text: 'Portero', value: 'GK' },
    { text: 'Defensa', value: 'DF' },
    { text: 'Mediocampista', value: 'MF' },
    { text: 'Delantero', value: 'FW' }
  ];
  
  statusFilters = [
    { text: 'Activo', value: true },
    { text: 'Inactivo', value: false }
  ];

  filterByPosition = (list: string[], item: Player): boolean => list.some(pos => item.preferred_position === pos);
  filterByStatus = (list: boolean[], item: Player): boolean => list.some(status => item.is_active === status);

  sortByName = (a: Player, b: Player): number => a.nickname.localeCompare(b.nickname);
  sortByFullName = (a: Player, b: Player): number => (a.name || '').localeCompare(b.name || '');
  sortByRating = (a: Player, b: Player): number => a.base_rating - b.base_rating;
  sortByStatus = (a: Player, b: Player): number => (a.is_active === b.is_active) ? 0 : (a.is_active ? -1 : 1);

  openAddModal(): void {
    this.editingPlayerId = null;
    this.modalTitle = 'Nuevo Jugador';
    this.playerForm.reset({
      nickname: '',
      name: '',
      preferred_position: 'MF',
      base_rating: 6.0,
      is_active: true
    });
    this.isModalVisible = true;
  }

  openEditModal(player: Player): void {
    this.editingPlayerId = player.id;
    this.modalTitle = 'Editar Jugador';
    this.playerForm.setValue({
      nickname: player.nickname,
      name: player.name || '',
      preferred_position: player.preferred_position,
      base_rating: player.base_rating,
      is_active: player.is_active
    });
    this.isModalVisible = true;
  }

  handleCancel(): void {
    this.isModalVisible = false;
  }

  async handleSave(): Promise<void> {
    if (this.playerForm.invalid) {
      Object.values(this.playerForm.controls).forEach(control => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
      return;
    }

    const formValue = this.playerForm.getRawValue();

    try {
      if (this.editingPlayerId) {
        await this.playerService.updatePlayer(this.editingPlayerId, formValue);
        this.message.success('Jugador actualizado correctamente');
      } else {
        // Check if nickname already exists
        const exists = this.players().some(p => p.nickname.toLowerCase() === formValue.nickname.toLowerCase());
        if (exists) {
          this.message.error(`El apodo "${formValue.nickname}" ya está en uso.`);
          return;
        }
        await this.playerService.addPlayer(formValue);
        this.message.success('Jugador creado correctamente');
      }
      this.isModalVisible = false;
    } catch (e) {
      console.error(e);
      this.message.error('Error al guardar el jugador');
    }
  }

  private modal = inject(NzModalService);

  async handleDelete(player: Player): Promise<void> {
    this.modal.confirm({
      nzTitle: '¿Estás seguro de eliminar este jugador?',
      nzContent: `El jugador <b>${player.nickname}</b> será eliminado (eliminación lógica). Se mantendrá su historial en los partidos pero no aparecerá más en la aplicación.`,
      nzOkText: 'Sí, eliminar',
      nzOkType: 'primary',
      nzOkDanger: true,
      nzCancelText: 'Cancelar',
      nzClassName: 'dark-modal',
      nzOnOk: async () => {
        try {
          await this.playerService.deletePlayer(player.id);
          this.message.success(`Jugador ${player.nickname} eliminado exitosamente.`);
        } catch (e) {
          console.error(e);
          this.message.error('Error al eliminar jugador');
        }
      }
    });
  }

  async handleBulkImport(): Promise<void> {
    if (!this.bulkInputText.trim()) {
      this.message.warning('Por favor escribe al menos un apodo o nombre.');
      return;
    }

    this.isBulkImporting = true;
    try {
      const added = await this.playerService.bulkAddPlayers(this.bulkInputText);
      this.message.success(`Se importaron ${added} jugadores exitosamente.`);
      this.bulkInputText = '';
    } catch (e) {
      console.error(e);
      this.message.error('Ocurrió un error al realizar la importación masiva');
    } finally {
      this.isBulkImporting = false;
    }
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
