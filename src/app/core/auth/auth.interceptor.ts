import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isBackendRequest = request.url.startsWith(environment.apiUrl)
    || request.url.startsWith(environment.authUrl);
  const isLoginRequest = /\/auth\/(?:admin\/)?login$/.test(request.url);
  const token = auth.getToken();
  const outgoing = isBackendRequest && !isLoginRequest && token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError(error => {
      if (error.status === 401 && isBackendRequest && !isLoginRequest) {
        auth.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
