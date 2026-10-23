import { HttpClient } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AgreementDocument, parseAgreement } from '../../core/agreement-parser';
import { AGREEMENT_TEXT_URL } from '../../core/client-agreement';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; doc: AgreementDocument };

/**
 * Full Customer Account Agreement, linked from the sign-up pop-up (opens in a new tab).
 * Public: no login needed. The text comes from src/assets/agreement.txt.
 */
@Component({
  selector: 'app-agreement',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './agreement.component.html',
  styleUrls: ['./agreement.component.scss']
})
export class AgreementComponent {
  protected readonly textUrl = AGREEMENT_TEXT_URL;

  protected readonly state = toSignal(
    inject(HttpClient).get(AGREEMENT_TEXT_URL, { responseType: 'text' }).pipe(
      map((text): LoadState => ({ status: 'ready', doc: parseAgreement(text) })),
      catchError(() => of<LoadState>({ status: 'error' }))
    ),
    { initialValue: { status: 'loading' } as LoadState }
  );

  protected readonly doc = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.doc : null;
  });

  /** Jump to a section without changing the route (the page has no router fragment scrolling) */
  protected scrollTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected metaLabel(label: string): string {
    return label.charAt(0) + label.slice(1).toLowerCase();
  }
}
