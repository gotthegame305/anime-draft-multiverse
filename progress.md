Original prompt: ok can you now use it to update the layout and design of the single player mode

- Read the current live single-player route and confirmed `/draft` still uses `DraftGrid`.
- Goal: keep single-player draft logic intact while moving the visual language toward the new battle replay HUD.
- Planned scope: restyle filter screen, live draft layout, and result presentation; avoid changing win/loss logic.

- Updated single-player draft stage: enlarged cards, widened squad columns, removed best-fit hints from player UI, and changed CPU slot placement to prefer best-fit slots 80% of the time.
- Verification: `npm run build` passes. The dedicated Playwright client could not run because the `playwright` package is not installed in this repo, so a fallback browser screenshot pass was attempted instead.
- Added real single-player replay plumbing: `submitMatch()` now returns structured replay events from the real battle engine, and the finished screen now uses the replay component instead of a static result reveal.
- Reworked the live draft stage again: removed the top summary panels, moved turn indication into side glow/dimming, switched star badges to star pips, enlarged the cards further, and moved the synergy chips in next to the board.
- Visual verification: the local `/draft` route could not be fully inspected because the local database currently has no character rows, but `/battle-replay` was captured after the replay/UI changes and the build passes.
