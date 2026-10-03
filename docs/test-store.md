# Local test store and campaign balances

The Test DP tab in Gear → Store simulates Apple and Google connections. It makes no network payment request, opens no native payment sheet, and charges no money. All physical equipment, courses and upgrades remain available with earned department resources.

## Player flow

Choose a simulated provider and a 3, 8 or 20 test-DP product, then select **Simulate purchase**. New credit goes to the local wallet. Explicitly allocate an amount to a named save slot; the form shows the destination and wallet remainder. Development shows earned points and allocated test points separately, spending earned points first. Equipment still costs department funding and training still takes funding and time.

Simulation controls exercise pending, cancelled, failed and completion-failure results. Pending history can be approved, cancelled or failed. Replaying a receipt and reconciling known transactions never grant it twice. If credit succeeds but completion fails, retry completion instead of buying again.

A simulated refund removes that receipt's unused credits, including allocations. Its already-spent test points become a visible wallet adjustment covered by future test credits. Earned points, gear, officers and unlocked progress stay intact. This is a demonstration policy, not a real billing or repayment obligation.

## Persistence contract

Campaign bank version 2 retains the same ten slots, adds a stable campaign UUID outside each serialized GameState, and stores the local test ledger alongside the slots in one localStorage entry. UUIDs and ledger grants never enter copyable campaign data. Existing version-1 banks migrate without replacing campaign contents or the undo-deletion copy.

Rename/load/save retain a campaign UUID. Copy/import/new/overwrite create a fresh UUID and no test balance. Delete preserves unused allocations so they can be unassigned; undo retains the original identity. Exported campaign backups and readable recovery-library exports exclude wallet authority. Imported campaign data never restores purchases or allocation IDs.

Every wallet write and development unlock uses the same origin-wide Web Lock as ordinary save writes, plus an expected-raw-value check. Another tab's newer bank is never overwritten. A paid unlock validates prerequisites and funding again, settles earned progression, debits earned points before integer milli-DP credit, and writes the new campaign and ledger debit atomically. Storage failure publishes neither the unlock nor its debit. The UI refuses commerce without save-lock support; the isolated browser QA frame has its own serialized in-memory bank.

Transactions are namespaced by local-test provider and request ID. Product amounts come from the fixed catalog rather than callback amounts. Credits are saved before completion; completion retries are separate from grant processing. Unknown products/environments, non-boolean verification, malformed IDs, corrupt banks and stale writers fail closed. This prevents duplication through supported app flows; deliberately editing local data is outside this simulation's trust model.

## Before any real store connection

This browser mock has no accounts, native client, trusted receipt verification, production entitlement service, tax/pricing localization or cross-device recovery. Clearing site storage loses the local test history. Production Apple/Google purchases require platform adapters and a trusted account-bound ledger, authoritative verification and refund handling, store/legal review, and an approved customer-support policy. Local backups cannot be treated as trusted paid-currency receipts.
