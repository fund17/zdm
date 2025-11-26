# Sticky Columns & Dropdown Lists Implementation

## Overview

This implementation adds two major features to the Daily Plan Management system:
1. **Sticky Columns** - Pin columns to left or right side of the table
2. **Dropdown Lists** - Dynamic dropdowns for list-type columns

## Sticky Columns

### Configuration
In the settings sheet, use the `Show` column with these values:
- `StickyLeft` - Pin column to the left side
- `StickyRight` - Pin column to the right side
- `Yes` - Normal visible column
- `No` - Hidden column

### Current Sticky Configuration
| Column | Position | Purpose |
|--------|----------|---------|
| Date | StickyLeft | Always visible for reference |
| Site ID | StickyLeft | Primary identifier |
| Status | StickyRight | Quick status overview |

### Technical Implementation
- CSS `position: sticky` for horizontal scrolling
- Left sticky columns: `left-0, left-[width]` positioning
- Right sticky columns: `right-0` positioning
- Z-index management for proper layering

## Dropdown Lists

### Configuration
Set column `Type` to `List` in settings sheet to enable dropdown functionality.

### Menu Data Source
Dropdown options are fetched from the `menu` sheet with these columns:

| Column | Options |
|--------|---------|
| **Activity** | Survey, MOS, Installation, Integration, ATP/SIR, Rectification, Tagging, Dismantle, Inbound, Outbound, Troubleshoot, RF Audit, PLN Upgrade, Others |
| **Team Category** | Internal, External, B2B, SP |
| **SOW** | TE, MW, DISM, TSS, PLN |
| **Vendor** | HUAWEI, ZTE |
| **Status** | On Plan, On Going, Carry Over, Done, Failed, Idle, Off |
| **Project** | IOH, XLS, TSEL |

### API Endpoints

#### Menu Data API
- **URL**: `/api/sheets/menu`
- **Method**: GET
- **Response**: Dynamic dropdown options
```json
{
  "success": true,
  "data": {
    "Activity": ["Survey", "MOS", "Installation", ...],
    "Status": ["On Plan", "On Going", "Done", ...],
    "Vendor": ["HUAWEI", "ZTE", ...]
  }
}
```

#### Updated Settings API
- **URL**: `/api/sheets/settings`
- **Method**: GET
- **Response**: Includes sticky position and list type support
```json
{
  "success": true,
  "data": {
    "columns": [
      {
        "name": "Date",
        "type": "date",
        "show": true,
        "editable": false,
        "sticky": "left"
      },
      {
        "name": "Status",
        "type": "list",
        "show": true,
        "editable": true,
        "sticky": "right"
      }
    ]
  }
}
```

## User Experience

### Sticky Columns Benefits
- ✅ Always visible reference columns during horizontal scrolling
- ✅ Better data context with Date and Site ID always visible
- ✅ Quick status updates with Status column always accessible
- ✅ Improved productivity for wide tables

### Dropdown Lists Benefits
- ✅ Data consistency with predefined options
- ✅ Faster data entry with dropdown selection
- ✅ Reduced typos and standardized values
- ✅ Dynamic options from centralized menu sheet

## Implementation Details

### Component Structure
```
DynamicDataTable
├── menuData state (dropdown options)
├── columnConfigs with sticky property
├── renderEditInput with list type support
└── CSS classes for sticky positioning
```

### Key Features
1. **Auto-fetch menu data** on component mount
2. **Fallback to text input** if menu data unavailable
3. **Sticky positioning** preserved during scrolling
4. **Type-safe interfaces** for all configurations
5. **Error handling** for failed API calls

### CSS Classes for Sticky
```css
.sticky-left-0 { position: sticky; left: 0; }
.sticky-right-0 { position: sticky; right: 0; }
.bg-white { background: white; } /* Prevent transparent overlap */
.z-10 { z-index: 10; } /* Layer management */
```

## Future Enhancements
- [ ] Visual indicators for sticky columns
- [ ] Configurable sticky column width
- [ ] Multi-select dropdown support
- [ ] Custom dropdown validation
- [ ] Sticky column resize handles