# Score history and game versions

Each run retains the game version that started it. The result screen shows that played version beside the score, and every online leaderboard row has a **Version** column. The default Top 10 combines all game versions within the selected campaign length; 10-wave and 50-wave campaigns keep separate standings.

The statistics service also offers an exact-version filter. Existing clients can continue requesting `/api/leaderboard?mode=50&version=0.3.23`; current clients request `version=all`. A score submission still uses the run's original version, even when a later game update uploads a queued result. The service never changes old run versions to the current release.

Local profiles retain their original best score and now keep `bestScores` by version and campaign plus an ID-based `runHistory`. The stable `bastions.scores.v1` archive protects that history when an older open tab rewrites the earlier `bastions.profile.v1` profile format. Loading and saving merge retained records, and a completed run cannot be replaced with a different version or an inflated later score. Reward checkpoints, end screens, restarts and page unloads record the played version before saving the profile.

A historical scalar best score has no reliable version or campaign metadata. It remains preserved and is labelled **Version not recorded** rather than attributed to the current game. Storage access failures remain non-fatal; the game continues, although durable local storage depends on the browser accepting writes.

The 0.3.24 service update keeps the existing Site, SQLite database, table schema and Drizzle migration history. It changes leaderboard selection and presentation without resetting or deleting score data. A legacy service that rejects `version=all` gets one compatibility probe and an explicitly labelled exact-version fallback; network failures are reported instead of being disguised as that fallback.

Verification covers real completed `Game` runs, SQLite row and schema preservation, stale profile writes, immutable final local records, cross-version `StatisticsClient` uploads, mixed leaderboard ranks and original-version display. The deployment evidence is [backend-deployment-proof.json](../output/design/battlefield-interface-v25/backend-deployment-proof.json). Its production checks use read-only database inspection and HTTP requests; no synthetic score is inserted into the live database.
