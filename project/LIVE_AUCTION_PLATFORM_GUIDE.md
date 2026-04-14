# IronBound Live Auction Platform — Build Guide

**Reference this document at the start of every phase and during building.**
Last updated: 2026-04-09

---

## Vision Summary

A full live auction platform where:
- Admin creates events, manages lots, and runs live auctions from a backend control center
- The public browses published events in a catalog, pre-bids on lots, and joins live events to bid in real time
- The auctioneer has a clean large-display screen showing current lot and bids
- A clerk runs the auction — takes floor bids, manages online bids, advances lots, marks items sold
- A floor display shows current lot info on a TV facing the crowd
- Video/audio of the auctioneer is broadcast to the online bidding interface

---

## Key Decisions (Locked In)

### Auction Types
- **Live Auction** — Auctioneer calls bids, clerk manages the floor. No auto-timer per lot. Clerk clicks "Sold" or "Pass" to close each lot. Entire event has a scheduled start time.
- **Timed Auction** — Each lot has its own countdown timer. Bids extend the timer. Lots close automatically. No clerk or auctioneer screen needed.
- These are **never combined**. The type is chosen when creating the event and does not change.

### Pre-Bids (Live Auctions Only)
- Registered users can set a **maximum pre-bid** on any lot before the event goes live
- When the lot comes up during the live auction, the system holds the user's max amount
- As the auctioneer calls increments, the pre-bid automatically claims each increment on the bidder's behalf until their max is reached
- The clerk can see which lots have pre-bids and what the max amounts are
- The clerk has a toggle per event: **Auto-Accept Online Bids** (pre-bids fire automatically) vs **Manual** (clerk sees the pre-bid and decides to accept it)
- Fine-tune details of auto-bid flow handled in Phase 8 fine-tuning

### Floor Bids
- The clerk enters floor bids by clicking a dollar amount button
- Floor bidders are NOT registered in the system — they are anonymous floor participants
- Floor bids show as "Floor" in all bid feeds

### Bid Increments
- Set per event when creating it (e.g. $25 increments, $50 increments, etc.)
- All bid entry buttons on the clerk screen are based on this increment

---

## Screen/Interface Inventory

| Screen | Who Uses It | Access | Notes |
|---|---|---|---|
| Public Event Catalog | Anyone | Public | Browse published events and lots |
| Public Lot Detail | Registered users | Auth | Pre-bid, view images |
| Live Bidding Interface | Registered bidders | Auth | Real-time bidding during live event |
| Admin Event Dashboard | Admin | Admin | Event list, create/edit events, publish button |
| Event Control Panel | Admin | Admin | Tabbed panel for managing one specific event |
| Clerk Screen | Clerk/Admin | Admin, new tab | Runs the live auction, takes bids |
| Auctioneer Screen | Auctioneer | Admin, new tab | Read-only large display of current lot + bids |
| Floor Display Screen | Anyone at venue | Admin, new tab | Simple TV display, lot info + current bid |
| Streaming Setup | Admin | Admin tab | Configure video embed for public view |

---

## Database Tables (Supabase)

### Already Exists — Do Not Change
- `inventory_items` — global inventory pool
- `profiles` — user accounts
- `user_roles` — admin roles
- `consigners` — item sellers
- `auction_files` — media files
- `event_inventory_assignments` — links items to events with lot numbers
- `auction_events` — events table (currently unused, backed by localStorage — Phase 1 fixes this)

### To Create in Phase 1
- Add `stream_url`, `bid_increment`, `auto_accept_online_bids` columns to `auction_events`

### To Create in Phase 4 (Live Auction Session)
- `live_auction_sessions` — tracks the live state of a running auction
  - `event_id`, `current_lot_assignment_id`, `current_lot_number`, `current_bid`, `current_bidder_id`, `bid_source` (online/floor), `status` (waiting/running/paused/ended)
- `live_bids` — every bid placed during a live event
  - `event_id`, `lot_assignment_id`, `lot_number`, `amount`, `bidder_id` (null if floor), `source` (online/floor), `is_auto_bid`, `created_at`
- `pre_bids` — maximum pre-bids set by users before live event
  - `event_id`, `lot_assignment_id`, `user_id`, `max_amount`, `created_at`

