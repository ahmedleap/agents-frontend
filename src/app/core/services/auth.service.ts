import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PortfolioSizeRange, RiskTolerance } from './client-api.service';

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

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  /** Optional; leave out when blank */
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
  riskTolerance: RiskTolerance;
  portfolioSizeRange: PortfolioSizeRange;
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

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

const SESSION_STORAGE_KEY = 'stash-auth-session';

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
  private refreshRequest: Observable<string> | null = null;

  // Derived state
  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticating = this.isAuthenticatingState.asReadonly();
  readonly clientId = computed(() => this.currentUserState()?.clientId ?? null);
  readonly isAuthenticated = computed(() => !!this.accessToken() && !!this.currentUserState());
  readonly hasError = computed(() => !!this.authError());
  readonly authErrorMessage = computed(() => this.authError());

  constructor() {
    this.restoreSession();
  }

  /**
   * Login with email and password
   */
  login(email: string, password: string, accountType: 'client' | 'staff'): Observable<LoginResponse> {
    this.isAuthenticatingState.set(true);
    this.authError.set(null);

    const loginPath = accountType === 'staff' ? 'auth/admin/login' : 'auth/login';
    return this.http.post<LoginResponse>(`${environment.middlewareUrl}/${loginPath}`, { email, password }).pipe(
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
        this.persistSession();
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
    return this.http.post<SignupResponse>(`${environment.middlewareUrl}/auth/signup`, request);
  }

  /** Rotates the access and refresh tokens once; concurrent 401s share this request. */
  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest) return this.refreshRequest;

    const user = this.currentUserState();
    const refreshToken = this.refreshToken();
    if (!user || !refreshToken) {
      return throwError(() => new Error('No active refresh session.'));
    }

    this.refreshRequest = this.http.post<RefreshResponse>(`${environment.middlewareUrl}/auth/refresh`, {
      clientId: user.clientId,
      refreshToken
    }).pipe(
      tap(response => {
        const claims = decodeClaims(response.accessToken);
        if (!response.accessToken || !response.refreshToken || !claims
          || claims.sub !== user.clientId || claims.email !== user.email
          || claims.role !== user.role || !Number.isFinite(claims.exp)
          || claims.exp * 1000 <= Date.now()) {
          throw new Error('The refresh response contained an invalid access token.');
        }
        this.accessToken.set(response.accessToken);
        this.refreshToken.set(response.refreshToken);
        this.persistSession();
      }),
      map(response => response.accessToken),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      }),
      finalize(() => this.refreshRequest = null),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.refreshRequest;
  }

  /**
   * Logout
   */
  logout(): void {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.currentUserState.set(null);
    this.authError.set(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  logoutRemote(): Observable<unknown> {
    const user = this.currentUserState();
    const refreshToken = this.refreshToken();
    this.logout();
    if (!user || !refreshToken) return of(null);
    return this.http.post(`${environment.middlewareUrl}/auth/logout`, {
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

  private persistSession(): void {
    const accessToken = this.accessToken();
    const refreshToken = this.refreshToken();
    const user = this.currentUserState();
    if (!accessToken || !refreshToken || !user) return;

    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ accessToken, refreshToken, user } satisfies StoredSession));
  }

  private restoreSession(): void {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return;

      const session = JSON.parse(stored) as Partial<StoredSession>;
      const claims = decodeClaims(session.accessToken);
      if (!session.accessToken || !session.refreshToken || !session.user || !claims
        || claims.sub !== session.user.clientId || claims.email !== session.user.email
        || claims.role !== session.user.role || !Number.isFinite(claims.exp)
        || claims.exp * 1000 <= Date.now() || !isRole(claims.role)) {
        this.logout();
        return;
      }

      this.accessToken.set(session.accessToken);
      this.refreshToken.set(session.refreshToken);
      this.currentUserState.set(session.user);
    } catch {
      this.logout();
    }
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
