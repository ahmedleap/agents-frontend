import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/services/auth.service';
/** Keep legacy dashboard links aligned with the signed-in user's home page. */
const home = () => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) return '/login';
  const role = auth.currentUser()?.role;
  return role === 'ANALYST' ? '/analytics' : role === 'CLIENT' ? '/client' : '/admin';
};
import { adminRoleGuard, analystRoleGuard, authGuard, clientRoleGuard, guestGuard } from './core/auth/auth.guard';

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
    canActivate: [guestGuard],
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./components/signup/signup.component').then(m => m.SignupComponent)
  },

  // ---------- App (after logging in) ----------
  {
    path: 'client',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'dashboard',
    redirectTo: home,
    pathMatch: 'full'
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
    // Sidebar > Account > +
    path: 'accounts/new',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/add-account/add-account.component').then(m => m.AddAccountComponent)
  },
  {
    // Sidebar > Account > an account
    path: 'portfolio/:accountId',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },
  {
    path: 'trades',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/trades/trades.component').then(m => m.TradesComponent)
  },
  {
    path: 'trades/:accountId',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/trades/trades.component').then(m => m.TradesComponent)
  },
  {
    path: 'history',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'history/:accountId',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'transactions',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/transactions/transactions.component').then(m => m.TransactionsComponent)
  },
  {
    path: 'transactions/:accountId',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/transactions/transactions.component').then(m => m.TransactionsComponent)
  },
  {
    path: 'news',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/news/news.component').then(m => m.NewsComponent)
  },
  {
    // Only analysts get here; their sidebar shows just this page
    path: 'analytics',
    canActivate: [authGuard, analystRoleGuard],
    loadComponent: () =>
      import('./components/analytics/analytics.component').then(m => m.AnalyticsComponent)
  },
  {
    // Header > gear
    path: 'settings',
    canActivate: [authGuard, clientRoleGuard],
    loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent)
  },

  {
    // Unknown URLs go back to the start of the flow
    path: '**',
    redirectTo: 'login'
  }
];
