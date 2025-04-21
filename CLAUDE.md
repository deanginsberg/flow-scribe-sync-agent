# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Code Style
- React functional components with arrow function syntax
- Props interfaces defined at top of files as `interface ComponentNameProps {}`
- Tailwind for styling with `cn()` utility from utils.ts
- Import paths use @ alias for src directory (e.g., `@/components/ui/button`)
- Group imports by: React first, then UI components, then utilities
- Error handling: try/catch for async operations, toast notifications for user feedback
- TypeScript: Less strict config (noImplicitAny: false, strict: false)
- Prefer named exports for components

## File Organization
- UI components: src/components/ui/
- Custom components: src/components/
- API clients: src/lib/
- Pages: src/pages/
- Custom hooks: src/hooks/