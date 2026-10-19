import { Routes } from '@angular/router';

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
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    // There is no combined all-accounts view; pick an account from the sidebar
    path: 'portfolio',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    // Sidebar > Account > an account
    path: 'portfolio/:accountId',
    loadComponent: () => import('./components/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },

  {
    // Unknown URLs go back to the start of the flow
    path: '**',
    redirectTo: 'login'
  }
];
