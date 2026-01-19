# TypeScript/React Conventions

## Build Commands

```bash
cd frontend
npm install

# Development
npm run dev

# Production
npm run build
npm run preview

# Quality
npm run lint
npx tsc --noEmit

# Desktop (optional)
npm run electron:dev
npm run electron:build
```

## Code Style

**Imports**:
- React imports first: `import React from 'react'`
- Third-party packages next: `import { useQuery } from '@tanstack/react-query'`
- Relative imports last: `import { Avatar } from '../components'`
- Sort imports alphabetically within groups

**Naming**:
- Components: PascalCase (`UserAvatar`, `ChatList`)
- Functions/variables: camelCase (`fetchUsers`, `userName`)
- Types/Interfaces: PascalCase (`UserProps`, `ApiResponse`)
- Constants: UPPER_SNAKE_CASE only for truly global constants

**Type Definitions**:
- Define explicit interfaces for props
- Use `React.FC<Props>` for functional components
- Prefer `interface` over `type` for object shapes
- Use `type` for unions, primitives, and utility types

**React Patterns**:
- Use functional components with hooks
- Prefer `useState` over `useReducer` for simple state
- Use custom hooks for reusable logic
- Use `useMemo`/`useCallback` for expensive computations
- Key lists properly with stable identifiers

**State Management**:
- Use Zustand for global state
- Use TanStack Query for server state (caching, refetching)
- Keep component state local when possible
- Avoid prop drilling (use Context or Zustand)

**Styling**:
- Use Tailwind CSS v4 utility classes
- Prefer `className` over `style` prop
- Use design-system components when available
- Responsive-first approach: `md:w-1/2`, `lg:flex-row`
- Use `cn()` utility for conditional classes

**Error Handling**:
- Handle async errors in try/catch blocks
- Display user-friendly error messages
- Log errors to console in development
- Show toast notifications for user feedback