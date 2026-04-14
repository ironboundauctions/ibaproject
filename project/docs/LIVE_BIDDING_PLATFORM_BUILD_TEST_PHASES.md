# Phase Test Plans

Quick smoke-test checklist for each phase — enough to confirm the core flow works before moving on.

---

## Phase 1 — Event Management & Publishing

1. Admin panel → "Events & Items" tab loads without error (no blank screen)
2. Click "Create Event" → fill in title, dates, location → save → event appears in the list with status `draft`
3. Click the globe icon on that event → status badge changes to `published` (blue)
4. Open the public site in a new tab → the event appears on the browse page
5. Click the eye-off icon → status back to `draft` → refresh public site → event disappears from browse
6. Edit the event → change the title → save → list reflects the new title
7. Delete the event → it's gone from the list

---

## Phase 2 — Live Clerk Console

1. Admin opens the clerk console for a published live event
2. Clerk can see the current lot, call a bid amount, and it updates in real time
3. Online bidder view reflects the current ask price within ~2 seconds
4. Clerk advances to next lot → current lot updates for online bidders
5. Bid history records each called bid with timestamp

---

## Phase 3 — Bidder Registration & Pre-Bidding

1. Logged-in user can register for a published event
2. Registered user can place a max pre-bid on a lot
3. Pre-bid appears in the clerk console
4. Un-registered user cannot place a pre-bid (prompt to register)

---

## Phase 4 — Results & Invoicing

1. After event ends, sold lots show winning bidder and final price
2. Admin can generate an invoice for a winning bidder
3. Invoice shows lot list, buyer's premium, CC fee totals correctly
4. Invoice can be downloaded or emailed
