# File Counting Fix - Applied 2026-03-03

## Problem

The Global Inventory Management page was showing **3x the actual number of files** uploaded.

### Example:
- 53 files uploaded
- System showed: 171 files (53 source + 59 thumb + 59 display)

## Root Cause

The query in `GlobalInventoryManagement.tsx` was fetching ALL file variants without filtering:

```typescript
// BEFORE (INCORRECT):
const { data: allFiles } = await supabase
  .from('auction_files')
  .select('item_id, cdn_url, mime_type, variant')
  .in('item_id', itemIds)
  .eq('published_status', 'published')
  .is('detached_at', null);

// This returned ALL variants: source, thumb, and display
// Each uploaded file creates 3 database records (3 variants)
```

## Solution

Modified the query to filter for ONLY the `source` variant when counting files:

```typescript
// AFTER (CORRECT):
const { data: sourceFiles } = await supabase
  .from('auction_files')
  .select('item_id, cdn_url, mime_type, variant')
  .in('item_id', itemIds)
  .eq('variant', 'source')  // ← Only count source files
  .eq('published_status', 'published')
  .is('detached_at', null);
```

Then fetch thumbnails separately for display purposes:

```typescript
// Separate query for thumbnails (display only)
const { data: thumbFiles } = await supabase
  .from('auction_files')
  .select('item_id, cdn_url')
  .in('item_id', itemIds)
  .eq('variant', 'thumb')  // ← Only thumbnails for display
  .eq('published_status', 'published')
  .is('detached_at', null);
```

## Files Modified

- `/src/components/GlobalInventoryManagement.tsx` (lines 55-89)

## Verification

After the fix:
- 53 uploaded files now correctly show as 53 files
- File counts match the actual number of uploaded files
- Thumbnails still display correctly

## Status

**FIXED** - Applied and verified on 2026-03-03

## Related Issues

- Duplicate `/project/project/` folder removed (was causing fix to revert)
- `.projectroot` marker file created to prevent folder recreation
