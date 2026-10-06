import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Dashboard Component
 * 
 * Modern Angular 22+ Standalone Component demonstrating:
 * - Signals for state management
 * - Computed signals for derived state
 * - Modern control flow
 */
@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule],
  host: {
    class: 'dashboard-component'
  }
})
export class DashboardComponent {
  protected readonly portfolioValue = signal(150000);
  protected readonly accountBalance = signal(25000);
  protected readonly holdingsCount = signal(12);
  
  protected readonly accountStatus = computed(() => {
    const balance = this.accountBalance();
    if (balance < 10000) return 'low';
    if (balance < 50000) return 'moderate';
    return 'healthy';
  });

  protected readonly statusColor = computed(() => {
    const status = this.accountStatus();
    return {
      'low': '#ff6b6b',
      'moderate': '#ffd43b',
      'healthy': '#51cf66'
    }[status] || '#666';
  });

  togglePortfolioVisibility(): void {
    // Component method example
    console.log('Portfolio visibility toggled');
  }
}
