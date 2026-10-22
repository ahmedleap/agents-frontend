import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';

const requireSession = () => {
  const auth = inject(AuthService);
  return auth.getToken() && auth.getClientId()
    ? true
    : inject(Router).createUrlTree(['/login']);
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'portfolio',
    canActivate: [requireSession],
    loadComponent: () => import('./components/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },
  {
  path: 'dashboard',
    canActivate: [requireSession],
  loadComponent: () =>
    import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];

