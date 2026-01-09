# Contributing to Gestoo

Thank you for your interest in contributing to Gestoo! This document provides guidelines and best practices for contributing to the project.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Code Style Guide](#code-style-guide)
4. [Git Workflow](#git-workflow)
5. [Pull Request Process](#pull-request-process)
6. [Testing Requirements](#testing-requirements)
7. [Documentation](#documentation)

---

## Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** 20.x or higher
- **pnpm** 8.x or higher
- **Docker** and Docker Compose
- **Supabase CLI**
- **Git**

### Initial Setup

1. **Clone the repository**

```bash
git clone https://github.com/your-org/gestoo.git
cd gestoo
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment files**

```bash
# Web apps
cp apps/web-landlord/.env.example apps/web-landlord/.env.local
cp apps/web-admin/.env.example apps/web-admin/.env.local

# Services
cp services/chatbot-service/.env.example services/chatbot-service/.env
```

4. **Start Supabase locally**

```bash
pnpm supabase:start
```

5. **Run migrations**

```bash
pnpm supabase:migrate
```

6. **Start development servers**

```bash
# Start all apps
pnpm dev

# Or start specific apps
pnpm --filter @gestoo/web-landlord dev
pnpm --filter @gestoo/web-admin dev
pnpm --filter @gestoo/chatbot-service dev
```

### Development URLs

| Service | URL |
|---------|-----|
| Web Landlord | http://localhost:3000 |
| Web Admin | http://localhost:3001 |
| Chatbot Service | http://localhost:4000 |
| Supabase Studio | http://localhost:54323 |

### Useful Commands

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Formatting
pnpm format

# Run tests
pnpm test

# Build all apps
pnpm build

# Clean build artifacts
pnpm clean

# Reset database
pnpm supabase:reset
```

---

## Project Structure

```
gestoo/
├── apps/
│   ├── web-admin/           # Admin dashboard (Next.js)
│   │   ├── src/
│   │   │   ├── app/         # App router pages
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # Utilities and clients
│   │   └── package.json
│   └── web-landlord/        # Landlord portal (Next.js)
│       └── ...
├── services/
│   └── chatbot-service/     # WhatsApp bot (Node.js)
│       ├── src/
│       │   ├── flows/       # Conversation flow handlers
│       │   ├── handlers/    # HTTP route handlers
│       │   └── lib/         # Utilities
│       └── package.json
├── supabase/
│   ├── migrations/          # SQL migrations
│   └── functions/           # Edge functions (Deno)
├── packages/
│   ├── shared-types/        # TypeScript types
│   └── ui/                  # Shared UI components
├── docker/
│   └── docker-compose.yml   # Local services
└── docs/                    # Documentation
```

---

## Code Style Guide

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Define explicit types for function parameters and return values
- Use interfaces for object shapes
- Avoid `any` type - use `unknown` if type is truly unknown

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string | null;
}

function getUser(id: string): Promise<User | null> {
  // ...
}

// Bad
function getUser(id): any {
  // ...
}
```

### React Components

- Use functional components with hooks
- Use named exports
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks

```typescript
// Good
export function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="rounded-lg border p-4">
      <h3>{property.name}</h3>
    </div>
  );
}

// Bad
export default function (props) {
  return <div>{props.data.name}</div>;
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | kebab-case | `property-card.tsx` |
| Files (utilities) | kebab-case | `format-date.ts` |
| Components | PascalCase | `PropertyCard` |
| Functions | camelCase | `formatDate` |
| Constants | SCREAMING_SNAKE | `TPT_RATE_PER_NIGHT` |
| Types/Interfaces | PascalCase | `PropertyStatus` |
| Database tables | snake_case | `tax_liabilities` |
| Environment variables | SCREAMING_SNAKE | `SUPABASE_URL` |

### File Organization

```typescript
// 1. Imports (external)
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 2. Imports (internal)
import { Button } from '@gestoo/ui';
import { formatCurrency } from '@/lib/utils';

// 3. Types
interface Props {
  id: string;
}

// 4. Constants
const REFRESH_INTERVAL = 5000;

// 5. Component
export function MyComponent({ id }: Props) {
  // ...
}
```

### CSS / Styling

- Use Tailwind CSS for styling
- Follow utility-first approach
- Extract repeated patterns to components
- Use CSS variables for theming

```tsx
// Good
<button className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90">
  Submit
</button>

// Avoid inline styles
<button style={{ backgroundColor: 'blue', padding: '8px' }}>
  Submit
</button>
```

### Error Handling

- Always handle errors appropriately
- Use try-catch for async operations
- Log errors with context
- Show user-friendly error messages

```typescript
try {
  const { data, error } = await supabase
    .from('properties')
    .select('*');

  if (error) {
    console.error('Failed to fetch properties:', error);
    throw new Error('Unable to load properties');
  }

  return data;
} catch (error) {
  console.error('Unexpected error:', error);
  throw error;
}
```

---

## Git Workflow

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/guest-checkout` |
| Bug fix | `fix/description` | `fix/payment-webhook` |
| Hotfix | `hotfix/description` | `hotfix/critical-alert` |
| Chore | `chore/description` | `chore/update-deps` |
| Documentation | `docs/description` | `docs/api-reference` |

### Commit Messages

Follow the Conventional Commits specification:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(chatbot): add guest checkout flow

fix(payment): handle Wave webhook signature verification

docs(api): add endpoint documentation for generate-receipt

chore(deps): update Next.js to 14.1.0
```

### Branch Strategy

```
main (production)
  │
  └── develop (staging)
        │
        ├── feature/guest-checkout
        ├── fix/payment-webhook
        └── docs/api-reference
```

1. Create feature branches from `develop`
2. Open PR to merge into `develop`
3. After testing, `develop` is merged into `main`

---

## Pull Request Process

### Before Opening a PR

1. **Ensure your code builds**
   ```bash
   pnpm build
   ```

2. **Run linting and type checking**
   ```bash
   pnpm lint
   pnpm type-check
   ```

3. **Run tests**
   ```bash
   pnpm test
   ```

4. **Update documentation if needed**

### PR Template

When opening a PR, include:

```markdown
## Summary

Brief description of changes.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made

- Change 1
- Change 2

## Testing

Describe how you tested the changes.

## Screenshots (if applicable)

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-reviewed the code
- [ ] Added/updated tests
- [ ] Updated documentation
- [ ] No new warnings
```

### Review Process

1. At least one approval required
2. All CI checks must pass
3. No merge conflicts
4. Squash and merge preferred

---

## Testing Requirements

### Unit Tests

- Test individual functions and components
- Use Jest for JavaScript/TypeScript
- Aim for 80% coverage on critical paths

```typescript
// Example test
describe('calculateTpt', () => {
  it('calculates TPT correctly', () => {
    expect(calculateTpt(2, 3, 1000)).toBe(6000);
  });

  it('handles zero nights', () => {
    expect(calculateTpt(2, 0, 1000)).toBe(0);
  });
});
```

### Integration Tests

- Test API endpoints
- Test database operations
- Use Supabase local for testing

### E2E Tests

- Test critical user flows
- Use Playwright or Cypress
- Run before production deployments

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @gestoo/chatbot-service test

# Watch mode
pnpm test -- --watch

# Coverage
pnpm test -- --coverage
```

---

## Documentation

### Code Documentation

- Add JSDoc comments to public functions
- Document complex algorithms
- Include usage examples

```typescript
/**
 * Calculates the Tourist Promotion Tax (TPT) for a stay.
 *
 * @param numGuests - Number of guests
 * @param nights - Number of nights
 * @param ratePerNight - Rate per guest per night (default: 1000 FCFA)
 * @returns Total TPT amount in FCFA
 *
 * @example
 * const tpt = calculateTpt(2, 3);
 * // Returns 6000 (2 guests * 3 nights * 1000 FCFA)
 */
export function calculateTpt(
  numGuests: number,
  nights: number,
  ratePerNight = 1000
): number {
  return numGuests * nights * ratePerNight;
}
```

### API Documentation

- Document all endpoints in `/docs/API.md`
- Include request/response examples
- Document error codes

### User Documentation

- Keep user guides up to date
- Use clear, simple language
- Include screenshots when helpful

---

## Need Help?

- Create an issue for bugs or feature requests
- Join the development chat on Slack
- Contact the maintainers at dev@gestoo.sn

Thank you for contributing to Gestoo!
