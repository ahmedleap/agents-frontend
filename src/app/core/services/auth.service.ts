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
  private readonly accessToken = signal<string | null>(null);
  private readonly currentUser = signal<any | null>(null);
  private readonly isAuthenticating = signal(false);
  private readonly authError = signal<string | null>(null);

  // Derived state
  readonly isAuthenticated = computed(() => !!this.accessToken() && !!this.currentUser());
  readonly hasError = computed(() => !!this.authError());
  readonly authErrorMessage = computed(() => this.authError());

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<any> {
    this.isAuthenticating.set(true);
    this.authError.set(null);

    return this.apiService.post('auth/login', { email, password }).pipe(
      tap(response => {
        this.accessToken.set(response.token);
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
  }

  /**
   * Get current access token
   */
  getToken(): string | null {
    return this.accessToken();
  }

  /**
   * Get current user
   */
  getCurrentUser(): any {
    return this.currentUser();
  }
}
