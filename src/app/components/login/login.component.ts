import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

export interface LoginRequest {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly showPassword = signal(false);
  protected readonly accountType = signal<'client' | 'staff'>('client');
  protected readonly isAuthenticating = this.auth.isAuthenticating;
  protected readonly serverError = signal<string | null>(null);

  /** True once a field has been touched (or a submit was attempted) and is invalid. */
  protected invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body: LoginRequest = { email: v.email.trim(), password: v.password };
    this.serverError.set(null);
    this.form.setErrors(null);

    this.auth.login(body.email, body.password, this.accountType()).subscribe({
      next: () => {
        const role = this.auth.currentUser()?.role;
        const destination = role === 'CLIENT' ? '/client'
          : role === 'ADMIN' ? '/admin'
          : '/dashboard';
        void this.router.navigateByUrl(destination);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.form.setErrors({ badCredentials: true });
        } else {
          this.serverError.set(error instanceof HttpErrorResponse && error.status === 0
            ? 'Unable to reach the backend. Check that it is running and CORS allows this app.'
            : 'Sign-in could not be completed. Please try again.');
        }
      }
    });
  }
}
