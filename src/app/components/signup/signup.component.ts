import { Component, computed, inject, signal, viewChild } from '@angular/core';
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
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService, SignupRequest, SignupResponse } from '../../core/services/auth.service';
import { PortfolioSizeRange, RiskTolerance } from '../../core/services/client-api.service';
import { RISK_OPTIONS, SIZE_OPTIONS } from '../../core/client-profile-options';
import { AgreementDialogComponent } from '../agreement/agreement-dialog.component';
import { EyeIconComponent } from '../eye-icon/eye-icon.component';

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
  imports: [ReactiveFormsModule, RouterLink, AgreementDialogComponent, EyeIconComponent],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly minAge = MIN_AGE;
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly riskOptions = RISK_OPTIONS;
  protected readonly sizeOptions = SIZE_OPTIONS;

  protected readonly form = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      middleName: ['', [Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordStrength]],
      confirmPassword: ['', Validators.required],
      dateOfBirth: ['', [Validators.required, adultBirthDate]],
      ssn: ['', [Validators.required, validSsn]],
      // Investor profile; the middleware stores these on the new client
      riskTolerance: [null as RiskTolerance | null, Validators.required],
      portfolioSizeRange: [null as PortfolioSizeRange | null, Validators.required]
    },
    { validators: passwordsMatch }
  );

  private readonly passwordValue = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly passwordRules = computed(() => {
    const v = this.passwordValue();
    return PASSWORD_RULES.map(r => ({ label: r.label, met: r.test(v) }));
  });

  protected readonly showPassword = signal(false);
  /** Confirm password has its own eye */
  protected readonly showConfirm = signal(false);
  protected readonly showSsn = signal(false);
  protected readonly created = signal<SignupResponse | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  // Client Agreement pop-up, shown after the form is valid and before anything is sent
  private readonly agreementDialog = viewChild.required(AgreementDialogComponent);

  /** True once a field has been touched (or a submit was attempted) and is invalid. */
  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected get mismatch(): boolean {
    return this.form.hasError('mismatch') && this.form.controls.confirmPassword.touched;
  }

  /** "Create account": check the form, then ask the user to accept the Client Agreement. */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.agreementDialog().open();
  }

  /** Runs only after the Client Agreement pop-up was accepted */
  protected createAccount(): void {
    if (this.isSubmitting()) return;
    const v = this.form.getRawValue();
    const middleName = v.middleName.trim();
    // Matches agents-middleware SignupDto (POST /api/v1/auth/signup)
    const body: SignupRequest = {
      email: v.email.trim(),
      password: v.password,
      firstName: v.firstName.trim(),
      // Optional: only sent when filled in
      ...(middleName ? { middleName } : {}),
      lastName: v.lastName.trim(),
      dateOfBirth: v.dateOfBirth,
      ssn: ssnDigits(v.ssn),
      riskTolerance: v.riskTolerance!,
      portfolioSizeRange: v.portfolioSizeRange!
    };

    this.serverError.set(null);
    this.isSubmitting.set(true);
    this.auth.signup(body).subscribe({
      next: response => this.created.set(response),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          // The only unique field left on sign-up is the email
          this.form.controls.email.setErrors({ ...this.form.controls.email.errors, taken: true });
        } else if (error instanceof HttpErrorResponse && error.status === 0) {
          this.serverError.set('Unable to connect to the registration service. Check that the middleware is running at the configured address.');
        } else if (error instanceof HttpErrorResponse && error.status === 400) {
          this.serverError.set('Some registration details were rejected. Review the form and try again.');
        } else {
          this.serverError.set('Account creation failed. Please try again later.');
        }
        this.isSubmitting.set(false);
      },
      complete: () => this.isSubmitting.set(false)
    });
  }

  protected startOver(): void {
    this.created.set(null);
    this.form.reset();
  }

  protected onSsnInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatSsn(input.value);
    if (formatted !== input.value) this.form.controls.ssn.setValue(formatted);
  }

}