---

## Phase Build Order

### Phase 1 — Events to Supabase + Publish Button
**Goal:** Events live in the database. Admin can publish an event. Published events show on the public browse page.

**What changes:**
- Rewrite `eventService.ts` to read/write `auction_events` table in Supabase
- Update `adminService.ts` `getAllAuctions()` to pull from Supabase only
- Add "Publish" button to the event list in the admin panel (changes status from `draft` to `published`)
- Only `published` events appear on the public-facing browse page
- Add columns to `auction_events`: `bid_increment`, `stream_url`, `auto_accept_online_bids`

**Phase 1 Questions to ask before building:**
- None needed — enough info to start

---

### Phase 2 — Public Event Catalog Page
**Goal:** Public users can browse published events and view lots in a catalog.

**What changes:**
- New public `EventCatalogPage` component — shows event info, lot count, countdown to start
- New public `LotCatalogGrid` — browseable grid of all lots in the event
- Each lot card shows: lot number, title, main image, starting price, estimated value
- "Pre-Bid" button per lot for logged-in users (modal to enter max amount, stores in `pre_bids` table)
- Event status banner: Upcoming / Registration Open / Live Now / Ended
- "Join Live Event" button appears when status = `active`

**Phase 2 Questions to ask before building:**
1. Should the public catalog show ALL lots in one scrollable page, or paginated? How many lots per page?
2. Should unauthenticated users see the pre-bid button at all (grayed out), or hidden entirely?
3. Should the event page show a countdown timer to the start time?

---

### Phase 3 — Admin Event Control Panel (Tabbed)
**Goal:** Replace the current single edit form with a full tabbed control center for each event.

**Tabs:**
1. Event Details — edit settings, image, fees, terms (existing AdminEventForm)
2. Lot Manager — assign/reorder/edit lots (existing EventInventoryManager improved)
3. Live Controls (only for live type) — launch clerk, auctioneer, floor display screens
4. Streaming Setup — paste embed URL, toggle on/off
5. (Tabs 3-5 for live auction screens added in Phases 4-6)

**Phase 3 Questions to ask before building:**
1. Should the "Live Controls" tab show up for timed auctions at all, or only for live auction type events?
2. Should the Lot Manager tab allow re-ordering lots by drag and drop?

---

### Phase 4 — Clerk Screen
**Goal:** A dedicated screen the clerk uses to run the live auction.

**What it shows and does:**
- Current lot: lot number, title, main image, starting price, reserve (if set), all assigned images
- Current bid amount — large display
- Bid source indicator: Online / Floor
- Bid entry buttons: large buttons for the configured bid increment (e.g. +$50, +$100)
- "Take Floor Bid" — clicks current ask price as a floor bid
- "Next Lot" / "Previous Lot" — advances the session
- "Sold" button — closes the lot, marks winner
- "Pass" button — closes lot with no sale
- Live bid feed — scrolling list of all bids on current lot (online and floor) in real time
- Pre-bid indicator — shows if any user has a pre-bid and what their max is
- Upcoming lots sidebar — next 5 lots queued

**All clerk actions update `live_auction_sessions` and `live_bids` via Supabase. All other screens subscribe to these changes via Supabase Realtime.**

**Phase 4 Questions to ask before building:**
1. Should the clerk screen open in a new browser tab, or as a panel inside the admin area?
2. Should "Sold" prompt the clerk to enter the winning floor bidder's paddle number, or just mark it as sold to current high bidder (online) or anonymous floor?
3. Should there be a "start auction" button that the clerk clicks to officially begin, or does it start when the clerk loads the screen?

---

### Phase 5 — Auctioneer Screen
**Goal:** A clean, large-font read-only display for the auctioneer.

**What it shows:**
- Current lot number — very large
- Lot title — large
- Current image — large, fills screen
- Current bid amount — very large, prominent
- High bidder source: "Online" or "Floor"
- Recent bid activity feed — last 5-10 bids scrolling
- Upcoming lot preview (next 1-2 lots)

**Phase 5 Questions to ask before building:**
1. Should the auctioneer screen show the reserve price / whether reserve has been met?
2. Should it show the pre-bid max amount so the auctioneer knows the ceiling?

