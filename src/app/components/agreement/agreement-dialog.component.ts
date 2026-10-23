import { Component, ElementRef, output, signal, viewChild } from '@angular/core';
import { AGREEMENT_SUMMARY, AGREEMENT_TITLE, AGREEMENT_URL, AGREEMENT_VERSION } from '../../core/client-agreement';

/**
 * Customer Account Agreement pop-up. Call open(); `accepted` fires only after the user has opened the
 * full agreement, ticked the box and pressed "Agree and create account". Cancel / Esc just closes it.
 */
@Component({
  selector: 'app-agreement-dialog',
  standalone: true,
  templateUrl: './agreement-dialog.component.html',
  styleUrls: ['./agreement-dialog.component.scss']
})
export class AgreementDialogComponent {
  /** Emits the agreement version the user accepted */
  readonly accepted = output<string>();

  protected readonly title = AGREEMENT_TITLE;
  protected readonly summary = AGREEMENT_SUMMARY;
  protected readonly url = AGREEMENT_URL;
  protected readonly version = AGREEMENT_VERSION;
  protected readonly agreed = signal(false);
  /** The box can't be ticked until the full agreement link has been opened */
  protected readonly openedAgreement = signal(false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  open(): void {
    this.agreed.set(false);
    this.openedAgreement.set(false);
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected accept(): void {
    if (!this.agreed() || !this.openedAgreement()) return;
    this.close();
    this.accepted.emit(this.version);
  }
}
