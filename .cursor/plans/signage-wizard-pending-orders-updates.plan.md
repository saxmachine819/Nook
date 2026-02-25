# Signage: Pending Orders, Tables vs Seats, Template-First and Product Options

## 1) "Manage Existing QR Code Orders" — inside QR Code Management

**Requirement:** Do **not** use a separate collapsible section. Put the orders list **inside** the existing **QR Code Management** container. Call it **"Manage Existing QR Code Orders"**. Only show this block when there is at least one **incomplete** order (status not DELIVERED and not CANCELLED).

**Server:** [app/venue/dashboard/[id]/page.tsx](app/venue/dashboard/[id]/page.tsx)

- When fetching signage orders, keep fetching last 5 (or more) orders, then filter to incomplete: `incompleteOrders = signageOrders.filter(o => o.status !== "DELIVERED" && o.status !== "CANCELLED")`. Pass both to client if needed (e.g. `signageOrders` and `incompleteSignageOrders`) or only `incompleteSignageOrders` for the "manage" list.
- Recommendation: pass `incompleteSignageOrders` (filtered list) so the client can both decide visibility and render the list.

**Client:** [app/venue/dashboard/[id]/VenueOpsConsoleClient.tsx](app/venue/dashboard/[id]/VenueOpsConsoleClient.tsx)

- **Remove** the current standalone "Signage Orders" collapsible (the separate `Button` + block that sits **above** the "QR Code Management" button).
- **Inside** the existing QR Code Management block (the same `{qrManagementOpen && ( ... )}` that contains "Order QR Code Signage", "Venue QR (Register / Front Window)", and the table/seat list), add a new row/entry:
  - **Label:** "Manage Existing QR Code Orders"
  - **Visibility:** Only render this row (and the list below it when expanded) when `incompleteSignageOrders.length > 0` (or equivalent: at least one incomplete order). So when there are no pending orders, this row does not appear inside QR Management.
  - **Behavior:** When present, clicking or expanding shows the same list of incomplete orders (status pill, date, template name, Store/Tables/Seats counts). Clicking an order opens the same order detail modal (`selectedSignageOrder`).
- **State:** Reuse existing `selectedSignageOrder` and the same detail Dialog. Use the incomplete-orders list (e.g. `initialSignageOrders` filtered to incomplete, or a new prop `incompleteSignageOrders`) for this list.
- **Placement:** Add "Manage Existing QR Code Orders" as the first or second item inside the QR Management dropdown content (e.g. right after "Order QR Code Signage" or before it). Same visual pattern as the other rows (e.g. a row with label + optional expand/collapse for the order list).

**Summary:** One collapsible remains: "QR Code Management". Inside it: (1) Order QR Code Signage, (2) **Manage Existing QR Code Orders** (only when there are incomplete orders; expands to show list + detail modal), (3) Venue QR, (4) table/seat rows. No separate "Signage Orders" section.

---

## 2) Tables list: only group-booked tables

**Requirement:** If a table is "Individually booked", it must not appear under "Tables". Only **group**-booked tables appear under "Tables".

**File:** [components/venue/SignageOrderWizard.tsx](components/venue/SignageOrderWizard.tsx)

- Restrict the Tables list to group tables: e.g. `groupTables = venue.tables.filter((t) => t.bookingMode === "group")`, then `filteredTables = groupTables.filter(...)` for search. Use this for the "Tables" section.
- Seats section unchanged: seats from tables where `bookingMode !== "group"` (individually booked) with seats.
- Optional copy under Tables: "Group-booked tables only; individually booked seats are in Seats below."

---

## 3) Template-first flow and product options

(Unchanged from original plan: Step 1 = choose design template; Step 2 = choose items — Counter Sign, Window Decal, Table Tent, Standard Seat QR — with targets; Step 3 = shipping. Optional `designOption` on SignageOrderItem. Backend can keep STORE/TABLE/SEAT and add designOption or derive from template + scope.)

---

## 4) Implementation order

1. **Manage Existing QR Code Orders inside QR Management:** Remove standalone section; add row inside QR Management, show only when incomplete orders exist; rename. Server: pass incomplete list. Client: one collapsible, new row inside it.
2. **Tables = group only:** Wizard filter Tables to `bookingMode === "group"`.
3. **Template-first + product options:** As in original plan.
