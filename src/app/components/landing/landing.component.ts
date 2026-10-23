import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  protected scrollToAbout(event: Event): void {
    event.preventDefault();
    const section = document.getElementById('about-us');
    section?.scrollIntoView({ block: 'start' });
    section?.focus({ preventScroll: true });
  }
}