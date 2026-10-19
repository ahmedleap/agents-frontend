import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

// Matches agents-middleware LoginDto (POST /api/v1/auth/login). Not wired up yet:
// the middleware is still being tested, so submit only validates the form.
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

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [false]
  });

  protected readonly showPassword = signal(false);
  /** The email that would be logged in, shown once the form is valid. */
  protected readonly loggedIn = signal<string | null>(null);

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

    // TODO: call AuthService.login() against agents-middleware /api/v1/auth/login once it's tested,
    // then navigate to /dashboard. On 401 show the "wrong email or password" error:
    // this.form.setErrors({ badCredentials: true }).
    this.loggedIn.set(body.email);
  }

  protected startOver(): void {
    this.loggedIn.set(null);
    this.form.reset();
  }
}
