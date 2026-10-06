import { AccountStatus, RiskTolerance, PortfolioSizeRange } from './enums';

// Client Model - matches backend Client entity
export interface Client {
  clientId: string; // UUID
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  passwordHash?: string; // Don't send to frontend
  dateOfBirth: string; // ISO date format
  joinDate: string; // ISO datetime
  ssnLast4?: string; // Last 4 digits only
  portfolioSizeRange: PortfolioSizeRange;
  riskTolerance: RiskTolerance;
  accounts?: Account[];
}

// Account Model - matches backend Account entity
export interface Account {
  accountId: string; // UUID
  clientId: string; // UUID
  cashBalance: number; // BigDecimal in backend
  status: AccountStatus;
  openDate: string; // ISO datetime
  orders?: Order[];
  holdings?: Holding[];
  transactions?: Transaction[];
  snapshots?: HistoricalSnapshot[];
}

// Instrument Model - matches backend Instrument entity
export interface Instrument {
  instrumentId: string; // UUID
  ticker: string; // Stock symbol
  name: string;
  assetClass: AssetClass;
  industry?: string;
  prices?: InstrumentPrice[];
  orders?: Order[];
  holdings?: Holding[];
}

// Order Model - matches backend Order entity
export interface Order {
  orderId: string; // UUID
  accountId: string; // UUID
  instrumentId: string; // UUID
  orderType: OrderType;
  quantity: number;
  limitPrice: number;
  status: OrderStatus;
  createdAt: string; // ISO datetime
  filledAt?: string; // ISO datetime
  cancelledAt?: string; // ISO datetime
}

// Holding Model - matches backend Holding entity (portfolio positions)
export interface Holding {
  holdingId: string; // UUID
  accountId: string; // UUID
  instrumentId: string; // UUID
  quantity: number;
  averageCost: number;
  currentValue?: number; // Calculated on frontend
}

// Transaction Model - matches backend Transaction entity
export interface Transaction {
  transactionId: string; // UUID
  accountId: string; // UUID
  transactionType: TransactionType;
  amount: number;
  timestamp: string; // ISO datetime
  description?: string;
}

// InstrumentPrice Model - historical price data
export interface InstrumentPrice {
  priceId: string; // UUID
  instrumentId: string; // UUID
  price: number;
  timestamp: string; // ISO datetime
  volume?: number;
}

// HistoricalSnapshot Model - portfolio snapshots over time
export interface HistoricalSnapshot {
  snapshotId: string; // UUID
  accountId: string; // UUID
  totalValue: number;
  cashBalance: number;
  timestamp: string; // ISO datetime
}

// Admin Model - matches backend Admin entity
export interface Admin {
  adminId: string; // UUID
  firstName: string;
  lastName: string;
  email: string;
  passwordHash?: string; // Don't send to frontend
  role: AdminRole;
  createdAt: string; // ISO datetime
}

// API Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination Response
export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// Import enums
import { OrderType, OrderStatus, AssetClass, TransactionType, AdminRole } from './enums';
