import { PortfolioSizeRange, RiskTolerance } from './services/client-api.service';

// Choices for a client's investor profile, shared by sign-up and settings.
// Values match the clients.risk_tolerance / clients.portfolio_size_range Postgres enums.

export const RISK_OPTIONS: readonly { value: RiskTolerance; label: string; blurb: string }[] = [
  { value: 'CONSERVATIVE', label: 'Conservative', blurb: 'Protect what I have' },
  { value: 'MODERATE', label: 'Moderate', blurb: 'Balance growth and risk' },
  { value: 'AGGRESSIVE', label: 'Aggressive', blurb: 'Maximize growth' }
];

export const SIZE_OPTIONS: readonly { value: PortfolioSizeRange; label: string }[] = [
  { value: 'UNDER_50K', label: 'Under $50K' },
  { value: 'BETWEEN_50K_100K', label: '$50K – $100K' },
  { value: 'BETWEEN_100K_200K', label: '$100K – $200K' },
  { value: 'BETWEEN_200K_500K', label: '$200K – $500K' },
  { value: 'OVER_500K', label: 'Over $500K' }
];
