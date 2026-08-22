import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Esperamos un pequeño tick si isLoading es true, pero dado que en angular
  // signals son sincronos post-init, podemos verificar directo
  if (authService.isAdmin()) {
    return true;
  }

  // Si no es admin, no puede entrar. Redirigimos al inicio.
  return router.parseUrl('/');
};
