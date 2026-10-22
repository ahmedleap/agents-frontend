# Agents of Leap - Angular 22+ Frontend

Modern Angular 22+ trading platform frontend built with cutting-edge technologies and best practices.

## Features

✨ **Modern Angular 22+ Stack**
- Standalone components (no NgModules)
- Signals for reactive state management
- Modern control flow (@if, @for, @switch)
- OnPush change detection by default
- inject() for dependency injection

🎨 **Architecture**
- Clean, maintainable code structure
- Proper separation of concerns
- Type-safe TypeScript with strict mode
- Responsive design with SCSS

🚀 **Performance**
- Optimized change detection
- Lazy loading for feature routes
- Tree-shaking friendly
- Production-ready build configuration

🧪 **Quality**
- TypeScript strict mode enabled
- Comprehensive type safety
- Accessibility (WCAG AA compliant)
- AXE checks pass

## Getting Started
1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm start
```

3. Open browser: http://localhost:4200

### Prerequisites
- Node.js 18+ (v20+ recommended)
- npm 9+
- Angular CLI 22+

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
# or
ng serve
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

The development server uses [proxy.conf.json](proxy.conf.json) to forward backend requests without browser CORS errors:

- `/api/*` -> `http://localhost:8081`
- `/dashboard` -> `http://localhost:8081`

If port `4200` is already in use, start on another port:

```bash
ng serve --port 4201
```

Restart the development server after changing the proxy configuration.

### Environment Configuration

Development settings are in [src/environments/environment.ts](src/environments/environment.ts). Production settings are in [src/environments/environment.prod.ts](src/environments/environment.prod.ts).

The application uses two service URLs:

- `backendUrl`: backend API base path. In development this is `/api`, so requests use the Angular proxy. In production it is the deployed backend API URL.
- `middlewareUrl`: authentication middleware URL, including `/api/v1`.

Production builds replace `environment.ts` with `environment.prod.ts` through the `fileReplacements` configuration in `angular.json`.

### Authentication and Roles

Authentication state is stored in `sessionStorage`, including the access and refresh tokens. Closing the browser session ends the client session.

Routes are role-protected:

- `CLIENT`: `/client` and client account workflows
- `ANALYST`: `/dashboard`
- `ADMIN`: `/admin`

Unauthenticated users are redirected to `/login`. Authenticated users visiting `/login` or `/signup` are redirected to their role home page. A user attempting to access a different role's route is redirected without clearing the active session.

### Dashboard Backend Contract

The client dashboard requests:

```text
GET /dashboard?clientId=<client-uuid>&period=30D
```

The request is proxied locally and authenticated with the current access token. The response supplies accounts, market movers, watchlist entries, recent trades, portfolio history, and aggregate P/L values. The dashboard does not invent missing backend values; unsupported fields are displayed as unavailable.

To verify the UI is using the backend, open browser DevTools, select **Network**, reload `/client`, and inspect the `dashboard?clientId=...&period=30D` request. It should return `200` and its response values should match the dashboard.

### Build

```bash
npm run build
# for production
npm run build:prod
```

The build artifacts will be stored in the `dist/` directory.

## Project Structure

```
src/
├── app/
│   ├── components/          # Standalone components
│   │   └── dashboard/
│   ├── core/                # Core services & utilities
│   │   └── services/
│   ├── app.routes.ts        # Application routes
│   └── app.component.*      # Root component
├── environments/            # Environment configuration
│   ├── environment.ts       # Development
│   └── environment.prod.ts  # Production
├── styles.scss              # Global styles
├── main.ts                  # Bootstrap file
└── index.html               # HTML template
```

## Modern Angular Patterns

### Signals & Computed State
```typescript
protected readonly count = signal(0);
protected readonly doubled = computed(() => this.count() * 2);
```

### Standalone Components
```typescript
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule],
  // ...
})
```

### Dependency Injection
```typescript
@Injectable({ providedIn: 'root' })
export class MyService {
  private readonly http = inject(HttpClient);
}
```

### Modern Control Flow
```html
@if (condition) {
  <div>True case</div>
} @else {
  <div>False case</div>
}

@for (item of items(); track item.id) {
  <div>{{ item.name }}</div>
}
```

## Testing

```bash
npm run test
```

The repository also includes Playwright end-to-end tests:

```bash
npm run e2e
```

## Linting

```bash
npm run lint
```

## Technology Stack

- **Angular 22+** - Framework
- **TypeScript 5.5+** - Language
- **RxJS 7.8+** - Reactive programming
- **SCSS** - Styling
- **Karma** - Test runner
- **Jasmine** - Testing framework

## Best Practices

- ✅ Strict TypeScript compilation
- ✅ Standalone components only
- ✅ Signals for state management
- ✅ Type-safe forms & validation
- ✅ Lazy loading for routes
- ✅ Performance optimized
- ✅ Accessibility compliant (WCAG AA)
- ✅ Clean code principles

## Contributing

Follow the Angular style guide: https://angular.dev/style-guide

## License

Proprietary - Agents of Leap
