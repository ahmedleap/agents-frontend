import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

// Matches agents-middleware LoginDto (POST /api/v1/auth/login). Not wired up yet:
// the middleware is still being tested, so submit validates the form and goes straight to the dashboard.
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
    remember: [false]
  });

  protected readonly showPassword = signal(false);

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

    this.auth.login(body.email, body.password).subscribe({
      next: () => this.router.navigate([this.auth.isAnalyst() ? '/analytics' : '/dashboard']),
      error: () => this.form.setErrors({ badCredentials: true })
    });
  }
}
