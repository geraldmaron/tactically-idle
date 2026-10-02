# Local campaigns

The **Saves / New** control is available below the main header on every screen. There are ten named slots, with the saved date, game day, level, roster size, funds and any operation in progress. Each browser profile and device has its own saves; there is no account or cloud sync.

- The active campaign autosaves after each game command and every five-second tick. **Save now** explicitly checkpoints it.
- **New game** creates a separate campaign with a fresh seed. Choose an empty slot to preserve every previous game. A filled destination requires an explicit replacement confirmation.
- **Load** saves the current campaign and switches to the chosen slot. The new active slot persists across reloads. Loading settles elapsed time using the existing idle-game rules.
- **Save a copy** keeps a snapshot in another slot and makes that slot active. Both copies remain independently loadable.
- Names can be changed without altering gameplay. **Delete** requires confirmation and cannot remove the active slot; load another campaign first. The most recent deletion can be undone, including after a page reload. The optional permanent-delete checkbox frees storage and clears the previous undo backup; its confirmation says that it cannot be undone and offers export first.
- **Export current game** downloads a JSON backup. **Import backup** validates a compatible campaign and stores it in a chosen inactive slot; import never silently starts or replaces the active game. Browser data clearing removes local saves, so a downloaded backup is useful when moving devices or browser profiles.

## Compatibility and failure handling

The previous `tactically-idle/save` autosave is copied into slot 1 on first launch. Its original entry remains untouched for recovery. Campaign names, people, builds, histories, incident cards and operations migrate through the existing versioned save loader. The slot container uses `tactically-idle/campaign-slots` and stores all ten entries plus the active pointer in one atomic localStorage write. An origin-wide Web Lock serializes browser writers, including initialization. Browsers without this safe writing capability can read/export existing saves but do not write them.

An unreadable old autosave is retained in slot 1 while a new game uses slot 2. An unreadable slot stays visible and cannot load. A malformed whole library is left untouched and blocks writes. The current in-memory campaign and original library can be exported from the save manager for recovery.

If storage is full or denied, gameplay can continue in memory and the header shows **Saving needs attention**. A failed write does not replace a slot or switch campaigns. Free storage or export the in-memory game before leaving. Save again to retry. Pending changes show **Saving locally**; leaving with unsaved changes triggers the browser's standard warning. A tab whose stored library changed elsewhere refuses stale writes and asks for a reload; export any unsaved progress before reloading. Use one active game tab at a time. If the active save is damaged, loading another slot offers an explicit discard/export confirmation for the temporary in-memory game, even when all ten slots are occupied.

Cancel and Close do not change slots. Replacement and deletion confirmations identify the exact destination and name. The storage layer independently enforces explicit overwrite/deletion flags and the ten-slot limit.
