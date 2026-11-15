# Ornamental command interface

Current game version: **0.7.0**. Presentation revision: `maze-builder-icon-20261115`.

The approved parchment, emerald enamel and antique brass style remains the visual foundation. Buttons use real accessible text and native interactions; generated transparent WebP art supplies the illustrations. All 18 assets, original prompt records, source hashes and alpha checks are listed in `public/assets/ui/ornate/manifest.json`. Exact generated originals and prompts are retained locally under `artifacts/ornate-ui/`; the design gallery is neither edited nor published.

## Menu and account

- Main navigation reads Home, Hall of Fame, Achievements, Commander. Internal API routes and military rank names are unchanged; General remains the legitimate level-13 rank.
- The account nickname is above the medal balance. The rank summary is a keyboard-accessible button opening the complete 15-rank roadmap.
- Human, Dwarves and Elves use the lion, anvil and leaves from the approved alliance crest as matched generated derivatives.
- Home shows exactly three selected Commander skill slots, actual owned ranks and empty-slot affordances. Editing a slot opens Commander. Guest slots lead to sign-in.
- The duplicate destination cards are removed. Maze Builder occupies that location.
- An empty continuation explicitly says “No saved game”; it does not offer an invented continuation. A valid local or cloud save retains Continue Defense and replacement protection.

## Maze Builder

The menu editor reuses the existing `BlueprintEditor`, 37×37 grid, ordered checkpoint validation and `bastions.blueprints.v1` library. Pointer and touch strokes, draw/erase, keyboard arrows and Space/Delete, Undo/Redo, clear, route preview and a named Save & use action are available. Invalid or over-250-cell plans cannot be saved. Storage errors retain the drawing and do not report a false success. Up to 20 custom plans are stored in this browser; updating an existing plan preserves its ID. Reopening loads the selected custom plan. Selecting another menu tab retains the in-memory drawing.

Saving refreshes an already mounted game planner and selects the same exact layout. New games use the same selected library entry. The blueprint guides ordinary construction; it neither grants structures nor changes gold, recruitment, random draws, account progression or verified run commands. Browser-local storage is clearly disclosed; it is not a cross-device account save.

## Battlefield and field books

The HUD uses generated wave, keep-health, gold, command-point, hourglass, commander, recipe, enemy-wave, sound and settings symbols. Header and preparation folio have decorative brass rails. Commander has a matching empty-state heraldic illustration. The Advanced menu disclosure and its button are removed from the player menu.

Recipe-book corners are aligned inside the book artwork; overlapping CSS corners are suppressed. Illustrated champion/basic tabs use the same material palette. Lady Claire is absent from the catalog, search, navigation, bookmarks, ingredient links and preparation suggestions even after discovery. Exact core combination rules remain available. When the real secret combination is already legal, the crafting dock presents an unrecorded alliance action without publishing the ingredient plan.

Enemy portraits are centered within their own frame. Multiple possible forms share one statistics register; each form has its own compact card, exact equal-choice fraction, differentiating trait and actual configured defenses. Repeated long shared enemy names are removed from form cards. Gameplay values and random selection remain unchanged.

## Verification

Regression coverage includes saving/reopening and editing the same blueprint, blocked checkpoint protection, undo, unavailable storage, the 20-plan limit, exact Home skill slots, secret visibility across all three factions, and the three actual final-boss forms. Existing canonical combat, score, account progression, checkpoint and crafting tests remain in the full suite. Desktop and phone browser checks cover real menu navigation, rank shortcut, blueprint save/reload, HUD actions, recipe secrecy, portrait alignment and image loading. Only a loopback test account is used for write-based QA; public checks do not create player scores or modify account progression.
