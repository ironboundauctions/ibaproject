# Inventory Management Features - User Guide

## Quick Start

The Global Inventory Management page now includes powerful features for managing large inventories efficiently.

## 🖼️ Image Gallery

### Viewing Images
1. Click on any item's thumbnail image in the inventory list
2. A full-screen gallery modal opens showing all images for that item
3. The thumbnail shows a "+N" badge if there are additional images

### Gallery Controls
- **Arrow Keys**: Navigate between images
- **Mouse Wheel**: Zoom in/out (in fullscreen mode)
- **Click Image**: Enter fullscreen mode
- **ESC Key**: Exit fullscreen or close gallery
- **Thumbnail Strip**: Click any thumbnail to jump to that image

### Zoom Controls (Fullscreen)
- Zoom In/Out buttons: Control zoom level (100% to 400%)
- Click and drag: Pan around zoomed image
- Reset button: Return to 100% zoom

## 🔍 Search & Sort

### Search
- Type in the search box to filter by inventory number or title
- Results update in real-time as you type
- Result count shown: "Showing X of Y items"

### Sorting
Use the sort dropdown to organize items by:
- **Newest First** / **Oldest First** - Date added
- **Inventory # (A-Z)** / **(Z-A)** - Alphanumeric sorting
- **Title (A-Z)** / **(Z-A)** - Alphabetical by name
- **Consigner (A-Z)** / **(Z-A)** - By consigner name

## 🎯 Advanced Filters

### Opening Filters
Click the "Advanced Filters" bar to expand the filtering panel

### Available Filters
1. **Category**: Select one or more equipment categories
2. **Consigner**: Select one or more consigners
3. **Reserve Price Range**: Set minimum and/or maximum price
4. **Date Range**: Filter by date items were added

### Managing Filters
- **Active Filters**: Show as colored badges below the filter panel
- **Remove Single Filter**: Click the X on any badge
- **Clear All**: Click "Clear All" button to remove all filters
- **Filter Count**: Badge shows total number of active filters

### Filter Behavior
- All filters work together (AND logic)
- Filters work with search and sort
- Selection state maintained when changing filters

## ✅ Bulk Operations

### Selecting Items
1. Click checkbox next to any item to select it
2. Click checkbox in table header to select/deselect all visible items
3. A floating action bar appears when items are selected

### Bulk Actions
**Change Status**: Update status for all selected items
- Available, Assigned, Sold, Returned, or Withdrawn
- Confirmation dialog appears before applying

**Export CSV**: Download selected items as spreadsheet
- Includes all key fields
- Automatic filename with date
- Opens as CSV file for Excel/Google Sheets

**Delete Items**: Remove multiple items at once
- Confirmation shows exact count
- Cannot be undone - use with caution

### Selection Management
- **Selection Count**: Shows "X selected" in action bar
- **Clear Selection**: Click X button or complete an action
- Selection cleared after each bulk operation

## 📊 CSV Export Details

### Exported Fields
- Inventory Number
- Title
- Description
- Category
- Consigner Name
- Reserve Price
- Status
- Image URL

### File Format
- Standard CSV format with quoted fields
- UTF-8 encoding
- Compatible with Excel, Google Sheets, and other spreadsheet apps
- Filename: `inventory-export-YYYY-MM-DD.csv`

## 💡 Tips & Best Practices

### Efficient Workflow
1. Use filters to narrow down to relevant items
2. Sort to organize items logically
3. Select items you need
4. Perform bulk action (export or status change)

### Large Inventories
- Start with filters to reduce visible items
- Use search for specific inventory numbers
- Export filtered results for offline analysis
- Sort by date to find recent additions

### Image Management
- Click thumbnails to review all images
- "+N" badge shows additional image count
- Use gallery keyboard shortcuts for speed
- Fullscreen mode for detailed inspection

### Bulk Editing
- Filter first to get exact items needed
- Double-check selection count before delete
- Use status changes to organize workflow
- Export before major changes as backup

## 🔐 Security Notes

- All operations require authentication
- Bulk delete shows confirmation with item count
- Status changes are logged per user
- Exports only include items user has access to

## ⚡ Keyboard Shortcuts

### Gallery Modal
- `←` / `→` Arrow keys: Previous/Next image
- `ESC`: Close gallery or exit fullscreen
- Mouse wheel: Zoom (when in fullscreen)

### Table Operations
- `Tab`: Navigate between controls
- `Space`: Toggle checkboxes
- `Enter`: Activate buttons/links

## 🐛 Troubleshooting

### Images Won't Load
- Check RAID storage connection status
- Verify image URLs are valid
- Try reloading the page

### Filters Not Working
- Clear all filters and reapply
- Check if any conflicting filters are active
- Verify data matches filter criteria

### Export Issues
- Ensure items are selected
- Check browser allows file downloads
- Try different file name if needed

### Selection Problems
- Use "Clear Selection" and reselect
- Check if items are visible with current filters
- Refresh page if state seems stuck

## 📱 Mobile Usage

- Gallery: Swipe to navigate images
- Filters: Fully responsive on mobile
- Bulk actions: Bar stays at bottom of screen
- Checkboxes: Touch-friendly size

## 🎨 Visual Indicators

- **Orange Badge**: Active filter count
- **+N Badge**: Additional images available
- **Orange Ring**: Selected/active items
- **Hover Tooltip**: "Click to view gallery"
- **Selection Bar**: Floating at bottom when items selected

---

For technical implementation details, see `INVENTORY_FEATURES_SUMMARY.md`
