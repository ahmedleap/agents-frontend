import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  accessToken: string;
  user: { clientId: string; [key: string]: unknown };
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
}

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
  private readonly http = inject(HttpClient);

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
  login(email: string, password: string): Observable<LoginResponse> {
    this.isAuthenticating.set(true);
    this.authError.set(null);

    return this.http.post<LoginResponse>(`${environment.middlewareBaseUrl}/auth/login`, { email, password }).pipe(
      tap(response => {
        this.accessToken.set(response.accessToken);
        this.currentUser.set(response.user);
        sessionStorage.setItem('access_token', response.accessToken);
        sessionStorage.setItem('client_id', response.user.clientId);
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

  signup(request: SignupRequest): Observable<unknown> {
    return this.http.post(`${environment.middlewareBaseUrl}/auth/signup`, request);
  }

  /**
   * Logout
   */
  logout(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.authError.set(null);
    sessionStorage.clear();
  }

  /**
   * Get current access token
   */
  getToken(): string | null {
    return this.accessToken() ?? sessionStorage.getItem('access_token');
  }

  /**
   * Get current user
   */
  getCurrentUser(): any {
    return this.currentUser();
  }

  getClientId(): string | null {
    return this.currentUser()?.clientId ?? sessionStorage.getItem('client_id');
  }
}
