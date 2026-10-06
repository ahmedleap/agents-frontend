# Frontend Base Files - Alignment with Backend

## Summary of Changes

The Angular frontend has been configured to work seamlessly with the Spring Boot + MyBatis backend trading platform. All base files have been created to match the backend entity structure, API endpoints, and compliance rules.

---

## Files Created / Modified

### 1. **Core Models** (`src/app/core/models/`)

#### enums.ts
- All backend enums replicated in TypeScript
- AccountStatus, OrderStatus, OrderType
- RiskTolerance, PortfolioSizeRange
- AssetClass, TransactionType, AdminRole
- Ensures type safety across frontend

#### models.ts
- TypeScript interfaces for all backend entities
- Client, Account, Order, Holding, Instrument
- Transaction, InstrumentPrice, HistoricalSnapshot
- Admin, ApiResponse, PaginatedResponse wrappers
- Field names and types match backend exactly

### 2. **Core Services** (`src/app/core/services/`)

#### api.service.ts
- `ApiService` - Main HTTP communication layer
- Complete CRUD operations for all entities
- Endpoints match backend REST API:
  - Admin management
  - Client management
  - Account operations
  - Trading (orders, holdings)
  - Market data (instruments, prices)
  - Portfolio tracking (snapshots)
- Uses environment configuration for API URL
- Fully typed with TypeScript interfaces

#### auth.service.ts
- `AuthService` - Authentication state management
- Login/Register endpoints
- Token management (JWT + refresh token)
- Current user observable
- Methods:
  - `login(credentials)` - Authenticate user
  - `register(registration)` - Create new account
  - `logout()` - Clear session
  - `getCurrentUser()` - Get logged-in user
  - `isAuthenticated()` - Check auth status
  - `getToken()` - Retrieve JWT token
  - `refreshToken()` - Get new token

#### auth.interceptor.ts
- `AuthInterceptor` - HTTP interceptor
- Automatically adds JWT token to all requests
- Handles 401 responses with token refresh
- Prevents multiple simultaneous refresh attempts
- Transparent token refresh without user intervention

#### error.handler.ts
- `ApiErrorHandler` - Error message extraction
- Handles all HTTP status codes (400, 401, 403, 404, 500, etc.)
- Extracts field-level validation errors
- `NotificationService` - Show toasts/alerts to users
  - success(), error(), warning(), info()
  - Auto-dismissal with configurable duration
  - Store notifications in observable
- `LoadingService` - Manage loading indicators
  - Track multiple concurrent requests
  - Show/hide loading spinner
  - Request count management

### 3. **Core Guards** (`src/app/core/guards/`)

#### auth.guard.ts
- `AuthGuard` - Route protection
- Prevents access to protected routes without authentication
- Redirects to login with return URL
- Usage in routing:
  ```typescript
  { path: 'dashboard', component: Dashboard, canActivate: [AuthGuard] }
  ```

### 4. **Core Configuration** (`src/app/core/`)

#### core.module.ts
- Centralized module for all core services
- Registers HTTP interceptor
- Provides AuthGuard for routes
- Dependency injection setup

#### constants/app.constants.ts
- `API_CONFIG` - Base URL and timeout settings
- `TRADING_RULES` - Position limits, compliance rules
  - Max 10,000 shares per instrument
  - Max 1,000,000 shares per order
  - Minimum order price: $0.01
- `RISK_PROFILES` - Investment profile descriptions
- `ASSET_CLASS_LABELS` - Display names for enums
- `ORDER_STATUS_COLORS` - UI color mapping
- `ACCOUNT_STATUS_COLORS` - Status indicators
- `COMPLIANCE_MESSAGES` - User-friendly error messages
- `VALIDATION_RULES` - Email, password, SSN patterns
- `STORAGE_KEYS` - LocalStorage key names

### 5. **Updated Files**

#### app.module.ts
- Added `HttpClientModule` import
- Added `CoreModule` import
- Ensures all services are available globally
- HTTP interceptor registered

#### environment.ts / environment.prod.ts
- API URL configured
- Development: `http://localhost:8080/api`
- Production: `https://api.trading-service.com/api` (placeholder)

### 6. **Documentation**

