import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Client, Admin } from './models';

// TODO: MIDDLEWARE INTEGRATION
// NestJS Middleware handles authentication instead of directly calling Spring Boot
// 
// Current assumption: NestJS will provide these endpoints:
// POST   /api/auth/login      - Authenticate user (email + password)
// POST   /api/auth/register   - Create new user account
// POST   /api/auth/refresh    - Refresh expired JWT token
// GET    /api/auth/verify     - Verify token validity
// POST   /api/auth/logout     - Invalidate token (optional)
//
// NestJS Auth Service Should:
// 1. Accept credentials from frontend
// 2. Authenticate against Spring Boot (if Spring Boot has auth) OR maintain own user DB
// 3. Generate JWT token with appropriate claims
// 4. Return token + user object to frontend
// 5. Handle token refresh with sliding expiration
// 6. Validate all tokens before forwarding other requests
//
// Token Storage Strategy:
// - Access Token: Short-lived (15-30 min), stored in localStorage
// - Refresh Token: Long-lived (7-30 days), stored in localStorage
// - Consider httpOnly cookies in production for better security

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: Client | Admin;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dateOfBirth: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = environment.apiUrl;
  private currentUserSubject: BehaviorSubject<Client | Admin | null>;
  public currentUser$: Observable<Client | Admin | null>;
  private tokenKey = 'auth_token';
  private refreshTokenKey = 'refresh_token';
  private userKey = 'current_user';

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem(this.userKey);
    this.currentUserSubject = new BehaviorSubject<Client | Admin | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  // Login endpoint
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => this.handleAuthResponse(response))
      );
  }

  // Register endpoint
  register(registration: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/register`, registration)
      .pipe(
        tap(response => this.handleAuthResponse(response))
      );
  }

  // Logout - clears tokens and user
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
  }

  // Get current stored token
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Get refresh token
  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  // Get current user
  getCurrentUser(): Client | Admin | null {
    return this.currentUserSubject.value;
  }

  // Check if user is logged in
  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getCurrentUser();
  }

  // Refresh token
  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap(response => this.handleAuthResponse(response))
      );
  }

  // Verify token validity
  verifyToken(): Observable<boolean> {
    return this.http.get<{ valid: boolean }>(`${this.apiUrl}/auth/verify`)
      .pipe(
        map(response => response.valid)
      );
  }

  // Private helper to handle auth response
  private handleAuthResponse(response: LoginResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    if (response.refreshToken) {
      localStorage.setItem(this.refreshTokenKey, response.refreshToken);
    }
    localStorage.setItem(this.userKey, JSON.stringify(response.user));
    this.currentUserSubject.next(response.user);
  }
}
