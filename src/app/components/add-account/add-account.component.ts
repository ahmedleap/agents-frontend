import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AccountApiService } from '../../core/services/account-api.service';

// Common account types, offered as tiles; picking one fills in the name, which stays editable
const ACCOUNT_TYPES: { name: string; label?: string; badge: string; blurb: string }[] = [
  { name: 'Individual Brokerage', label: 'Brokerage', badge: 'BRK', blurb: 'Flexible, taxable investing' },
  { name: 'Roth IRA', badge: 'ROTH', blurb: 'Tax-free growth for retirement' },
  { name: 'Traditional IRA', badge: 'IRA', blurb: 'Tax-deferred retirement savings' },
  { name: '401k', badge: '401k', blurb: 'Roll over an employer plan' },
  { name: '529 Plan', badge: '529', blurb: 'Save for education' },
  { name: 'HSA', badge: 'HSA', blurb: 'Tax-advantaged health savings' }
];

const QUICK_AMOUNTS = [500, 1_000, 5_000, 10_000];

@Component({
  selector: 'app-add-account',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe],
  templateUrl: './add-account.component.html',
  styleUrls: ['./add-account.component.scss']
})
export class AddAccountComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly accountApi = inject(AccountApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly accountTypes = ACCOUNT_TYPES;
  protected readonly quickAmounts = QUICK_AMOUNTS;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    // Backend requires a positive initial cash balance
    initialCashBalance: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(1_000_000_000)]]
  });

  private readonly name = toSignal(this.form.controls.name.valueChanges, { initialValue: '' });
  private readonly amount = toSignal(this.form.controls.initialCashBalance.valueChanges, { initialValue: null });

  /** The tile matching the typed name, if any */
  protected readonly selectedType = computed(() => this.name().trim().toLowerCase());
  /** Shown once both fields look valid */
  protected readonly summary = computed(() => {
    const name = this.name().trim();
    const amount = this.amount();
    return name && amount != null && amount > 0 ? { name, amount } : null;
  });

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** True once a field has been touched (or a submit was attempted) and is invalid. */
  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected pickType(name: string): void {
    this.form.controls.name.setValue(name);
    this.form.controls.name.markAsDirty();
  }

  protected pickAmount(amount: number): void {
    this.form.controls.initialCashBalance.setValue(amount);
    this.form.controls.initialCashBalance.markAsDirty();
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);

    const clientId = this.auth.clientId();
    if (!clientId || this.auth.currentUser()?.role !== 'CLIENT') {
      this.saving.set(false);
      this.error.set('Sign in with a client account before adding an account.');
      return;
    }

    this.accountApi.createAccount({
      clientId,
      name: v.name.trim(),
      initialCashBalance: Math.round(v.initialCashBalance! * 100) / 100
    }).subscribe({
      next: account => this.router.navigate(['/portfolio', account.accountId]),
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      }
    });
  }
}

function errorMessage(err: HttpErrorResponse): string {
  if (err.status === 0) return "Couldn't reach the server. Check that the backend is running.";
  if (err.status === 401) return 'Your session has expired. Log in again.';
  // The backend also turns its own errors into 403, so this isn't always a permissions problem
  if (err.status === 403) return 'The server refused to add this account.';
  const detail = typeof err.error === 'object' ? err.error?.message : null;
  return detail ? `Couldn't add the account: ${detail}` : "Couldn't add the account. Try again.";
}
