// Account and Portfolio Enums
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  RESTRICTED = 'RESTRICTED',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED'
}

export enum RiskTolerance {
  CONSERVATIVE = 'CONSERVATIVE',
  MODERATE = 'MODERATE',
  AGGRESSIVE = 'AGGRESSIVE'
}

export enum PortfolioSizeRange {
  UNDER_50K = 'UNDER_50K',
  BETWEEN_50K_100K = 'BETWEEN_50K_100K',
  BETWEEN_100K_200K = 'BETWEEN_100K_200K',
  BETWEEN_200K_500K = 'BETWEEN_200K_500K',
  OVER_500K = 'OVER_500K'
}

// Trading Enums
export enum OrderType {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

// Instrument Enums
export enum AssetClass {
  STOCK = 'STOCK',
  ETF = 'ETF',
  MUTUAL_FUND = 'MUTUAL_FUND'
}

// Transaction Enums
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL'
}

// Admin Enums
export enum AdminRole {
  ADMIN = 'ADMIN',
  ANALYST = 'ANALYST'
}
