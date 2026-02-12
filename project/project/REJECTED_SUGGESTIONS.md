# Server AI Suggestions Review

## ✅ APPLIED (see safe_optimizations.sql)

### Performance Indexes
- `idx_inventory_items_number` - Fast lookups by inventory number
- `idx_inventory_items_created_desc` - Fast sorting by creation date
- `idx_auction_files_key` - Fast file lookups

### Data Quality
- `inventory_number NOT NULL` - Already required by code
- `title NOT NULL` - Already required by code
- `auction_files.name NOT NULL` - Basic data integrity
- `storage_provider DEFAULT 'raid'` - Sensible default

---

## ❌ REJECTED

### 1. Status Check Constraint
```sql
CHECK (status IN ('draft','active','archived'))
```

**Reason**: Code uses different values: `'available' | 'assigned' | 'sold' | 'returned' | 'withdrawn'`
**Impact**: Would immediately break the application
**Location**: See `src/services/inventoryService.ts:22`

### 2. RLS Policies with `USING (true)`
```sql
CREATE POLICY ... USING (true)
```

**Reason**: Your own guidelines state "NEVER create policies that use `USING (true)`, this defeats the purpose of RLS"
**Impact**: Allows anyone to read/write everything - massive security hole
**Recommendation**: Need proper admin-only policies for inventory management

### 3. Unique Index on (item_id, name)
```sql
CREATE UNIQUE INDEX uq_auction_files_item_name ON auction_files (item_id, name)
```

**Reason**: Prevents legitimate re-uploads of corrected files with same name
**Impact**: Users couldn't replace a file if they uploaded the wrong version
**Decision Needed**: Do we want to allow file replacement or enforce unique names?

### 4. File Key Shape Constraint
```sql
CHECK (position('/' in file_key) > 0)
```

**Reason**: Too restrictive - assumes specific path format
**Impact**: Could break if storage strategy changes
**Recommendation**: Handle in application layer, not database

### 5. Additional NOT NULL on auction_files
```sql
ALTER COLUMN file_key SET NOT NULL,
ALTER COLUMN download_url SET NOT NULL
```

**Reason**: RAID integration still in development
**Impact**: Could cause issues during file upload flow if metadata saved before URLs generated
**Decision Needed**: Apply after RAID is fully stable

---

## 🎯 CORRECT Status Values for Future Reference

The actual status enum for `inventory_items` should be:
```sql
CHECK (status IN ('available', 'assigned', 'sold', 'returned', 'withdrawn'))
```

If we want to add this constraint in the future, use these values.
