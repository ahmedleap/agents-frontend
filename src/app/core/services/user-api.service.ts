import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// UserController lives at /users on the backend, not under /api
export const BACKEND_ROOT = environment.apiUrl.replace(/\/api\/?$/, '');

// Mirrors com.agentsbackend.controllers.AuthModels.UserResponse (some fields are snake_case)
export interface UserProfileDto {
  client_id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  country: string | null;
  email_verified: boolean;
  /** YYYY-MM-DD */
  date_of_birth: string | null;
  join_date: string | null;
}

/** The editable fields. The backend doesn't have an update endpoint yet; PUT /users/me is what we expect. */
export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
}

/** UserController: /users */
@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(HttpClient);

  /** The logged-in client's profile */
  getMe(): Observable<UserProfileDto> {
    return this.http.get<UserProfileDto>(`${BACKEND_ROOT}/users/me`);
  }

  updateMe(request: UpdateProfileRequest): Observable<UserProfileDto> {
    return this.http.put<UserProfileDto>(`${BACKEND_ROOT}/users/me`, request);
  }
}
