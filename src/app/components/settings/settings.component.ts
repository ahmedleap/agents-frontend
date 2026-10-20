import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Theme, ThemeService } from '../../core/services/theme.service';
import { UserApiService, UserProfileDto } from '../../core/services/user-api.service';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: UserProfileDto };

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly userApi = inject(UserApiService);
  protected readonly theme = inject(ThemeService);

  protected readonly themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' }
  ];

  protected readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    // Digits with optional +, spaces, dashes, dots and brackets, e.g. (202) 555-0123 or +44 20 7946 0958
    phone: ['', [Validators.pattern(/^[+\d(][\d\s().-]{6,19}$/)]],
    country: ['', [Validators.maxLength(56)]]
  });

  protected readonly state = signal<LoadState>({ status: 'loading' });
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    this.userApi.getMe().subscribe({
      next: profile => {
        this.state.set({ status: 'ready', profile });
        this.resetForm(profile);
      },
      error: (err: HttpErrorResponse) => this.state.set({ status: 'error', message: loadError(err) })
    });
  }

  /** True once a field has been touched (or a submit was attempted) and is invalid. */
  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected cancel(): void {
    const s = this.state();
    if (s.status === 'ready') this.resetForm(s.profile);
  }

  protected save(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);

    this.userApi.updateMe({
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      country: v.country.trim()
    }).subscribe({
      next: profile => {
        this.saving.set(false);
        this.saved.set(true);
        this.state.set({ status: 'ready', profile });
        this.resetForm(profile);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.status === 409) this.form.controls.email.setErrors({ taken: true });
        this.saveError.set(saveError(err));
      }
    });
  }

  private resetForm(p: UserProfileDto): void {
    this.form.reset({
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      email: p.email ?? '',
      phone: p.phone ?? '',
      country: p.country ?? ''
    });
  }
}

function loadError(err: HttpErrorResponse): string {
  if (err.status === 0) return "Couldn't reach the server, or it blocked the request (CORS). Check that the backend is running.";
  if (err.status === 401) return 'Your session has expired. Log in again.';
  return `The server returned ${err.status} while loading your profile.`;
}

function saveError(err: HttpErrorResponse): string {
  if (err.status === 0) return "Couldn't reach the server, or it blocked the request (CORS).";
  if (err.status === 401) return 'Your session has expired. Log in again.';
  if (err.status === 404 || err.status === 405) return "The server can't save profile changes yet.";
  if (err.status === 409) return 'That email is already used by another account.';
  const detail = typeof err.error === 'object' ? err.error?.message : null;
  return detail ? `Couldn't save: ${detail}` : "Couldn't save your changes. Try again.";
}
