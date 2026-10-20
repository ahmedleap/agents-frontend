import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type UserRole = 'CLIENT' | 'ADMIN' | 'ANALYST';

export interface AuthenticatedUser {
  clientId: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
  phoneNumber?: string;
  country?: string;
}

export interface SignupResponse {
  success: boolean;
  message: string;
  clientId: string;
  email: string;
}

interface JwtClaims {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
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
  private readonly refreshToken = signal<string | null>(null);
  private readonly currentUserState = signal<AuthenticatedUser | null>(null);
  private readonly isAuthenticatingState = signal(false);
  private readonly authError = signal<string | null>(null);

  // Derived state
  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticating = this.isAuthenticatingState.asReadonly();
  readonly clientId = computed(() => this.currentUserState()?.clientId ?? null);
  readonly isAuthenticated = computed(() => !!this.accessToken() && !!this.currentUserState());
  readonly hasError = computed(() => !!this.authError());
  readonly authErrorMessage = computed(() => this.authError());

  /**
   * Login with email and password
   */
  login(email: string, password: string, accountType: 'client' | 'staff'): Observable<LoginResponse> {
    this.isAuthenticatingState.set(true);
    this.authError.set(null);

    const loginPath = accountType === 'staff' ? 'auth/admin/login' : 'auth/login';
    return this.http.post<LoginResponse>(`${environment.authUrl}/${loginPath}`, { email, password }).pipe(
      tap(response => {
        const claims = decodeClaims(response.accessToken);
        if (!response.accessToken || !claims || claims.sub !== response.user?.clientId
          || claims.email !== response.user?.email || !isRole(claims.role)
          || claims.role !== response.user?.role
          || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) {
          throw new Error('The backend returned an invalid or expired login token.');
        }
        this.accessToken.set(response.accessToken);
        this.refreshToken.set(response.refreshToken);
        this.currentUserState.set({ ...response.user, role: claims.role });
      }),
      catchError(error => {
        this.accessToken.set(null);
        this.refreshToken.set(null);
        this.currentUserState.set(null);
        this.authError.set('Login failed. Please check your credentials.');
        return throwError(() => error);
      }),
      finalize(() => this.isAuthenticatingState.set(false))
    );
  }

  signup(request: SignupRequest): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${environment.authUrl}/auth/signup`, request);
  }

  /**
   * Logout
   */
  logout(): void {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.currentUserState.set(null);
    this.authError.set(null);
  }

  logoutRemote(): Observable<unknown> {
    const user = this.currentUserState();
    const refreshToken = this.refreshToken();
    this.logout();
    if (!user || !refreshToken) return of(null);
    return this.http.post(`${environment.authUrl}/auth/logout`, {
      clientId: user.clientId,
      refreshToken
    });
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
  getCurrentUser(): AuthenticatedUser | null {
    return this.currentUserState();
  }
}

function isRole(value: unknown): value is UserRole {
  return value === 'CLIENT' || value === 'ADMIN' || value === 'ANALYST';
}

/** Client-side claim decoding is for UI state only; Spring validates the signature. */
function decodeClaims(token: string | undefined): JwtClaims | null {
  try {
    const segment = token?.split('.')[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as JwtClaims;
  } catch {
    return null;
  }
}
