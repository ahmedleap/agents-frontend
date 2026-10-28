import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService market movers', () => {
  let service: DashboardService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: {
          clientId: () => 'client-123',
          currentUser: () => ({ clientId: 'client-123', role: 'CLIENT' }),
          getToken: () => 'test-token'
        } }
      ]
    });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
    // Run effects so toObservable(clientId) emits and the dashboard request is sent
    TestBed.tick();
  });

  afterEach(() => http.verify());

  it('maps the authenticated endpoint response and ignores summary movers', () => {
    expect(service.moversLoading()).toBeTrue();
    const request = http.expectOne(`${environment.backendUrl}/instruments/market-movers`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({
      marketMovers: [
        { ticker: 'A', price: 173.755, changePercent: -5 },
        { ticker: 'AAPL', price: 347.61, changePercent: 4 },
        { ticker: 'ABBV', price: 284.71, changePercent: -3 },
        { ticker: 'ABNB', price: 175.31, changePercent: 2 },
        { ticker: 'ABT', price: 102.6, changePercent: -1 }
      ],
      asOf: '2026-10-22T21:14:28.125416Z',
      refreshedAt: '2026-10-22T21:14:28.125416Z',
      isStale: false
    });
    http.expectOne(request => request.url === `${environment.backendUrl}/dashboard`).flush({ marketMovers: [] });

    expect(service.movers().length).toBe(5);
    expect(service.movers()[0]).toEqual({ ticker: 'A', price: 173.755, changePct: -5 });
    expect(service.movers()[1]).toEqual({ ticker: 'AAPL', price: 347.61, changePct: 4 });
    expect(service.moversLoading()).toBeFalse();
    expect(service.moversError()).toBeNull();
  });

  it('keeps the dashboard usable when the movers endpoint fails', () => {
    http.expectOne(`${environment.backendUrl}/instruments/market-movers`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    http.expectOne(request => request.url === `${environment.backendUrl}/dashboard`).flush({});

    expect(service.movers()).toEqual([]);
    expect(service.moversLoading()).toBeFalse();
    expect(service.moversError()).toBe('Market movers are temporarily unavailable.');
    expect(service.error()).toBeNull();
    expect(service.loading()).toBeFalse();
  });

  it('handles an empty market movers response', () => {
    http.expectOne(`${environment.backendUrl}/instruments/market-movers`).flush({ marketMovers: [] });
    http.expectOne(request => request.url === `${environment.backendUrl}/dashboard`).flush({});

    expect(service.movers()).toEqual([]);
    expect(service.moversLoading()).toBeFalse();
    expect(service.moversError()).toBeNull();
  });
});