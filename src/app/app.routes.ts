import { Routes } from '@angular/router';

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
  path: 'dashboard',
  loadComponent: () =>
    import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
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
    path: '**',
    redirectTo: 'dashboard'
  }
];

