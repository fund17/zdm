# Status Color Scheme

This document outlines the color coding system used for status badges in the Daily Plan Management application.

## Status Colors

| Status | Color | Background | Text | Border | Description |
|--------|-------|------------|------|--------|-------------|
| **On Plan** | Blue | `bg-blue-100` | `text-blue-800` | `border-blue-200` | Planning phase - work is scheduled |
| **On Going** | Orange | `bg-orange-100` | `text-orange-800` | `border-orange-200` | In progress - work is actively being done |
| **Carry Over** | Yellow | `bg-yellow-100` | `text-yellow-800` | `border-yellow-200` | Pending/delayed - work is postponed |
| **Done** | Green | `bg-green-100` | `text-green-800` | `border-green-200` | Completed successfully |
| **Failed** | Red | `bg-red-100` | `text-red-800` | `border-red-200` | Failed to complete |
| **Idle** | Gray | `bg-gray-100` | `text-gray-700` | `border-gray-200` | Inactive/waiting |
| **Off** | Slate | `bg-slate-100` | `text-slate-600` | `border-slate-200` | Off duty/disabled |

## Color Psychology

- **Blue (On Plan)**: Trust, reliability, planning
- **Orange (On Going)**: Energy, activity, progress
- **Yellow (Carry Over)**: Caution, attention needed, delayed
- **Green (Done)**: Success, completion, positive outcome
- **Red (Failed)**: Error, failure, immediate attention
- **Gray (Idle)**: Neutral, inactive, waiting
- **Slate (Off)**: Disabled, off-duty, unavailable

## Implementation

The color scheme is implemented in `src/app/daily-plan/page.tsx` using the `getStatusStyle` function which:

1. **Exact matching**: Uses `switch` statement for precise status matching
2. **Partial matching**: Falls back to `includes()` for variations
3. **Case insensitive**: Normalizes status to lowercase
4. **Trim whitespace**: Handles extra spaces

## Usage

The status badges are automatically colored based on the Status column value from Google Sheets. The system is flexible and handles:

- Exact matches (case-insensitive)
- Partial text matches
- Variations in spacing
- Unknown status fallback (purple)

## Customization

To add new status colors, update the `getStatusStyle` function in `src/app/daily-plan/page.tsx` by:

1. Adding new case in the switch statement for exact matches
2. Adding new condition in the fallback section for partial matches
3. Ensuring Tailwind CSS classes are available in the build