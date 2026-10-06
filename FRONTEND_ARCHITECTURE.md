# Agents of Leap - Angular Frontend

Angular frontend for the Agents of Leap trading platform. This frontend is designed to work with the Spring Boot + MyBatis backend.

## Architecture Overview

### Backend Integration
- **API Service**: Communicates with `http://localhost:8080/api`
- **Authentication**: Token-based (JWT) with refresh token support
- **Models**: All TypeScript interfaces match backend Java entities
- **Enums**: All frontend enums align with backend enums

### Frontend Structure

```
src/app/
├── core/
│   ├── models/
│   │   ├── enums.ts              # All backend enums (OrderStatus, RiskTolerance, etc.)
│   │   └── models.ts             # TypeScript interfaces matching backend entities
│   │
│   ├── services/
│   │   ├── api.service.ts        # HTTP calls to backend endpoints
│   │   ├── auth.service.ts       # Login, register, token management
│   │   └── auth.interceptor.ts   # Adds auth header to requests
│   │
│   ├── guards/
│   │   └── auth.guard.ts         # Route protection for authenticated users
│   │
│   ├── constants/
│   │   └── app.constants.ts      # Trading rules, compliance settings
│   │
│   └── core.module.ts            # Dependency injection configuration
│
├── app-routing.module.ts         # Main routing (configure routes here)
├── app.component.*               # Root component
└── app.module.ts                 # Root module

```

## Backend API Endpoints (Implemented in Services)

### Admin Management
- `POST /api/admins/create` - Create admin
- `GET /api/admins/{adminId}` - Get admin
- `GET /api/admins` - List all admins
- `GET /api/admins/email/{email}` - Find by email

### Client Management
- `POST /api/clients` - Register client
- `GET /api/clients/{clientId}` - Get client
- `GET /api/clients` - List all clients
- `PUT /api/clients/{clientId}` - Update client
- `GET /api/clients/email/{email}` - Find by email

### Accounts
- `POST /api/accounts` - Create account
- `GET /api/accounts/{accountId}` - Get account
- `GET /api/clients/{clientId}/accounts` - Get client accounts
- `PUT /api/accounts/{accountId}` - Update account
- `GET /api/accounts/{accountId}/balance` - Get account balance

### Trading
- `POST /api/orders` - Place order
- `GET /api/orders/{orderId}` - Get order
- `GET /api/accounts/{accountId}/orders` - Get account orders
- `PUT /api/orders/{orderId}/cancel` - Cancel order

### Holdings & Portfolio
- `GET /api/accounts/{accountId}/holdings` - Get holdings (positions)
- `GET /api/holdings/{holdingId}` - Get single holding
- `GET /api/accounts/{accountId}/snapshots` - Get portfolio history

### Market Data
- `POST /api/instruments` - Create instrument
- `GET /api/instruments/{instrumentId}` - Get instrument
- `GET /api/instruments` - List all instruments
- `GET /api/instruments/ticker/{ticker}` - Search by ticker
- `GET /api/instruments/{instrumentId}/prices` - Price history
- `GET /api/instruments/{instrumentId}/price/current` - Latest price

## Backend Entity Models

### Client
- clientId (UUID)
- firstName, middleName, lastName
- email, passwordHash
- dateOfBirth, joinDate
- ssnLast4
- portfolioSizeRange (UNDER_50K, BETWEEN_50K_100K, etc.)
- riskTolerance (CONSERVATIVE, MODERATE, AGGRESSIVE)
- accounts (one-to-many relationship)

### Account
- accountId (UUID)
- clientId (FK)
- cashBalance (BigDecimal)
- status (ACTIVE, RESTRICTED, SUSPENDED, CLOSED)
- openDate
- orders, holdings, transactions, snapshots (relationships)

### Order
- orderId (UUID)
- accountId (FK)
- instrumentId (FK)
- orderType (BUY, SELL)
- quantity, limitPrice
- status (PENDING, FILLED, CANCELLED, REJECTED)
- createdAt, filledAt, cancelledAt

### Instrument
- instrumentId (UUID)
- ticker (stock symbol)
- name
- assetClass (STOCK, ETF, MUTUAL_FUND)
- industry
- prices, orders, holdings (relationships)

## Trading Compliance Rules

All rules are enforced by the backend. The frontend should display warnings/validations:

1. **Position Limit**: Max 10,000 shares per instrument
2. **Max Order Quantity**: 1,000,000 shares per order
3. **Cash Balance**: Must be sufficient for purchase
4. **Order Quantity**: Must be integer, > 0
5. **Account Agreement**: Must be accepted
6. **KYC Verification**: Required before trading
7. **Account Status**: Only ACTIVE accounts can trade

See `app.constants.ts` for compliance messages and rules.

## Authentication Flow

1. User logs in → `AuthService.login(credentials)`
2. Backend returns JWT token + user object
3. `AuthService` stores token in localStorage
4. `AuthInterceptor` adds token to all requests
5. If 401 response → attempt refresh token
6. If refresh fails → redirect to login

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Ensure backend is running**
   ```bash
   Backend should be available at: http://localhost:8080
   ```

3. **Start development server**
   ```bash
   npm start
   ```

4. **Backend requires**
   - PostgreSQL database (agents_of_leap)
   - Spring Boot running on port 8080
   - Schema created (see backend README)

## Key Services

### ApiService
Direct HTTP communication with backend. All CRUD operations for:
- Clients, Accounts, Orders, Holdings, Transactions
- Instruments, Prices, Snapshots
- Admins

Example:
```typescript
constructor(private apiService: ApiService) { }

getClientAccounts(clientId: string) {
  this.apiService.getClientAccounts(clientId).subscribe(
    accounts => console.log(accounts)
  );
}
```

### AuthService
Manages authentication state:
- `login()` - Authenticate user
- `register()` - Create new client account
- `logout()` - Clear tokens
- `getCurrentUser()` - Get logged-in user
- `isAuthenticated()` - Check if logged in
- `getToken()` - Get JWT token
- `refreshToken()` - Get new token

### AuthGuard
Protects routes. Add to routes to require authentication:
```typescript
{
  path: 'dashboard',
  component: DashboardComponent,
  canActivate: [AuthGuard]
}
```

## Environment Configuration

Development (`environment.ts`):
```typescript
apiUrl: 'http://localhost:8080/api'
```

Production (`environment.prod.ts`):
```typescript
apiUrl: 'https://api.trading-service.com/api'
```

## Enums & Constants

All enums match backend exactly:
- `AccountStatus` - Account state
- `OrderStatus` - Order state
- `OrderType` - BUY/SELL
- `AssetClass` - STOCK/ETF/MUTUAL_FUND
- `RiskTolerance` - CONSERVATIVE/MODERATE/AGGRESSIVE
- `TransactionType` - DEPOSIT/WITHDRAWAL
- `AdminRole` - ADMIN/ANALYST

## Next Steps

1. **Create Auth Module** - Login/Register components
2. **Create Dashboard Module** - Portfolio overview
3. **Create Trading Module** - Order placement, history
4. **Create Market Module** - Instrument search, prices
5. **Create Admin Module** - Admin dashboard
6. **Add Material Design** - UI components from Angular Material

## Testing with Backend

Use Bruno or Postman:
```
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": { "clientId": "...", "email": "...", ... }
}
```

## References

- [Backend README](../../agents-backend/README.md)
- [Compliance Rules](../../agents-backend/compliance_rules.txt)
- [Account Agreement](../../agents-backend/agreement.txt)
