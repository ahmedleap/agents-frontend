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
    const user = this.currentUser();
    const tokenClaims = this.readTokenClaims();
    const roles: unknown[] = Array.isArray(user?.roles)
      ? user.roles
      : [user?.role, tokenClaims?.roles, tokenClaims?.role];
    return roles
      .flatMap(role => Array.isArray(role) ? role : [role])
      .some(role => typeof role === 'string' && role.toUpperCase().replace(/^ROLE_/, '') === 'ANALYST');
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

  private readTokenClaims(): { role?: unknown; roles?: unknown } | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): any {
    return this.currentUser();
  }
}
