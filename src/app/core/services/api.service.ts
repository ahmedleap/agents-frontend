import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

/** JSON-body request options (keeps HttpClient on its typed-body overload). */
export interface RequestOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?: HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
}

/**
 * API Service
 * 
 * Modern Angular 22+ Service using:
 * - inject() for dependency injection (no constructor needed)
 * - Standalone service pattern (providedIn: 'root')
 * - Type-safe HTTP requests
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.backendUrl;

  private withAuth(options?: RequestOptions): RequestOptions | undefined {
    const token = this.auth.getToken();
    if (!token) return options;

    const headers = options?.headers instanceof HttpHeaders
      ? options.headers.set('Authorization', `Bearer ${token}`)
      : new HttpHeaders({
          ...(options?.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${token}`
        });

    return { ...options, headers };
  }

  /**
   * Make a GET request
   */
  get<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, this.withAuth(options));
  }

  /**
   * Make a POST request
   */
  post<T>(endpoint: string, body: any, options?: RequestOptions): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body, this.withAuth(options));
  }

  /**
   * Make a PUT request
   */
  put<T>(endpoint: string, body: any, options?: RequestOptions): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body, this.withAuth(options));
  }

  /**
   * Make a PATCH request
   */
  patch<T>(endpoint: string, body: unknown, options?: RequestOptions): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}/${endpoint}`, body, this.withAuth(options));
  }

  /**
   * Make a DELETE request
   */
  delete<T>(endpoint: string, options?: RequestOptions, body?: unknown): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, { ...this.withAuth(options), body });
  }
}
