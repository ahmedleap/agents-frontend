import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

/**
 * Root component for the Agents of Leap Trading Platform
 * 
 * Modern Angular 22+ Standalone Component with:
 * - Signals for reactive state management
 * - Built-in control flow (@if, @for, @switch)
 * - No NgModule required
 * - OnPush change detection by default (Angular 22+)
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  host: {
    class: 'app-root'
  }
})
export class AppComponent {
  protected readonly title = signal('Agents of Leap');
  protected readonly appInitialized = signal(false);

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    // Initialize application
    console.log('App initialized:', this.title());
    this.appInitialized.set(true);
  }
}
