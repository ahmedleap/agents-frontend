import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

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
  private readonly baseUrl = environment.apiUrl;

  /**
   * Make a GET request
   */
  get<T>(endpoint: string, options?: any): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, options);
  }

  /**
   * Make a POST request
   */
  post<T>(endpoint: string, body: any, options?: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body, options);
  }

  /**
   * Make a PUT request
   */
  put<T>(endpoint: string, body: any, options?: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body, options);
  }

  /**
   * Make a DELETE request
   */
  delete<T>(endpoint: string, options?: any): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`, options);
  }
}
