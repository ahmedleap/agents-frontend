import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  host: {
    class: 'app-root'
  }
})
export class AppComponent {
  protected readonly title = signal('S.T.A.S.H');
  protected readonly subtitle = signal('Stash Your Cash');
  protected readonly appInitialized = signal(false);
  protected readonly navItems = [
    { path: '/portfolio', label: 'Portfolio' },
    { path: '/dashboard', label: 'Dashboard' }
  ];

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    console.log('App initialized:', this.title());
    this.appInitialized.set(true);
  }
}