#### FRONTEND_ARCHITECTURE.md
- Complete architecture overview
- Backend integration details
- API endpoint documentation
- Entity models with relationships
- Compliance rules reference
- Authentication flow diagram
- Service usage examples
- Setup instructions

---

## Backend Alignment

### Entity Mapping
| Backend Java Class | Frontend TypeScript Interface | API Service Methods |
|---|---|---|
| Client | `Client` | createClient(), getClient(), getAllClients(), updateClient() |
| Account | `Account` | createAccount(), getAccount(), getClientAccounts(), updateAccount() |
| Order | `Order` | createOrder(), getOrder(), getAccountOrders(), cancelOrder() |
| Holding | `Holding` | getAccountHoldings(), getHolding() |
| Instrument | `Instrument` | createInstrument(), getInstrument(), getInstrumentByTicker() |
| InstrumentPrice | `InstrumentPrice` | getInstrumentPrices(), getCurrentPrice() |
| Transaction | `Transaction` | createTransaction(), getTransaction(), getAccountTransactions() |
| HistoricalSnapshot | `HistoricalSnapshot` | getAccountSnapshots(), getLatestSnapshot() |
| Admin | `Admin` | createAdmin(), getAdmin(), getAdminByEmail() |

### Enum Mapping
| Backend Enum | Frontend Enum | Values |
|---|---|---|
| AccountStatus | `AccountStatus` | ACTIVE, RESTRICTED, SUSPENDED, CLOSED |
| OrderStatus | `OrderStatus` | PENDING, FILLED, CANCELLED, REJECTED |
| OrderType | `OrderType` | BUY, SELL |
| AssetClass | `AssetClass` | STOCK, ETF, MUTUAL_FUND |
| RiskTolerance | `RiskTolerance` | CONSERVATIVE, MODERATE, AGGRESSIVE |
| PortfolioSizeRange | `PortfolioSizeRange` | UNDER_50K, BETWEEN_50K_100K, etc. |
| TransactionType | `TransactionType` | DEPOSIT, WITHDRAWAL |
| AdminRole | `AdminRole` | ADMIN, ANALYST |

### API Endpoints Implemented
- ✅ Admin endpoints (create, get, list, search)
- ✅ Client endpoints (create, get, list, update, search)
- ✅ Account endpoints (create, get, list, update, balance)
- ✅ Order endpoints (create, get, list, cancel)
- ✅ Holding endpoints (get account holdings, get single)
- ✅ Instrument endpoints (create, get, list, search by ticker)
- ✅ Price endpoints (get history, get current)
- ✅ Transaction endpoints (create, get, list)
- ✅ Snapshot endpoints (get history, get latest)

---

## Compliance & Rules Integration

All backend compliance rules are reflected in frontend constants:

1. **Position Limits**
   - Single instrument: Max 10,000 shares
   - Single order: Max 1,000,000 shares
   - Message: `COMPLIANCE_MESSAGES.POSITION_LIMIT_EXCEEDED`

2. **Account Requirements**
   - Account agreement acceptance required
   - KYC verification required
   - Only ACTIVE accounts can trade
   - Messages in `COMPLIANCE_MESSAGES`

3. **Validation**
   - Sufficient cash balance required
   - Order quantity must be positive integer
   - Price must be > $0.01
   - Regex patterns in `VALIDATION_RULES`

4. **Risk Management**
   - Risk tolerance profiles defined
   - Portfolio size ranges mapped
   - Asset allocation guidelines per profile

---

## Authentication Flow

1. **Login Page** (to be created)
   - User enters email + password
   - Calls `AuthService.login(credentials)`
   - Backend validates, returns JWT + user

2. **Token Storage**
   - JWT stored in localStorage
   - Refresh token stored separately
   - User object cached in localStorage

3. **Request Interception**
   - All HTTP requests intercepted
   - JWT automatically added as `Authorization: Bearer <token>`
   - Invalid token → attempt refresh
   - Refresh fails → redirect to login

4. **Protected Routes**
   - Decorated with `canActivate: [AuthGuard]`
   - Unauthenticated access redirected
   - Return URL preserved for redirect after login

---

## Service Injection Pattern

All services are provided at root level (providedIn: 'root'), making them available globally:

```typescript
// In any component
constructor(
  private apiService: ApiService,
  private authService: AuthService,
  private notificationService: NotificationService,
  private loadingService: LoadingService
) { }
```

