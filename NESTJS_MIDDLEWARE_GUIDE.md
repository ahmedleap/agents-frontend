# NestJS Middleware Integration Guide

**Status**: TODO - Middleware not yet built  
**Purpose**: API Gateway between Angular Frontend and Spring Boot Backend  
**Port**: 3000 (recommended)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      AGENTS OF LEAP TRADING PLATFORM             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Angular Frontend                NestJS Middleware              │
│  (Port 4200)                     (Port 3000)                    │
│  ┌──────────────────┐           ┌────────────────────┐          │
│  │ ApiService       │──HTTP────→│ Auth Guard         │          │
│  │ AuthService      │           │ Error Handler      │          │
│  │ AuthInterceptor  │←──JSON───│ Rate Limiter       │          │
│  └──────────────────┘           │ Request Logger     │          │
│                                 └────────────────────┘          │
│                                         ↓ HTTP                   │
│                                  Spring Boot Backend             │
│                                  (Port 8080)                     │
│                                  ┌────────────────────┐          │
│                                  │ Controllers        │          │
│                                  │ Services           │          │
│                                  │ MyBatis Repos      │          │
│                                  │ PostgreSQL         │          │
│                                  └────────────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Why NestJS Middleware?

### Security
- **Centralized Authentication**: Single point for JWT validation
- **Token Management**: Refresh tokens, expiration, revocation
- **Authorization**: Role-based access control before reaching backend
- **Protected Backend**: Spring Boot not exposed to frontend

### Performance
- **Request Validation**: Catch errors before reaching backend
- **Caching**: Cache frequently accessed endpoints (market data, prices)
- **Rate Limiting**: Prevent abuse and DoS attacks
- **Request Compression**: Reduce bandwidth

### Maintainability
- **Single Endpoint**: Frontend only knows about NestJS, not Spring Boot
- **Request Transformation**: Convert request/response formats if needed
- **Logging & Monitoring**: Central audit trail
- **Error Handling**: Consistent error responses

### Scalability
- **Load Balancing**: Run multiple instances behind load balancer
- **Circuit Breaker**: Gracefully handle backend failures
- **WebSocket Support**: Real-time updates for market data
- **Horizontal Scaling**: Easy to scale independently

---

## Frontend Integration Points

All frontend code is ready for middleware. Here are the integration points:

### 1. **Environment Configuration**
**File**: `src/environments/environment.ts`
```typescript
// Frontend points to NestJS middleware (port 3000), not Spring Boot
apiUrl: 'http://localhost:3000/api'
```

**Why**: Ensures all API calls go through middleware for auth/validation

### 2. **Authentication Service**
**File**: `src/app/core/services/auth.service.ts`
```typescript
login(credentials): Observable<LoginResponse> {
  // Calls NestJS /api/auth/login
  return this.http.post(`${this.apiUrl}/auth/login`, credentials);
}

register(registration): Observable<LoginResponse> {
  // Calls NestJS /api/auth/register
  return this.http.post(`${this.apiUrl}/auth/register`, registration);
}

refreshToken(): Observable<LoginResponse> {
  // Calls NestJS /api/auth/refresh
  return this.http.post(`${this.apiUrl}/auth/refresh`, { refreshToken });
}
```

**Expected NestJS Endpoints**:
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/register` - Create new account
- `POST /api/auth/refresh` - Get new access token
- `GET /api/auth/verify` - Verify token validity

### 3. **Auth Interceptor**
**File**: `src/app/core/services/auth.interceptor.ts`
```typescript
// Automatically adds JWT to all requests
intercept(request: HttpRequest, next: HttpHandler) {
  const token = this.authService.getToken();
  if (token) {
    request = request.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }
  return next.handle(request);
}
```

**NestJS Must**:
- Extract `Authorization: Bearer <token>` header
- Validate JWT signature
- Check token expiration
- Return 401 if invalid
- Add user info to request context

### 4. **API Service - All Endpoints**
**File**: `src/app/core/services/api.service.ts`

All endpoints in ApiService call NestJS middleware:
```typescript
createAdmin(admin): Observable<Admin> {
  return this.http.post(`${this.apiUrl}/admins/create`, admin);
}

getAccount(accountId): Observable<Account> {
  return this.http.get(`${this.apiUrl}/accounts/${accountId}`);
}

