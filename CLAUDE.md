# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lemon Sales Manager** — a mobile-first React TypeScript SPA for tracking lemon business inventory, sales, spoilage, and shrinkage. The UI is in Indonesian (Bahasa Indonesia) with IDR currency formatting.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build → dist/
npm run lint         # TypeScript type-check (tsc --noEmit)
npm run preview      # Preview the production build
npm run clean        # Remove dist/
```

There is no test framework configured. `npm run lint` is the only automated check.

## Environment Variables

Copy `.env.example` to `.env` and set:

- `GEMINI_API_KEY` — Google Gemini API key (exposed to the frontend via Vite as `import.meta.env.VITE_GEMINI_API_KEY`)

## Architecture

The app is intentionally minimal: all source lives in `src/` with five files.

### Data Flow

```
useLemonStore.ts  ←→  localStorage ("lemon_db")
      ↓
   App.tsx  (single component file: all UI, views, and forms)
```

**`useLemonStore.ts`** is the sole source of state and business logic. It exposes:
- `db` — the full `LemonDatabase` state (capital, stock, transactions)
- `stats` — memoized aggregates (profit, loss, volumes per type)
- `hargaBeliRata` — weighted-average purchase price across all `masuk` transactions
- `addTransaction(type, kg, harga, keterangan)` — validates and commits a transaction
- `resetData()` — clears all data back to initial state

**`App.tsx`** contains all UI: the three views (`dashboard`, `history`, `report`) and the `TransactionForm` modal component. View state is local to `App`. No router is used.

### Transaction Types

| Type | Meaning | Effect |
|------|---------|--------|
| `masuk` | Stock purchased | Deducts `modalSisa`, increases `stok.baik` |
| `jual` | Stock sold | Adds to `modalSisa`, decreases `stok.baik`, records `profit` |
| `busuk` | Spoiled stock | Decreases `stok.baik`, increases `stok.busuk`, records `kerugian` |
| `shrink` | Weight shrinkage | Decreases `stok.baik` and `totalKg`, records `kerugian` |

### Financial Calculations

- **Profit per sale**: `(hargaJual − hargaBeliRata) × kg`
- **Loss (busuk/shrink)**: `hargaBeliRata × kg`
- **Net assets (Finance view)**: `modalSisa + (stok.baik × hargaBeliRata)`
- **Initial capital**: hardcoded to IDR 10,000,000 (`INITIAL_MODAL` in `useLemonStore.ts`)

### Styling Conventions

- Tailwind CSS v4 (configured via `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- Yellow (`yellow-*`) is the primary color theme throughout
- `motion` (Framer Motion v12) is used for page/modal transitions via `motion.div` and `AnimatePresence`
- Currency is always formatted with `formatRupiah()` (defined in `App.tsx`, uses `id-ID` locale)
- Max content width: `max-w-xl mx-auto`

### Path Alias

`@` resolves to the project root (configured in both `tsconfig.json` and `vite.config.ts`).
