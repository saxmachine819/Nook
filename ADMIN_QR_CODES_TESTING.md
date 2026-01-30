# Admin QR Codes page – test steps

After implementing the Admin QR Codes page at `/admin/qr-codes`, verify with these steps.

1. **Create batch 10**
   - Go to Admin → QR Codes.
   - Set count to **10**, click **Create new batch**.
   - Expect: success toast; summary card **Available (unregistered)** increases by 10; table shows new rows with the new `batch_id`.

2. **Verify it appears**
   - Confirm the new tokens appear in the table.
   - Optional: open one `/q/<token>` in a new tab and confirm unregistered/registration flow.

3. **Retire a token**
   - For an **ACTIVE** row (assign one via venue dashboard if none exist), click **Retire** and confirm.
   - Expect: row status → RETIRED; summary **Active** decrements and **Retired** increments; `/q/<token>` shows retired message.

4. **Filter by status**
   - Set filter **Status** = ACTIVE (then RETIRED, then UNREGISTERED).
   - Confirm table and summary counts match the selected status.
