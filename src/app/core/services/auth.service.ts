import { Injectable, signal, inject, computed } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Authentication Service
 * 
 * Modern Angular 22+ Service using:
 * - Signals for reactive state management
 * - Computed signals for derived state
 * - inject() for dependency injection
 * - Proper separation of concerns
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiService = inject(ApiService);

  // State signals
  private readonly accessToken = signal<string | null>(this.readStoredToken());
  private readonly currentUser = signal<any | null>(null);
  private readonly isAuthenticating = signal(false);
  private readonly authError = signal<string | null>(null);

  // Derived state
  readonly isAuthenticated = computed(() => !!this.accessToken() && !!this.currentUser());
  readonly hasError = computed(() => !!this.authError());
  readonly authErrorMessage = computed(() => this.authError());

  /**
   * Analysts can see the analytics dashboard. Accepts either `user.role` or a
   * `user.roles` array from the login response, e.g. 'ANALYST' or 'ROLE_ANALYST'.
   */
  readonly isAnalyst = computed(() => {
    // TODO(analytics access): role check is disabled so the analytics page can be viewed
    // before sign-in exists. Everyone is treated as an analyst until this is restored:
    // delete the `return true;` below and uncomment the check.
    return true;

    // const user = this.currentUser();
    // if (!this.isAuthenticated() || !user) return false;
    // const roles: unknown[] = Array.isArray(user.roles) ? user.roles : [user.role];
    // return roles.some(r => typeof r === 'string' && r.toUpperCase().replace(/^ROLE_/, '') === 'ANALYST');
  });

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<any> {
    this.isAuthenticating.set(true);
    this.authError.set(null);

    return this.apiService.post<any>('auth/login', { email, password }).pipe(
      tap(response => {
        const token = response.token ?? response.accessToken;
        this.accessToken.set(token);
        if (token) localStorage.setItem('access_token', token);
        this.currentUser.set(response.user);
        this.isAuthenticating.set(false);
      }),
      tap(
        undefined,
        () => {
          this.authError.set('Login failed. Please check your credentials.');
          this.isAuthenticating.set(false);
        }
      )
    );
  }

  /**
   * Logout
   */
  logout(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.authError.set(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
  }

  /**
   * Get current access token
   */
  getToken(): string | null {
    return this.accessToken() ?? this.readStoredToken();
  }

  private readStoredToken(): string | null {
    return localStorage.getItem('access_token')
      ?? localStorage.getItem('accessToken')
      ?? localStorage.getItem('token');
  }

  /**
   * Get current user
   */
  getCurrentUser(): any {
    return this.currentUser();
  }
}
