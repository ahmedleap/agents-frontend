import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import {
  ClientApiService,
  ClientDto,
  PortfolioSizeRange,
  RiskTolerance,
  UpdateClientRequest
} from '../../core/services/client-api.service';
import { RISK_OPTIONS, SIZE_OPTIONS } from '../../core/client-profile-options';
import { Theme, ThemeService } from '../../core/services/theme.service';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; client: ClientDto };

type EditableField = 'firstName' | 'middleName' | 'lastName' | 'riskTolerance' | 'portfolioSizeRange';

// Not-blank, like the backend's @Pattern(".*\\S.*")
const NOT_BLANK = /\S/;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, NgTemplateOutlet],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly clientApi = inject(ClientApiService);
  private readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  private readonly clientId = this.auth.clientId();

  protected readonly riskOptions = RISK_OPTIONS;
  protected readonly sizeOptions = SIZE_OPTIONS;
  protected readonly themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' }
  ];

  // Only the fields the backend lets a client change
  protected readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.pattern(NOT_BLANK), Validators.maxLength(50)]],
    middleName: ['', [Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.pattern(NOT_BLANK), Validators.maxLength(50)]],
    riskTolerance: [null as RiskTolerance | null],
    portfolioSizeRange: [null as PortfolioSizeRange | null]
  });

  protected readonly state = signal<LoadState>({ status: 'loading' });
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);
  /** Fields opened with their Edit button; everything else shows as plain text */
  protected readonly editing = signal<ReadonlySet<EditableField>>(new Set());

  constructor() {
    this.load();
  }

  protected load(): void {
    const clientId = this.clientId;
    if (!clientId || this.auth.currentUser()?.role !== 'CLIENT') {
      this.state.set({ status: 'error', message: 'Sign in with a client account to view profile settings.' });
      return;
    }
    this.state.set({ status: 'loading' });
    this.clientApi.getClient(clientId).subscribe({
      next: client => {
        this.state.set({ status: 'ready', client });
        this.resetForm(client);
      },
      error: (err: HttpErrorResponse) => this.state.set({ status: 'error', message: loadError(err) })
    });
  }

  protected fullName(c: ClientDto): string {
    return [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ');
  }

  protected initials(c: ClientDto): string {
    return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  }

  protected isEditing(field: EditableField): boolean {
    return this.editing().has(field);
  }

  /** Opens one field for editing and puts the cursor in it (text fields) */
  protected edit(field: EditableField): void {
    this.saved.set(false);
    this.editing.update(set => new Set(set).add(field));
    setTimeout(() => document.getElementById(`field-${field}`)?.focus());
  }

  protected riskLabel(value: RiskTolerance | null): string {
    return RISK_OPTIONS.find(o => o.value === value)?.label ?? 'Not set';
  }

  protected sizeLabel(value: PortfolioSizeRange | null): string {
    return SIZE_OPTIONS.find(o => o.value === value)?.label ?? 'Not set';
  }

  /** True once a field has been touched (or a submit was attempted) and is invalid. */
  protected invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected cancel(): void {
    const s = this.state();
    if (s.status === 'ready') this.resetForm(s.client);
    this.saveError.set(null);
    this.editing.set(new Set());
  }

  protected save(): void {
    const s = this.state();
    const clientId = this.clientId;
    if (this.saving() || s.status !== 'ready' || !clientId) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const changes = this.changes(s.client);
    if (Object.keys(changes).length === 0) {
      this.form.markAsPristine();
      this.editing.set(new Set());
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);

    this.clientApi.updateClient(clientId, changes).subscribe({
      next: client => {
        this.saving.set(false);
        this.saved.set(true);
        this.state.set({ status: 'ready', client });
        this.resetForm(client);
        this.editing.set(new Set());
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.saveError.set(saveError(err));
      }
    });
  }

  /** Only the fields that differ from what's stored; the backend leaves the rest alone. */
  private changes(client: ClientDto): UpdateClientRequest {
    const v = this.form.getRawValue();
    const changes: UpdateClientRequest = {};
    if (v.firstName.trim() !== client.firstName) changes.firstName = v.firstName.trim();
    // "" clears the middle name
    if (v.middleName.trim() !== (client.middleName ?? '')) changes.middleName = v.middleName.trim();
    if (v.lastName.trim() !== client.lastName) changes.lastName = v.lastName.trim();
    if (v.riskTolerance && v.riskTolerance !== client.riskTolerance) changes.riskTolerance = v.riskTolerance;
    if (v.portfolioSizeRange && v.portfolioSizeRange !== client.portfolioSizeRange) {
      changes.portfolioSizeRange = v.portfolioSizeRange;
    }
    return changes;
  }

  private resetForm(c: ClientDto): void {
    this.form.reset({
      firstName: c.firstName ?? '',
      middleName: c.middleName ?? '',
      lastName: c.lastName ?? '',
      riskTolerance: c.riskTolerance,
      portfolioSizeRange: c.portfolioSizeRange
    });
  }
}

function loadError(err: HttpErrorResponse): string {
  if (err.status === 0) return "Couldn't reach the server. Check that the backend is running.";
  if (err.status === 401) return 'Your session has expired. Log in again.';
  if (err.status === 403) return "You don't have access to this profile.";
  if (err.status === 404) return "We couldn't find your profile.";
  return `The server returned ${err.status} while loading your profile.`;
}

function saveError(err: HttpErrorResponse): string {
  if (err.status === 0) return "Couldn't reach the server. Check that the backend is running.";
  if (err.status === 401) return 'Your session has expired. Log in again.';
  if (err.status === 403) return "You don't have permission to change this profile.";
  const detail = typeof err.error === 'object' ? err.error?.message : null;
  return detail ? `Couldn't save: ${detail}` : "Couldn't save your changes. Try again.";
}
