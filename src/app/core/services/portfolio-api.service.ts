import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// Mirrors com.agentsbackend.DTO.response.* (BigDecimal comes through as a JSON number)

export interface HoldingDto {
  holdingId: string;
  accountId: string;
  instrumentId: string;
  ticker: string;
  name: string;
  quantity: number;
  averageCostBasis: number;
  currentPrice: number;
  currentValue: number;
  gainLossDollars: number;
  gainLossPercent: number;
}

export interface AccountPortfolioDto {
  accountId: string;
  accountName: string;
  holdings: HoldingDto[];
  totalPortfolioValue: number;
  totalCostBasis: number;
  totalGainLossDollars: number;
  totalGainLossPercent: number;
}

export interface EntirePortfolioDto {
  clientId: string;
  accounts: AccountPortfolioDto[];
  totalPortfolioValue: number;
  totalCostBasis: number;
  totalGainLossDollars: number;
  totalGainLossPercent: number;
}

export interface AllocationDto {
  industryBreakdown: { industry: string; percentage: number; value: number }[];
  assetClassBreakdown: { assetClass: string; percentage: number; value: number }[];
}

/** PortfolioController: /api/portfolio/v1 */
@Injectable({ providedIn: 'root' })
export class PortfolioApiService {
  private readonly api = inject(ApiService);

  getAccountPortfolio(clientId: string, accountId: string): Observable<AccountPortfolioDto> {
    return this.api.get<AccountPortfolioDto>(`portfolio/v1/${clientId}/${accountId}`);
  }

  getEntirePortfolio(clientId: string): Observable<EntirePortfolioDto> {
    return this.api.get<EntirePortfolioDto>(`portfolio/v1/${clientId}`);
  }

  getAccountAllocation(clientId: string, accountId: string): Observable<AllocationDto> {
    return this.api.get<AllocationDto>(`portfolio/v1/allocation/${clientId}/${accountId}`);
  }

  getAllocation(clientId: string): Observable<AllocationDto> {
    return this.api.get<AllocationDto>(`portfolio/v1/allocation/${clientId}`);
  }
}
