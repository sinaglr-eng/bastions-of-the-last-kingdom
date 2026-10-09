# Maze route display

Release 0.3.23 removes the projected route after completing a blueprint. The maze planner and editor draw wall-cell hints and gold firing positions. There is no future-route ribbon, dashed guide, visibility toggle or legend entry.

The current playable ground route remains a continuous gold ribbon with animated direction arrows. Current flying routes remain cyan and follow the checkpoints. Existing path visibility, pause and reduced-motion behavior are preserved. Blueprint editing still temporarily hides the current route while drawing wall cells and restores the user's path visibility choice on exit.

Completed-blueprint routes remain internal calculations. They still validate checkpoint reachability, include existing structures outside the plan, detect conflicts, measure route length and firing exposure, and enforce construction budgets. Removing their visual overlay does not alter placement rules, saved blueprint geometry, campaign balance or random choices.

Historical route descriptions in earlier release documents describe those archived releases.
