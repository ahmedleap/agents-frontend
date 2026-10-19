import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { analystGuard } from './core/guards/analyst.guard';

/** Analysts land on the analysis page; everyone else on their portfolio. */
const home = () => (inject(AuthService).isAnalyst() ? 'analytics' : 'portfolio');

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    // There is no combined all-accounts view; pick an account from the sidebar
    path: 'portfolio',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'portfolio/:accountId',
    loadComponent: () => import('./components/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },
  {
  path: 'dashboard',
  loadComponent: () =>
    import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    // Only analysts get here; their sidebar shows just this page
    path: 'analytics',
    canActivate: [analystGuard],
    loadComponent: () =>
      import('./components/analytics/analytics.component').then(m => m.AnalyticsComponent)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];

