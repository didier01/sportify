import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private isMockMode = false;

  constructor() {
    const hasCredentials = 
      environment.supabaseUrl && 
      environment.supabaseKey && 
      environment.supabaseUrl !== 'YOUR_SUPABASE_URL' && 
      environment.supabaseKey !== 'YOUR_SUPABASE_ANON_KEY';

    if (hasCredentials) {
      this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
      this.isMockMode = false;
      console.log('Supabase client initialized successfully.');
    } else {
      this.isMockMode = true;
      console.warn('Supabase URL or Key not configured. Running in Mock/LocalStorage fallback mode.');
    }
  }

  get client(): SupabaseClient {
    if (!this.supabase) {
      throw new Error('Supabase client is not initialized (Running in Mock Mode).');
    }
    return this.supabase;
  }

  get isMock(): boolean {
    return this.isMockMode;
  }
}
