import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

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
      low: '#b75d0f',
      moderate: '#0a7a4b',
      healthy: '#0a7a4b'
    }[status] || '#37556f';
  });

  togglePortfolioVisibility(): void {
    console.log('Portfolio visibility toggled');
  }
}
