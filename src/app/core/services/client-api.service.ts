import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

// Mirrors com.agentsbackend.enums.RiskTolerance / PortfolioSizeRange
export type RiskTolerance = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
export type PortfolioSizeRange = 'UNDER_50K' | 'BETWEEN_50K_100K' | 'BETWEEN_100K_200K' | 'BETWEEN_200K_500K' | 'OVER_500K';

// Mirrors com.agentsbackend.DTO.response.ClientResponseDTO
export interface ClientDto {
  clientId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  riskTolerance: RiskTolerance | null;
  portfolioSizeRange: PortfolioSizeRange | null;
}

/**
 * Mirrors com.agentsbackend.DTO.requests.UpdateClientRequestDTO. Send only the fields that changed;
 * fields left out aren't touched. "" for middleName clears it. Email can't be changed here.
 */
export type UpdateClientRequest = Partial<Pick<ClientDto, 'firstName' | 'middleName' | 'lastName'>> & {
  riskTolerance?: RiskTolerance;
  portfolioSizeRange?: PortfolioSizeRange;
};

/** ClientController: /api/client/v1. The backend only allows the logged-in client's own ID. */
@Injectable({ providedIn: 'root' })
export class ClientApiService {
  private readonly api = inject(ApiService);

  getClient(clientId: string): Observable<ClientDto> {
    return this.api.get<ClientDto>(`client/v1/${clientId}`);
  }

  updateClient(clientId: string, changes: UpdateClientRequest): Observable<ClientDto> {
    return this.api.patch<ClientDto>(`client/v1/${clientId}`, changes);
  }
}
