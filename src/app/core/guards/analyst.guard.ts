import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Only signed-in analysts may open the analytics page; everyone else goes to the dashboard. */
export const analystGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return (auth.isAnalyst() && !auth.isAdmin()) || inject(Router).createUrlTree(['/dashboard']);
};
