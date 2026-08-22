import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  // Auth State
  private sessionUser = signal<any | null>(null);
  private loading = signal<boolean>(true);

  // Computed: Si hay un usuario logueado, lo consideramos admin. 
  // Podríamos revisar roles después si hay multitenant.
  isAdmin = computed(() => !!this.sessionUser());
  isLoading = computed(() => this.loading());

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    if (this.supabaseService.isMock) {
      // Si estamos en mock mode, verificamos localStorage por simulación
      const isMockAdmin = localStorage.getItem('mock_admin_session') === 'true';
      this.sessionUser.set(isMockAdmin ? { email: 'admin@mock.com' } : null);
      this.loading.set(false);
      return;
    }

    try {
      const { data: { session } } = await this.supabaseService.client.auth.getSession();
      this.sessionUser.set(session?.user || null);

      // Listen to auth changes
      this.supabaseService.client.auth.onAuthStateChange((_event, session) => {
        this.sessionUser.set(session?.user || null);
      });
    } catch (e) {
      console.error('Error fetching auth session', e);
    } finally {
      this.loading.set(false);
    }
  }

  async login(email: string, password: string): Promise<{ error: any }> {
    if (this.supabaseService.isMock) {
      if (email === 'admin@admin.com' && password === 'admin') {
        localStorage.setItem('mock_admin_session', 'true');
        this.sessionUser.set({ email });
        return { error: null };
      }
      return { error: { message: 'Credenciales inválidas en modo mock (admin@admin.com / admin)' } };
    }

    const { error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }

  async logout(): Promise<void> {
    if (this.supabaseService.isMock) {
      localStorage.removeItem('mock_admin_session');
      this.sessionUser.set(null);
      this.router.navigate(['/']);
      return;
    }

    await this.supabaseService.client.auth.signOut();
    this.router.navigate(['/']);
  }
}
