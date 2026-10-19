import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';

// Matches agents-middleware SignupDto (POST /api/v1/auth/signup). Not wired up yet:
// the middleware is still being tested, so submit only validates and previews the payload.
export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  /** US number, 10 digits, no +1 or punctuation, e.g. 2025550123 */
  phoneNumber: string;
  /** 9 digits, no dashes. Not in the middleware's SignupDto yet - it needs adding there. */
  ssn: string;
}

// Same rules as agents-middleware validatePassword()
const PASSWORD_RULES = [
  { label: '8+ characters', test: (v: string) => v.length >= 8 },
  { label: 'Lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v: string) => /\d/.test(v) },
  { label: 'Special (@$!%*?&)', test: (v: string) => /[@$!%*?&]/.test(v) }
];

const MIN_AGE = 18;

const ssnDigits = (v: string) => (v ?? '').replace(/\D/g, '');
const phoneDigits = (v: string) => (v ?? '').replace(/\D/g, '');

/** (202) 555-0123 as the user types */
const formatPhone = (v: string) => {
  const d = phoneDigits(v).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

// US numbers: 10 digits; area code and exchange can't start with 0 or 1
const validPhone: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const d = phoneDigits(c.value);
  if (!d) return null;
  if (d.length !== 10) return { phoneLength: true };
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? null : { phoneInvalid: true };
};

/** XXX-XX-XXXX as the user types */
const formatSsn = (v: string) => {
  const d = ssnDigits(v).slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
};

// SSA rules: 9 digits; area not 000, 666 or 900-999; group not 00; serial not 0000
const validSsn: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const d = ssnDigits(c.value);
  if (!d) return null;
  if (d.length !== 9) return { ssnLength: true };
  const area = d.slice(0, 3), group = d.slice(3, 5), serial = d.slice(5);
  const invalid = area === '000' || area === '666' || area[0] === '9' || group === '00' || serial === '0000';
  return invalid ? { ssnInvalid: true } : null;
};

const passwordStrength: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  PASSWORD_RULES.every(r => r.test(c.value ?? '')) ? null : { weakPassword: true };

const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const { password, confirmPassword } = group.value;
  return confirmPassword && password !== confirmPassword ? { mismatch: true } : null;
};

const adultBirthDate: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  if (!c.value) return null;
  const dob = new Date(`${c.value}T00:00:00`);
  if (Number.isNaN(dob.getTime()) || dob > new Date()) return { invalidDate: true };
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - MIN_AGE);
  return dob > cutoff ? { tooYoung: true } : null;
};

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly minAge = MIN_AGE;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly form = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordStrength]],
      confirmPassword: ['', Validators.required],
      dateOfBirth: ['', [Validators.required, adultBirthDate]],
      phoneNumber: ['', [Validators.required, validPhone]],
      ssn: ['', [Validators.required, validSsn]]
    },
    { validators: passwordsMatch }
  );

  private readonly passwordValue = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly passwordRules = computed(() => {
    const v = this.passwordValue();
    return PASSWORD_RULES.map(r => ({ label: r.label, met: r.test(v) }));
  });

  protected readonly showPassword = signal(false);
  protected readonly showSsn = signal(false);
  /** The request body that would be sent, shown once the form is valid. */
  protected readonly created = signal<SignupRequest | null>(null);

  /** True once a field has been touched (or a submit was attempted) and is invalid. */
  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected get mismatch(): boolean {
    return this.form.hasError('mismatch') && this.form.controls.confirmPassword.touched;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body: SignupRequest = {
      email: v.email.trim(),
      password: v.password,
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      dateOfBirth: v.dateOfBirth,
      phoneNumber: phoneDigits(v.phoneNumber),
      ssn: ssnDigits(v.ssn)
    };

    // TODO: POST to agents-middleware /api/v1/auth/signup once it's tested.
    // Handle 409 (email taken) with this.form.controls.email.setErrors({ taken: true }).
    this.created.set(body);
  }

  protected startOver(): void {
    this.created.set(null);
    this.form.reset();
  }

  protected onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatPhone(input.value);
    if (formatted !== input.value) this.form.controls.phoneNumber.setValue(formatted);
  }

  protected onSsnInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatSsn(input.value);
    if (formatted !== input.value) this.form.controls.ssn.setValue(formatted);
  }

  /** Payload preview with the password and all but the last 4 SSN digits masked. */
  protected preview(body: SignupRequest): string {
    return JSON.stringify({
      ...body,
      password: '•'.repeat(body.password.length),
      ssn: `•••••${body.ssn.slice(-4)}`
    }, null, 2);
  }
}
