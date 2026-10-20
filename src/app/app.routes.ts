import { Routes } from '@angular/router';
import { adminRoleGuard, analystRoleGuard, authGuard, clientRoleGuard } from './core/auth/auth.guard';

// Listed in the order a user moves through the app:
// log in -> sign up (if they don't have an account) -> dashboard -> accounts from the sidebar
export const routes: Routes = [
  {
    // The app opens on the login page
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // ---------- Auth (full-width, no sidebar) ----------
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent)
  },

  // ---------- App (after logging in) ----------
  {
    path: 'client',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/client-home/client-home.component').then(m => m.ClientHomeComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, analystRoleGuard],
    loadComponent: () => import('./components/analyst-dashboard/analyst-dashboard.component').then(m => m.AnalystDashboardComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminRoleGuard],
    loadComponent: () => import('./components/admin-overview/admin-overview.component').then(m => m.AdminOverviewComponent)
  },
  {
    // There is no combined all-accounts view; pick an account from the sidebar
    path: 'portfolio',
    redirectTo: 'client',
    pathMatch: 'full'
  },
  {
    // Sidebar > Account > an account
    path: 'portfolio/:accountId',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },

  {
    // Unknown URLs go back to the start of the flow
    path: '**',
    redirectTo: 'login'
  }
];