createOrder(order): Observable<Order> {
  return this.http.post(`${this.apiUrl}/orders`, order);
}
// ... all other endpoints
```

**NestJS Must**:
- Accept all these requests
- Validate user has permission
- Forward to appropriate Spring Boot endpoint
- Transform response if needed
- Return to frontend

### 5. **Error Handling**
**File**: `src/app/core/services/error.handler.ts`

Handles error responses from NestJS:
```typescript
static getErrorMessage(error: any): string {
  switch (error.status) {
    case 401: return 'Unauthorized. Please login again.';
    case 403: return 'Forbidden. You do not have permission.';
    case 500: return 'Server error. Please try again later.';
  }
}
```

**NestJS Must**:
- Return consistent error format
- Include meaningful error messages
- Set appropriate HTTP status codes
- Include error codes for frontend handling

---

## NestJS Middleware Endpoints Required

### Authentication Endpoints
```typescript
// AUTH ROUTES
POST   /api/auth/login         // credentials → JWT token + user
POST   /api/auth/register      // registration → JWT token + user
POST   /api/auth/refresh       // refresh token → new access token
GET    /api/auth/verify        // validate token
POST   /api/auth/logout        // invalidate token (optional)
```

### API Proxy Endpoints
NestJS should proxy/forward these to Spring Boot:
```typescript
// ADMIN
POST   /api/admins/create
GET    /api/admins/{id}
GET    /api/admins
GET    /api/admins/email/{email}

// CLIENT
POST   /api/clients
GET    /api/clients/{id}
GET    /api/clients
PUT    /api/clients/{id}
GET    /api/clients/email/{email}

// ACCOUNT
POST   /api/accounts
GET    /api/accounts/{id}
GET    /api/clients/{clientId}/accounts
PUT    /api/accounts/{id}
GET    /api/accounts/{id}/balance

// ORDER
POST   /api/orders
GET    /api/orders/{id}
GET    /api/accounts/{accountId}/orders
PUT    /api/orders/{id}/cancel

// HOLDING
GET    /api/accounts/{accountId}/holdings
GET    /api/holdings/{id}

// INSTRUMENT
POST   /api/instruments
GET    /api/instruments/{id}
GET    /api/instruments
GET    /api/instruments/ticker/{ticker}

// PRICE
GET    /api/instruments/{id}/prices
GET    /api/instruments/{id}/price/current

// TRANSACTION
POST   /api/transactions
GET    /api/transactions/{id}
GET    /api/accounts/{accountId}/transactions

// SNAPSHOT
GET    /api/accounts/{accountId}/snapshots
GET    /api/accounts/{accountId}/snapshots/latest
```

---

## Implementation Checklist

### Phase 1: Core Authentication (CRITICAL)
- [ ] Setup NestJS project with `@nestjs/common`, `@nestjs/jwt`
- [ ] Implement AuthController with login/register/refresh endpoints
- [ ] Implement JwtStrategy for token validation
- [ ] Setup JwtAuthGuard for protected routes
- [ ] Setup ErrorHandlingExceptionFilter for consistent error responses
- [ ] Test with frontend AuthService

### Phase 2: API Gateway (Core)
- [ ] Setup HttpModule for forwarding requests to Spring Boot
- [ ] Implement AdminController proxy to Spring Boot
- [ ] Implement ClientController proxy to Spring Boot
- [ ] Implement AccountController proxy to Spring Boot
- [ ] Implement OrderController proxy to Spring Boot
- [ ] Add request logging middleware
- [ ] Test all endpoints with ApiService

### Phase 3: Security & Quality
- [ ] Implement RateLimitingMiddleware
- [ ] Implement RequestValidationPipes (DTO validation)
- [ ] Implement CorsMiddleware (allow frontend origin)
- [ ] Add helmet for security headers
- [ ] Add environment configuration (.env)
- [ ] Setup .gitignore for .env, node_modules

### Phase 4: Monitoring & Operations
- [ ] Add request/response logging
- [ ] Add error tracking (Sentry recommended)
- [ ] Add health check endpoint
- [ ] Add metrics endpoint
- [ ] Setup Docker container
- [ ] Document API endpoints

### Phase 5: Advanced Features (Optional)
- [ ] WebSocket support for real-time market data
- [ ] Request caching with Redis
- [ ] Circuit breaker pattern (if Spring Boot fails)
- [ ] GraphQL layer (alternative to REST)
- [ ] API documentation (Swagger/OpenAPI)

---

## Development Setup

### Step 1: Create NestJS Project
```bash
npm install -g @nestjs/cli
nest new agents-middleware
cd agents-middleware
```

### Step 2: Install Dependencies
```bash
npm install @nestjs/common @nestjs/core @nestjs/jwt @nestjs/passport
npm install @nestjs/config @nestjs/http-client
npm install passport passport-jwt
npm install class-validator class-transformer
npm install helmet cors
npm install dotenv
```

### Step 3: Create Auth Module
```bash
nest generate module auth
nest generate service auth
nest generate controller auth
```

### Step 4: Create API Gateway Module
```bash
nest generate module gateway
nest generate service gateway
```

### Step 5: Configure Environment
Create `.env` file:
```env
# NestJS Config
NODE_ENV=development
PORT=3000

