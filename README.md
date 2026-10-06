# Trading Service Angular Frontend

## Project Structure

### Root Level Files

- **package.json** - Lists all dependencies and npm scripts
- **angular.json** - Angular CLI configuration (build, serve, test settings)
- **tsconfig.json** - TypeScript compiler configuration
- **tsconfig.app.json** - TypeScript config for the application
- **tsconfig.spec.json** - TypeScript config for testing
- **.editorconfig** - Editor formatting rules (indentation, line endings)
- **.gitignore** - Files to ignore in version control

### Source Files (src/)

- **main.ts** - Entry point that bootstraps the Angular app
- **index.html** - Main HTML file (contains `<app-root>` tag)
- **styles.scss** - Global styles applied to entire application

### Application Files (src/app/)

- **app.module.ts** - Root module that declares components and imports other modules
- **app-routing.module.ts** - Application routing configuration
- **app.component.ts** - Root component (TypeScript logic)
- **app.component.html** - Root component template (HTML)
- **app.component.scss** - Root component styles

### Environment Files (src/environments/)

- **environment.ts** - Development configuration (local API endpoints)
- **environment.prod.ts** - Production configuration (live API endpoints)

## Getting Started

1. Install dependencies: `npm install`
2. Start dev server: `npm start`
3. Build for production: `npm build`
4. Run tests: `npm test`

The app will be available at `http://localhost:4200`
