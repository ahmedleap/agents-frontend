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
