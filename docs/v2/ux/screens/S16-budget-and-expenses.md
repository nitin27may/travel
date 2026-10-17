# S16. Budget and expenses

## Purpose
Planned versus actual, by the six categories (getting there, local transport, lodging, food,
activities, misc) with a buffer, in the trip currency and home currency. Quick expense capture during
the trip. Group balances (splitting) are out of v1 (family first).

## Entry points
Last section of the plan document; phone More → Budget; Today mode "+ Expense"; the dashboard budget line.

## Wireframes

Desktop (as a section of the plan document and as its own tab):

```
┌ Budget · Dolomites ─────────────────────── Target [$12,000 CAD] [Add expense] ┐
│ Planned $11,240 + buffer 12 % = $12,589   Actual $3,820   Home: CAD · €1=1.49 (12 Oct)│
│ ┌────────────────┬──────────┬──────────┬──────────────────────┐                 │
│ │ Category       │ Planned  │ Actual   │                      │                 │
│ │ Getting there  │ 4,880    │ 4,880    │ ████████████ 100 %   │                 │
│ │ Lodging        │ 3,900    │ 1,150    │ ████▍          29 %   │                 │
│ │ Local transport│   620    │     0    │                      │                 │
│ │ Food           │ 1,040    │     0    │                      │                 │
│ │ Activities     │   600    │     0    │                      │                 │
│ │ Misc           │   200    │     0    │                      │                 │
│ └────────────────┴──────────┴──────────┴──────────────────────┘                 │
│ Passes: Dolomiti SuperSummer 6-day pays for itself after 4 of your 7 lift rides │
│ EXPENSES  Sort: date ▾                                                           │
│  13 Jul  Vaporetto day pass ×4   €100  local transport  🧾                       │
│  …                                                                               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Phone quick add (from Today or Budget):

```
┌───────────────────────────┐
│ Add expense               │
│ [   € 23.50          ]    │  ← numeric keypad opens
│ [Food][Transport][Act.][…]│
│ Lunch at Rifugio Firenze  │
│ Day 3 · linked: Seceda ▾  │
│ [📷 Receipt]   [Save]     │
└───────────────────────────┘
```

## Regions and components
BudgetBar (per category) · CategoryTable · BufferLine · CurrencyLine (rate + date) · PassAdvice ·
ExpenseList · ExpenseQuickAdd (amount-first, category chips, auto-link to the current item in Today
mode) · ReceiptCapture.

## Primary action
"Add expense" (during/after); "Set target" (before).

## States
- **No estimates**: "Estimates come from your reservations and items with costs. Add a target to compare."
- **Foreign currency**: amount entered in the local currency, home amount computed with the stored
  rate; offline uses the last stored rate with a note.
- **Over target**: the line turns warn colour with the biggest drivers named ("Lodging +$640").
- **Offline**: add works, rate pending.

## Interactions
Inline edit of planned lines; tap a category to filter expenses; swipe left on an expense → edit/delete.

## Copy
"Planned $11,240 · actual $3,820 · $8,769 left of target incl. buffer".

## Accessibility
The bar chart has the table as its equivalent; amounts read with currency.

## Data and operations
`budget_line` (planned), `expense` (actual), reservations' prices (auto lines), pass offers
(`covered_by` relations), exchange rate stored with date.

## Acceptance criteria
1. A reservation with a price creates or updates its planned line automatically.
2. An expense can be added in 3 taps plus the amount in Today mode.
