import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const clientRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.currentUser()?.role === 'CLIENT' ? true : router.createUrlTree(['/dashboard']);
};

export const analystRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.currentUser()?.role === 'ANALYST' ? true : homeUrl(auth, router);
};

export const adminRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.currentUser()?.role === 'ADMIN' ? true : homeUrl(auth, router);
};

function homeUrl(auth: AuthService, router: Router) {
  const role = auth.currentUser()?.role;
  return router.createUrlTree([role === 'CLIENT' ? '/client' : role === 'ADMIN' ? '/admin' : '/dashboard']);
}
