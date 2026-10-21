import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isBackendRequest = request.url.startsWith(environment.apiUrl)
    || request.url.startsWith(environment.authUrl);
  const isAuthFlowRequest = /\/auth\/(?:admin\/)?(?:login|signup|refresh|logout)$/.test(request.url);
  const token = auth.getToken();
  const outgoing = isBackendRequest && !isAuthFlowRequest && token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(outgoing).pipe(
    catchError(error => {
      if (error.status === 401 && isBackendRequest && !isAuthFlowRequest && token) {
        return auth.refreshAccessToken().pipe(
          switchMap(refreshedToken => next(request.clone({
            setHeaders: { Authorization: `Bearer ${refreshedToken}` }
          }))),
          catchError(refreshError => {
            auth.logout();
            void router.navigate(['/login']);
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
