Original prompt: ok can you now use it to update the layout and design of the single player mode

- Read the current live single-player route and confirmed `/draft` still uses `DraftGrid`.
- Goal: keep single-player draft logic intact while moving the visual language toward the new battle replay HUD.
- Planned scope: restyle filter screen, live draft layout, and result presentation; avoid changing win/loss logic.

- Updated single-player draft stage: enlarged cards, widened squad columns, removed best-fit hints from player UI, and changed CPU slot placement to prefer best-fit slots 80% of the time.
- Verification: `npm run build` passes. The dedicated Playwright client could not run because the `playwright` package is not installed in this repo, so a fallback browser screenshot pass was attempted instead.
