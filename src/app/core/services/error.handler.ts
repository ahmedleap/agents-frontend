// Error Response Model
export interface ApiErrorResponse {
  error: string;
  message: string;
  status: number;
  timestamp: string;
  path?: string;
}

// Utility for handling API errors
export class ApiErrorHandler {

  static getErrorMessage(error: any): string {
    if (!error) {
      return 'An unexpected error occurred';
    }

    if (error.error instanceof ErrorEvent) {
      // Client-side or network error
      return error.error.message || 'Network error occurred';
    }

    if (error.status) {
      // Backend error response
      switch (error.status) {
        case 400:
          return error.error?.message || 'Bad request. Please check your input.';
        case 401:
          return 'Unauthorized. Please login again.';
        case 403:
          return 'Forbidden. You do not have permission to access this resource.';
        case 404:
          return 'Resource not found.';
        case 409:
          return error.error?.message || 'Conflict. This resource may already exist.';
        case 422:
          return error.error?.message || 'Validation error. Please check your input.';
        case 500:
          return 'Server error. Please try again later.';
        case 503:
          return 'Service unavailable. Please try again later.';
        default:
          return error.error?.message || `Error: ${error.statusText}`;
      }
    }

    return 'An unexpected error occurred';
  }

  static getFieldErrors(error: any): { [key: string]: string[] } {
    if (error.error && error.error.fieldErrors) {
      return error.error.fieldErrors;
    }
    return {};
  }
}

// Notification Service for displaying messages to users
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();
  private notificationId = 0;

  constructor(private ngZone: NgZone) { }

  success(message: string, duration: number = 3000): string {
    return this.show({ type: 'success', message, duration });
  }

  error(message: string, duration: number = 5000): string {
    return this.show({ type: 'error', message, duration });
  }

  warning(message: string, duration: number = 4000): string {
    return this.show({ type: 'warning', message, duration });
  }

  info(message: string, duration: number = 3000): string {
    return this.show({ type: 'info', message, duration });
  }

  private show(notification: Notification): string {
    const id = (++this.notificationId).toString();
    const notif: Notification = { ...notification, id };

    this.ngZone.run(() => {
      const current = this.notificationsSubject.value;
      this.notificationsSubject.next([...current, notif]);
    });

    if (notification.duration && notification.duration > 0) {
      this.ngZone.run(() => {
        setTimeout(() => this.remove(id), notification.duration);
      });
    }

    return id;
  }

  remove(id: string): void {
    const current = this.notificationsSubject.value;
    const updated = current.filter(n => n.id !== id);
    this.notificationsSubject.next(updated);
  }

  clear(): void {
    this.notificationsSubject.next([]);
  }
}

// Loading State Service for showing loading indicators
@Injectable({
  providedIn: 'root'
})
export class LoadingService {

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.loadingSubject.asObservable();
  private requestCount = 0;

  show(): void {
    this.requestCount++;
    this.loadingSubject.next(true);
  }

  hide(): void {
    this.requestCount--;
    if (this.requestCount <= 0) {
      this.requestCount = 0;
      this.loadingSubject.next(false);
    }
  }

  reset(): void {
    this.requestCount = 0;
    this.loadingSubject.next(false);
  }
}

// Type guard for API response
export function isApiErrorResponse(obj: any): obj is ApiErrorResponse {
  return obj && typeof obj === 'object' && 'error' in obj && 'status' in obj;
}
