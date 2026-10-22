import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface RequestOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?: Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
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
  private readonly baseUrl = `${environment.backendBaseUrl}/api`;

  private withAuth(options?: RequestOptions): RequestOptions | undefined {
    const token = sessionStorage.getItem('access_token');
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
    const url = endpoint.startsWith('http') || endpoint.startsWith('/')
      ? endpoint
      : `${this.baseUrl}/${endpoint}`;
    return this.http.get<T>(url, this.withAuth(options));
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
   * Make a DELETE request
   */
  delete<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, this.withAuth(options));
  }
}
