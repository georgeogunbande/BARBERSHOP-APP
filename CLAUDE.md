# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

The React Native / Expo app lives entirely inside `BarbershopApp/`. All commands below should be run from that directory.

## Commands

```bash
# Start dev server (use --offline if no internet access)
npx expo start
npx expo start --offline

# Platform-specific launchers
npx expo start --android
npx expo start --ios
npx expo start --web

# Lint
npm run lint

# Type-check (no dedicated script — use tsc directly)
npx tsc --noEmit
```

There are no tests yet. `scripts/reset-project.js` strips the app back to a blank Expo template — don't run it unless intentionally resetting.

## Architecture

**Routing — Expo Router (file-based)**
All screens live under `app/`. The router entry point is `app/_layout.tsx`, which sets `unstable_settings.anchor = 'onboarding'` to make `app/onboarding.tsx` the first screen shown. After onboarding the user is pushed to `/(tabs)`, a bottom-tab navigator defined in `app/(tabs)/_layout.tsx`.

**Theming**
`constants/theme.ts` exports `Colors` (light/dark palette) and `Fonts` (platform-specific font stacks). The hook `hooks/use-theme-color.ts` resolves a color name against the active scheme using `Colors`. Components read the scheme via `hooks/use-color-scheme.ts` (with a `.web.ts` platform override).

**Icons — dual system**
- Tab bar / system UI: `components/ui/icon-symbol.tsx` — uses SF Symbols on iOS (`expo-symbols`) and maps to Material Icons (`@expo/vector-icons`) on Android/web. To add a new icon, extend the `MAPPING` object in that file.
- Feature UI: `lucide-react-native` is installed and used directly (e.g. `Zap`, `Check` on the onboarding screen). Prefer lucide icons for in-screen UI, `IconSymbol` for navigation chrome.

**Path alias**
`@/` maps to the repo root (`BarbershopApp/`), configured in `tsconfig.json`. Use this alias for all internal imports.

**React Compiler & New Architecture**
Both are enabled (`app.json` → `experiments.reactCompiler: true`, `newArchEnabled: true`). Avoid patterns that break the compiler (manual memoisation with `useMemo`/`useCallback` is usually unnecessary).

**Platform files**
The project uses Expo's `.ios.tsx` / `.web.ts` extension convention for platform splits (e.g. `icon-symbol.ios.tsx`, `use-color-scheme.web.ts`). Metro picks the correct variant automatically.
