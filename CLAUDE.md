# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

The app lives in `BarbershopApp/` — all commands below are run from that directory.

## Commands

```bash
cd BarbershopApp

# Development
npx expo start           # Start dev server (press i/a/w for iOS/Android/Web)
npx expo start --ios
npx expo start --android
npx expo start --web

# Linting
npx expo lint

# Reset to blank Expo template state
npm run reset-project
```

There is no test suite configured yet.

## Architecture

**Expo Router (file-based routing)** — directory structure under `app/` maps directly to routes:
- `app/_layout.tsx` — root `Stack` navigator; declares `onboarding` as the initial screen
- `app/onboarding.tsx` — custom branded hero/welcome screen ("Flatpurse Flow")
- `app/(tabs)/` — bottom tab group (parentheses = route group, no URL segment)
- `app/(tabs)/_layout.tsx` — configures the two bottom tabs (Home, Explore) with `HapticTab` and `IconSymbol`

**Component system:**
- `components/themed-text.tsx` / `themed-view.tsx` — wrap React Native primitives; read `useThemeColor()` to adapt to light/dark mode
- `components/ui/icon-symbol.tsx` — cross-platform icon abstraction: SF Symbols on iOS (`.ios.tsx` variant), Lucide/Material icons on Android and web
- Platform-specific files use `.ios.tsx` and `.web.ts` suffixes; Expo's resolver picks the right one automatically

**Theme:**
- Color tokens live in `constants/theme.ts` (light and dark palettes)
- `hooks/use-theme-color.ts` — resolves a color key to its current-mode value
- `hooks/use-color-scheme.web.ts` — web-specific override to avoid SSR hydration mismatches

**Path alias:** `@/*` resolves to the project root (`BarbershopApp/`), configured in `tsconfig.json`.

## Key Configuration

- **New Architecture + React Compiler** are both enabled (`app.json`: `newArchEnabled: true`, `reactCompiler: true`)
- **Typed Routes** are enabled — use `href` values that match actual file paths; the router will type-check them
- Expo SDK 54, React 19, React Native 0.81, TypeScript strict mode
