import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { analystGuard } from './core/guards/analyst.guard';

/** Analysts land on the analysis page; everyone else on their portfolio. */
const home = () => (inject(AuthService).isAnalyst() ? 'analytics' : 'portfolio');

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
    // Sidebar > Account > +
    path: 'accounts/new',
    loadComponent: () => import('./components/add-account/add-account.component').then(m => m.AddAccountComponent)
  },
  {
    // Sidebar > Account > an account
    path: 'portfolio/:accountId',
    loadComponent: () => import('./components/portfolio/portfolio.component').then(m => m.PortfolioComponent)
  },
  {
    path: 'trades',
    loadComponent: () => import('./components/trades/trades.component').then(m => m.TradesComponent)
  },
  {
    path: 'trades/:accountId',
    loadComponent: () => import('./components/trades/trades.component').then(m => m.TradesComponent)
  },
  {
    path: 'history',
    loadComponent: () => import('./components/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'history/:accountId',
    loadComponent: () => import('./components/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'transactions',
    loadComponent: () => import('./components/transactions/transactions.component').then(m => m.TransactionsComponent)
  },
  {
    path: 'transactions/:accountId',
    loadComponent: () => import('./components/transactions/transactions.component').then(m => m.TransactionsComponent)
  },
  {
    path: 'news',
    loadComponent: () => import('./components/news/news.component').then(m => m.NewsComponent)
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
    redirectTo: 'login'
  }
];