# JWT Config
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=900  # 15 minutes
REFRESH_TOKEN_EXPIRES_IN=604800  # 7 days

# Spring Boot Backend
SPRING_BOOT_URL=http://localhost:8080

# Frontend
FRONTEND_URL=http://localhost:4200
```

### Step 6: Setup Main Application
`src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  });
  
  await app.listen(3000);
}

bootstrap();
```

---

## Integration Testing with Frontend

### Test Login Flow
```bash
# 1. Start NestJS middleware on port 3000
npm start

# 2. Start Angular frontend on port 4200
cd agents-frontend
npm start

# 3. Test login in browser
# - Go to http://localhost:4200/login
# - Enter email and password
# - AuthService calls NestJS /api/auth/login
# - Token stored in localStorage
# - AuthInterceptor adds token to all requests
```

### Test API Endpoint
```bash
# 1. Authenticated request (should work with token)
GET /api/clients/client-id
Authorization: Bearer <token>

# 2. Unauthenticated request (should return 401)
GET /api/clients/client-id
# Returns: 401 Unauthorized

# 3. Invalid token (should return 401)
GET /api/clients/client-id
Authorization: Bearer invalid.token.here
# Returns: 401 Invalid token
```

---

## Error Handling Examples

### Frontend Expects These Responses

**401 - Unauthorized**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Token expired or invalid"
}
```

**400 - Bad Request**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": {
    "email": ["Email must be valid"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

**500 - Server Error**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Error details for logging"
}
```

---

## Security Best Practices

### Tokens
- ✅ Use JWT with strong secret (min 256 bits)
- ✅ Short-lived access tokens (15-30 minutes)
- ✅ Long-lived refresh tokens (7-30 days)
- ✅ Store refresh token in httpOnly cookie (production)
- ❌ Never expose Spring Boot directly to frontend

### Passwords
- ✅ Hash with bcrypt (salt rounds: 10+)
- ✅ Validate strength (min 8 chars, uppercase, number)
- ✅ Never log passwords
- ✅ Never return passwords to frontend

### Communication
- ✅ Use HTTPS in production
- ✅ Set CORS headers properly
- ✅ Add security headers (helmet middleware)
- ✅ Implement rate limiting

### Backend Communication
- ✅ NestJS to Spring Boot over HTTPS/VPC
- ✅ Validate all data before forwarding
- ✅ Never expose raw Spring Boot errors to frontend
- ✅ Log all errors for debugging

---

## Deployment Considerations

### Development
```bash
# Run locally
npm start
# Runs on http://localhost:3000
```

### Production
```bash
# Build
npm run build

# Run
npm start:prod
# Runs on port 3000

# Docker
docker build -t agents-middleware .
docker run -p 3000:3000 -e JWT_SECRET=... agents-middleware
```

### Environment Setup
- Different `.env` for development/production
- Use secrets manager for JWT_SECRET
- Configure proper CORS for production domain
- Use HTTPS only in production

---

## Middleware Checklist from Code

Frontend code includes helpful checklist in constants:
```typescript
// src/app/core/constants/app.constants.ts
MIDDLEWARE_CHECKLIST
```

This includes items to implement in each phase:
- AUTH_SERVICE - Login, register, token handling
- ROUTING - Forward requests to Spring Boot
- INTERCEPTORS - Validation, error handling, logging
- VALIDATION - Input validation before backend
- OPTIONAL_FEATURES - WebSocket, caching, GraphQL

---

## Support & Debugging

### Frontend Debugging
1. Open browser DevTools (F12)
2. Go to Network tab
3. Look for requests to `http://localhost:3000/api`
4. Check response status and body
5. Check Authorization header is being sent

### NestJS Debugging
1. Add console logs in controllers/services
2. Use VS Code debugger:
   ```json
   {
     "type": "node",
     "request": "launch",
     "program": "${workspaceFolder}/dist/main.js",
     "restart": true,
     "console": "integratedTerminal"
   }
   ```
3. Check Spring Boot logs for downstream errors
4. Verify environment variables are loaded

### Common Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| CORS Error | NestJS CORS not configured | Add `enableCors()` with frontend origin |
| 401 Unauthorized | Token missing/invalid | Check Authorization header in request |
| 401 after login | Refresh token failed | Verify JWT_SECRET is consistent |
| Requests fail | Spring Boot not running | Ensure Spring Boot is on port 8080 |
| Infinite refresh loop | isRefreshing flag issue | Check AuthInterceptor BehaviorSubject logic |

---

## Next Steps

1. **Create NestJS project** with auth module
2. **Implement login/register** endpoints
3. **Test with frontend** - use browser DevTools to verify
4. **Implement API gateway** - proxy requests to Spring Boot
5. **Add error handling** - consistent error responses
6. **Deploy & monitor** - production setup

All frontend code is ready and waiting for middleware! 🚀
