import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    NzCardModule, 
    NzInputModule, 
    NzButtonModule, 
    NzFormModule,
    NzIconModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private message = inject(NzMessageService);

  email = signal('');
  password = signal('');
  isLoading = signal(false);

  constructor() {
    // Si ya es admin, redirigir al home
    if (this.authService.isAdmin()) {
      this.router.navigate(['/']);
    }
  }

  async onSubmit() {
    if (!this.email() || !this.password()) {
      this.message.warning('Por favor ingresa email y contraseña');
      return;
    }

    this.isLoading.set(true);
    const { error } = await this.authService.login(this.email(), this.password());
    this.isLoading.set(false);

    if (error) {
      this.message.error(error.message || 'Credenciales inválidas');
    } else {
      this.message.success('Acceso Administrador Desbloqueado');
      this.router.navigate(['/']);
    }
  }
}