---

## Usage Examples

### Fetching Account Data
```typescript
constructor(private apiService: ApiService) { }

ngOnInit() {
  this.apiService.getAccount('account-uuid').subscribe(
    account => console.log(account),
    error => console.error(ApiErrorHandler.getErrorMessage(error))
  );
}
```

### Placing an Order
```typescript
const order: Order = {
  orderId: generateUUID(),
  accountId: 'account-uuid',
  instrumentId: 'instrument-uuid',
  orderType: OrderType.BUY,
  quantity: 100,
  limitPrice: 150.50,
  status: OrderStatus.PENDING,
  createdAt: new Date().toISOString()
};

this.apiService.createOrder(order).subscribe(
  result => this.notificationService.success('Order placed successfully'),
  error => this.notificationService.error(ApiErrorHandler.getErrorMessage(error))
);
```

### Checking Authentication
```typescript
if (this.authService.isAuthenticated()) {
  const user = this.authService.getCurrentUser();
  console.log(`Logged in as: ${user.email}`);
}
```

### Showing Notifications
```typescript
this.notificationService.success('Account created');
this.notificationService.error('Failed to place order');
this.notificationService.warning('Position limit exceeded');
this.notificationService.info('Refreshing prices...');
```

---

## Next Steps (Module by Module)

1. **Auth Module** - Login, register, password reset
2. **Dashboard Module** - Portfolio overview, account summary
3. **Trading Module** - Order placement, order history, positions
4. **Market Module** - Instrument search, price charts, watchlist
5. **Account Module** - Profile, settings, KYC status
6. **Admin Module** - Admin dashboard, user management

Each module will use the core services and models already configured.

---

## Environment Configuration

**Development** (src/environments/environment.ts)
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api'
};
```

**Production** (src/environments/environment.prod.ts)
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.trading-service.com/api'
};
```

Build for production:
```bash
npm run build:prod
```

---

## Troubleshooting

### 401 Unauthorized
- Token expired: Interceptor automatically refreshes
- Invalid token: Redirects to login
- Check localStorage for auth tokens

### CORS Errors
- Backend must have CORS enabled
- Check backend `application.properties` for allowed origins

### API Connection Fails
- Verify backend is running on port 8080
- Check `environment.ts` API URL
- Verify network connectivity

### Type Errors
- Ensure all entity interfaces match backend
- Check enum values (case-sensitive)
- Verify model imports

---

## Performance Considerations

1. **HTTP Interceptor** - Minimal overhead, handles auth transparently
2. **Service Injection** - Singleton services at root, reused across app
3. **Observable Subscriptions** - Use `async` pipe or `unsubscribe` to avoid memory leaks
4. **Error Handling** - Centralized, prevents cascading errors
5. **Loading States** - Request counting prevents flicker

---

## Security

1. **JWT Token** - Stored in localStorage (accessible to JavaScript)
   - Production: Consider httpOnly cookies
   - Token refresh prevents long-lived tokens

2. **HTTPS** - Required in production
   - Update `environment.prod.ts` to use `https://`

3. **CORS** - Backend should validate origin
   - Frontend must be registered with backend

4. **Validation** - Frontend validation + backend validation
   - Never trust frontend validation alone

---

## Files Summary

### Total Files Created: 11
1. ✅ enums.ts
2. ✅ models.ts
3. ✅ api.service.ts
4. ✅ auth.service.ts
5. ✅ auth.interceptor.ts
6. ✅ auth.guard.ts
7. ✅ error.handler.ts
8. ✅ core.module.ts
9. ✅ app.constants.ts
10. ✅ FRONTEND_ARCHITECTURE.md
11. ✅ BACKEND_ALIGNMENT.md (this file)

### Files Modified: 2
1. ✅ app.module.ts
2. ✅ environment.ts / environment.prod.ts

---

## Ready to Build Features

The frontend is now ready to build feature modules on top of this solid base:

- ✅ Type-safe models
- ✅ Authentication
- ✅ API communication
- ✅ Error handling
- ✅ Route protection
- ✅ Constants & compliance rules
- ✅ Notification system

Begin creating feature modules in `src/app/modules/` following the same patterns!
