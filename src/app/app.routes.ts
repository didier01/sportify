import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/public/players-list/players-list.component').then(m => m.PlayersListComponent)
  },
  {
    path: 'players',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/public/players-management/players-management.component').then(m => m.PlayersManagementComponent)
  },
  {
    path: 'balance',
    loadComponent: () => import('./features/public/team-builder/team-builder.component').then(m => m.TeamBuilderComponent)
  },
  {
    path: 'log-match',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/public/match-logger/match-logger.component').then(m => m.MatchLoggerComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/public/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'matches',
    loadComponent: () => import('./features/public/matches-history/matches-history.component').then(m => m.MatchesHistoryComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
