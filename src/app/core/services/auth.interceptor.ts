import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * Auth Interceptor - Handles authentication for all HTTP requests
 * 
 * TODO: MIDDLEWARE INTEGRATION
 * This interceptor is crucial for NestJS middleware integration:
 * 
 * Flow:
 * 1. Frontend makes HTTP request
 * 2. Interceptor adds JWT token from localStorage to Authorization header
 * 3. Request sent to NestJS middleware (port 3000)
 * 4. NestJS validates token before forwarding to Spring Boot
 * 5. If token expired (401 response):
 *    - Interceptor calls AuthService.refreshToken() to get new token
 *    - Retries original request with new token
 *    - Prevents multiple simultaneous refresh attempts (using BehaviorSubject)
 * 6. If refresh fails (401 still), redirect to login page
 * 
 * NestJS Middleware Should:
 * - Extract Authorization header: "Bearer <token>"
 * - Validate JWT signature
 * - Check token expiration
 * - Return 401 if token invalid/expired
 * - Add user context to request for Spring Boot
 * 
 * Security Considerations:
 * - Tokens stored in localStorage are vulnerable to XSS
 * - Production: Use httpOnly cookies (NestJS middleware sets these)
 * - Frontend never sees httpOnly cookies, but browser sends them automatically
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor(private authService: AuthService) { }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // TODO: MIDDLEWARE INTEGRATION
    // Add JWT token to all requests destined for NestJS middleware
    // NestJS will validate token and use it to authenticate with Spring Boot
    const token = this.authService.getToken();
    if (token) {
      request = this.addToken(request, token);
    }

    return next.handle(request).pipe(
      catchError(error => {
        // TODO: MIDDLEWARE INTEGRATION
        // If NestJS middleware returns 401 (unauthorized):
        // - Access token may be expired
        // - Try to refresh using refresh token
        // - Retry request with new token
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401Error(request, next);
        } else {
          return throwError(() => error);
        }
      })
    );
  }

  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    // TODO: MIDDLEWARE INTEGRATION
    // Add JWT token to Authorization header
    // Format: "Bearer <token>"
    // NestJS middleware will extract and validate this token
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // TODO: MIDDLEWARE INTEGRATION
    // Handle token refresh when access token expires
    // 
    // Scenario 1: First 401 error
    // - Set isRefreshing = true to prevent multiple refresh attempts
    // - Call NestJS /api/auth/refresh endpoint
    // - Wait for new token
    // - Retry original request with new token
    // 
    // Scenario 2: Subsequent 401 errors during refresh
    // - Wait for first refresh to complete (using BehaviorSubject)
    // - Use the refreshed token for retry
    // - Prevents thundering herd of simultaneous refresh requests
    
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap((response: any) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(response.token);
          return next.handle(this.addToken(request, response.token));
        }),
        catchError((err) => {
          this.isRefreshing = false;
          // TODO: MIDDLEWARE INTEGRATION
          // If refresh fails, tokens are invalid
          // Clear all stored tokens and redirect to login
          // NestJS should also invalidate any sessions on its side
          this.authService.logout();
          return throwError(() => err);
        })
      );
    } else {
      // TODO: MIDDLEWARE INTEGRATION
      // Wait for ongoing refresh to complete, then retry with new token
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(token => {
          return next.handle(this.addToken(request, token));
        })
      );
    }
  }
}
