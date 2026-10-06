import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Client, Account, Instrument, Order, Holding,
  Transaction, InstrumentPrice, HistoricalSnapshot,
  Admin, ApiResponse
} from './models';

/**
 * API Service - HTTP Communication Layer
 * 
 * TODO: MIDDLEWARE INTEGRATION
 * This service currently constructs API calls that will be sent to the NestJS middleware.
 * 
 * Call Flow:
 * 1. Frontend (ApiService) sends request to NestJS Middleware (port 3000)
 * 2. NestJS validates request, adds logging, checks authentication
 * 3. NestJS forwards request to appropriate Spring Boot endpoint (port 8080)
 * 4. Spring Boot processes business logic, returns response
 * 5. NestJS transforms response if needed, returns to Frontend
 * 6. Frontend receives and processes response
 * 
 * NestJS Middleware Endpoints Should Match These Patterns:
 * - GET    /api/admins/{id}
 * - POST   /api/admins/create
 * - GET    /api/clients/{id}
 * - POST   /api/clients
 * - GET    /api/accounts/{id}
 * - POST   /api/orders
 * - etc. (mirror all endpoints below)
 * 
 * Future Enhancement: Add middleware-specific features like:
 * - Circuit breaker pattern (if Spring Boot is down)
 * - Request caching for frequently accessed data
 * - GraphQL layer (optional)
 * - WebSocket support for real-time market data
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // ===== ADMIN ENDPOINTS =====

  createAdmin(admin: Admin): Observable<Admin> {
    return this.http.post<Admin>(`${this.apiUrl}/admins/create`, admin);
  }

  getAdmin(adminId: string): Observable<Admin> {
    return this.http.get<Admin>(`${this.apiUrl}/admins/${adminId}`);
  }

  getAllAdmins(): Observable<Admin[]> {
    return this.http.get<Admin[]>(`${this.apiUrl}/admins`);
  }

  getAdminByEmail(email: string): Observable<Admin> {
    return this.http.get<Admin>(`${this.apiUrl}/admins/email/${email}`);
  }

  // ===== CLIENT ENDPOINTS =====

  createClient(client: Client): Observable<Client> {
    return this.http.post<Client>(`${this.apiUrl}/clients`, client);
  }

  getClient(clientId: string): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/clients/${clientId}`);
  }

  getAllClients(): Observable<Client[]> {
    return this.http.get<Client[]>(`${this.apiUrl}/clients`);
  }

  updateClient(clientId: string, client: Partial<Client>): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/clients/${clientId}`, client);
  }

  getClientByEmail(email: string): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/clients/email/${email}`);
  }

  // ===== ACCOUNT ENDPOINTS =====

  createAccount(account: Account): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/accounts`, account);
  }

  getAccount(accountId: string): Observable<Account> {
    return this.http.get<Account>(`${this.apiUrl}/accounts/${accountId}`);
  }

  getClientAccounts(clientId: string): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.apiUrl}/clients/${clientId}/accounts`);
  }

  updateAccount(accountId: string, account: Partial<Account>): Observable<Account> {
    return this.http.put<Account>(`${this.apiUrl}/accounts/${accountId}`, account);
  }

  getAccountBalance(accountId: string): Observable<{ accountId: string; cashBalance: number }> {
    return this.http.get<{ accountId: string; cashBalance: number }>(`${this.apiUrl}/accounts/${accountId}/balance`);
  }

  // ===== INSTRUMENT ENDPOINTS =====

  createInstrument(instrument: Instrument): Observable<Instrument> {
    return this.http.post<Instrument>(`${this.apiUrl}/instruments`, instrument);
  }

  getInstrument(instrumentId: string): Observable<Instrument> {
    return this.http.get<Instrument>(`${this.apiUrl}/instruments/${instrumentId}`);
  }

  getAllInstruments(): Observable<Instrument[]> {
    return this.http.get<Instrument[]>(`${this.apiUrl}/instruments`);
  }

  getInstrumentByTicker(ticker: string): Observable<Instrument> {
    return this.http.get<Instrument>(`${this.apiUrl}/instruments/ticker/${ticker}`);
  }

  // ===== ORDER ENDPOINTS =====

  createOrder(order: Order): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/orders`, order);
  }

  getOrder(orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${orderId}`);
  }

  getAccountOrders(accountId: string): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/accounts/${accountId}/orders`);
  }

  cancelOrder(orderId: string): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/orders/${orderId}/cancel`, {});
  }

  // ===== HOLDING ENDPOINTS =====

  getAccountHoldings(accountId: string): Observable<Holding[]> {
    return this.http.get<Holding[]>(`${this.apiUrl}/accounts/${accountId}/holdings`);
  }

  getHolding(holdingId: string): Observable<Holding> {
    return this.http.get<Holding>(`${this.apiUrl}/holdings/${holdingId}`);
  }

  // ===== TRANSACTION ENDPOINTS =====

  createTransaction(transaction: Transaction): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.apiUrl}/transactions`, transaction);
  }

  getTransaction(transactionId: string): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.apiUrl}/transactions/${transactionId}`);
  }

  getAccountTransactions(accountId: string): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/accounts/${accountId}/transactions`);
  }

  // ===== INSTRUMENT PRICE ENDPOINTS =====

  getInstrumentPrices(instrumentId: string, limit?: number): Observable<InstrumentPrice[]> {
    let params = new HttpParams();
    if (limit) {
      params = params.set('limit', limit.toString());
    }
    return this.http.get<InstrumentPrice[]>(
      `${this.apiUrl}/instruments/${instrumentId}/prices`,
      { params }
    );
  }

  getCurrentPrice(instrumentId: string): Observable<InstrumentPrice> {
    return this.http.get<InstrumentPrice>(`${this.apiUrl}/instruments/${instrumentId}/price/current`);
  }

  // ===== PORTFOLIO SNAPSHOT ENDPOINTS =====

  getAccountSnapshots(accountId: string): Observable<HistoricalSnapshot[]> {
    return this.http.get<HistoricalSnapshot[]>(`${this.apiUrl}/accounts/${accountId}/snapshots`);
  }

  getLatestSnapshot(accountId: string): Observable<HistoricalSnapshot> {
    return this.http.get<HistoricalSnapshot>(`${this.apiUrl}/accounts/${accountId}/snapshots/latest`);
  }
}