---

### Phase 6 — Floor Display Screen
**Goal:** A simple screen shown on a TV facing the crowd at the venue.

**What it shows:**
- Lot number — very large
- Lot title — large
- Current image (cycling through lot images)
- Current bid amount — very large
- "Online" or "Floor" indicator
- Optional: "Going Once / Going Twice / SOLD" animation triggered by clerk

**Phase 6 Questions to ask before building:**
1. Should images cycle automatically, or stay on the main image only?
2. Should the "Going Once / Going Twice / SOLD" text be shown on this screen?

---

### Phase 7 — Live Bidding Interface (Online Bidders)
**Goal:** What registered bidders see when an event is live and they have joined it.

**What it shows:**
- Video/audio stream embed at top (from streaming setup)
- Current lot: number, title, image, description
- Current bid amount — large
- "Place Bid" button — bids current ask price (current bid + increment)
- Status: "You are the high bidder" or "You have been outbid"
- Your pre-bid status: "Your auto-bid is active up to $X"
- Lot list sidebar: all lots, current lot highlighted, completed lots marked
- Upcoming lots visible with pre-bid buttons still accessible

**Phase 7 Questions to ask before building:**
1. Should bidders be able to set or change their auto-bid max during the live event, or only before?
2. Should the video stream take up the full top of the page, or be a smaller picture-in-picture style?
3. Should there be a public chat or Q&A panel, or bidding only?

---

### Phase 8 — Fine Tuning (ALL Phases)
**Goal:** Go back through every single feature and make it production-ready.

Topics include:
- Auto-bid increment logic edge cases
- Bid conflict resolution (two online bids at same time)
- Pre-bid reveal timing (when does the clerk/auctioneer see the max?)
- Timed auction countdown and auto-close logic
- Notification system (outbid alerts, won alerts, event starting soon)
- Mobile responsiveness for live bidding interface
- Payment/invoicing hooks post-auction
- Lot status tracking: unsold, sold, passed, relisted
- Consigner reports after event completion
- Event archiving and results publishing

---

## Architecture Rules

1. **Supabase Realtime** is used for all live-auction state sync between clerk, auctioneer, floor display, and online bidders. No polling.
2. **`live_auction_sessions`** is the single source of truth for what lot is active and what the current bid is.
3. **All screens subscribe** to `live_auction_sessions` for their event. Only the clerk writes to it.
4. Events in localStorage are **dead after Phase 1**. Everything is Supabase from that point on.
5. The `auction_events.status` field drives everything:
   - `draft` — only visible to admins
   - `published` — visible on public catalog, accepting pre-bids
   - `active` — live auction is running, bidding interface open
   - `completed` — auction over, results visible
   - `cancelled` — hidden from public

---

## File Structure Intent

New files to create (do not bloat existing files):
- `src/services/auctionEventService.ts` — replaces eventService.ts, Supabase-backed
- `src/components/EventCatalogPage.tsx` — public event detail + lot catalog
- `src/components/LotCatalogGrid.tsx` — lot grid for public catalog
- `src/components/PreBidModal.tsx` — modal for setting a pre-bid max
- `src/components/EventControlPanel.tsx` — tabbed admin panel for one event
- `src/components/ClerkScreen.tsx` — clerk live auction control
- `src/components/AuctioneerScreen.tsx` — read-only auctioneer display
- `src/components/FloorDisplayScreen.tsx` — TV display for venue floor
- `src/components/LiveBiddingInterface.tsx` — public live bidding page
- `src/components/StreamingSetupTab.tsx` — admin streaming config

---

## Current State (Starting Point)

- Global inventory: WORKING — do not touch
- Consigners: WORKING — do not touch
- Admin user management: WORKING — do not touch
- Event creation form (AdminEventForm): EXISTS but saves to localStorage — Phase 1 migrates it
- Event inventory manager: EXISTS — preserved and moved into tabbed panel in Phase 3
- Public browse page: EXISTS (AuctionGrid) — will show published Supabase events after Phase 1
- Live auction: DOES NOT EXIST YET — Phases 4-7

---

*This guide is the source of truth. When in doubt, check here first.*
