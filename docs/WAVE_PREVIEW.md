# Wave Preview and Enemy Threat Intelligence

Each round starts directly with the existing five-candidate placement-first draft. There is no preliminary preview screen or extra draft-opening action. A concise forthcoming-wave summary appears below peak DPS while the player places candidates, uses Command Points, chooses a keeper and prepares for battle. Both map panels independently collapse into slim lines, preserving their disclosure choices through combat updates and new rounds. Full intelligence is available through Warbands above. The intelligence does not reveal candidates, advance the seeded generator or occupy the bottom draft area. A carried Reserve remains inactive at its fixed map position and is one of the five choices in the new round.

The Warbands overview shows the upcoming wave's name, profile, actual total count and enemy composition. It presents a small set of primary threats and a comparison with the current active army. Enemy **Details** controls reveal optional actual health, armor, speed, resistances and abilities. Possible variants appear separately: each enemy can independently choose a variant, so the preview never promises a per-variant count or an exact random mixture.

The wave after next has only its name, profile and primary threats. It does not reveal individual enemy profiles, counts or numerical statistics. Boss forecasts reveal progressively more information: a distant marker, then identity and profile, then primary traits. The immediate boss wave has the same complete optional enemy details as any other immediate wave. Forecasts respect the selected campaign length and disappear at the campaign boundary.

## Threat analysis

`game/core/wave-threats.js` exports `WaveThreatAnalyzer`. It reads the authored waves, groups, enemies and possible variants, and uses `configuredWarbandInfo` to apply the same effective health, armor, speed and resistance modifiers as combat. Classification comes from implemented mechanics, rather than lore text or manually authored per-wave labels.

Supported classifications cover bosses, high health, heavy or reactive armor, magical resistance or immunity, physical immunity, flying, stealth, teleport steps, speed bursts, swarms, healing, hit shields, direct-hit damage block, evasion, support, defender disruption and gold theft. Repeated groups and categories are aggregated. Tags affecting only some possible variants are marked **Possible**. Population shares and priorities select the primary threats; they are internal classification weights and do not predict the realized variant mix.

The analyzer caches immutable full analyses by wave index. The integration uses zero-based `round - 1` during build, selection and preparation, and `round` during combat to display the next forthcoming wave. The public methods are:

```js
const analyzer = new WaveThreatAnalyzer(data);
const current = analyzer.analyze(index);
const outlook = analyzer.outlook(index, waveLimit);
```

`outlook` returns `{ next, after?, boss? }`. `next` is a full analysis with `index`, `number`, `name`, `profile`, `special`, `totalCount`, `enemies`, `threats` and `primaryThreats`. Each enemy row contains its type, name, count and possible effective `variants`; each variant contains actual stats, trait text, trait glyph kinds, classified threat IDs and a cloned effective enemy profile. `after` is an explicit projection containing only wave identity, profile, special status and primary threats. `boss` contains wave index, number, distance and a visibility level (`marker`, `identity`, `traits` or `full`), with fields added only as visibility permits. Missing future waves are omitted; an unavailable immediate wave is `next: null`.

## Active army comparison

`game/core/army-readiness.js` exports `ArmyReadiness`. It evaluates only defenders whose state is `active`. Draft candidates, inactive reserved defenders and castle walls contribute no attacks or support to this comparison.

```js
const evaluator = new ArmyReadiness(data);
const readiness = evaluator.evaluate(outlook.next, towers);
```

The result contains `activeCount`, `empty`, `rows` and `scope`. A row contains `threatId`, `label`, `response`, `level` and an internal `ordinal`. Rows follow the selected primary threats; standard waves without specific threat tags receive a basic **Focused damage** response. The interface displays **WEAK**, **FAIR**, **GOOD** or **STRONG**, together with a factual explanation of available damage or abilities. It does not display an army score, win chance, predicted outcome or ranked draft pick.

The comparison accounts for actual damage types, immunity, armor, ranged access to flying enemies, applicable control, healing block, attack frequency, multiple-target damage, shields and direct-hit defenses. Only guaranteed self support enters its arithmetic; allied aura overlap and conditional effects still depend on the battlefield. For random profiles, it considers the relevant possible variants without choosing one. An empty army is stated explicitly.

The scope shown in the panel is: **Composition only; placement, range coverage and maze length are not evaluated.** The evaluator caches by immutable analysis and active family/tier composition plus readiness settings. Moving a defender does not alter this composition-only result.

## Presentation and immediate draft

`ui/wave-preview.js` contains a read-only markup helper:

```js
wavePreviewMarkup(model, data, images, {
  compact: true,
  open: false,
  headingId: 'wave-preview-title'
});
```

`model` is `{ ...outlook, readiness }`. Portraits use `images['enemy:' + type]` with a decorative fallback when unavailable. Existing UI icons and enemy defense glyphs provide the symbols. The helper escapes displayed text and attributes, qualifies possible variants, and projects partial and boss forecast fields independently of any extra payload passed by a caller.

`compact: true` creates a native, keyboard-accessible `<details>` panel. `compact: false` creates an expanded section. Numeric enemy detail is always nested under enemy `<details>` controls. The full Warbands overview contains composition, threats, army labels and forecasts without hidden candidate data or draft actions. `ui/warbands-overview.js` filters completed waves using the current round and phase and keeps original numbering. Current combat includes live and queued profiles and boss health. The full guide respects the selected 10- or 50-wave campaign; victory hides every completed wave. `ui/wave-preview.css` and `ui/warbands-overview.css` scope these details.

`ui/wave-preview-flow.js` exports the pure `nextWavePreviewIndex` selector. It maps the established Game phase and round to the forthcoming wave without tracking a separate draft-open state. In `game/main.js`, `#next-wave-summary` sits beneath `#tower-dps` inside `.battlefield-overlays`, while the bottom draft area immediately displays the existing candidates. `ui/next-wave-summary.js` renders only identity, count, effective armor, resistances and abilities; possible variants are qualified without invented per-variant counts. It does not show HP, base speed, readiness or more distant forecasts. Stable native disclosure nodes preserve open state, keyboard focus and scrolling. Internal wheel and touch scrolling do not reach the map controls. The Warbands button remains accessible on narrow screens. Selected enemy inspection remains in the command panel; the generic enemy overview is removed. Placement, Command Point actions and recipe crafting follow their established phase rules. Rendering or changing panel disclosure does not mutate the draft, consume CP or sample randomness.

## Configuration

All classification, forecast and readiness settings live under `wavePreview` in `data/balance.json`. The current defaults are:

| Setting | Default |
| --- | ---: |
| `fullPreviewWavesAhead` | 1 |
| `partialPreviewWavesAhead` | 2 |
| `maxPrimaryThreats` | 3 |
| `maxComplexPrimaryThreats` | 5 |
| `complexThreatCount` | 4 |
| `classification.minimumPopulationShare` | 0.25 |
| `classification.heavyArmor` | 30 |
| `classification.fastSpeed` | 2.5 |
| `classification.swarmCount` | 24 |
| `classification.resistance` | 0.2 |
| `classification.highHealthRatio` | 2.5 |
| `classification.healthBaselineRadius` | 4 |
| `bossForecast.markerDistance` | 10 |
| `bossForecast.identityDistance` | 4 |
| `bossForecast.traitsDistance` | 2 |

Readiness thresholds and arithmetic inputs are configurable through `readiness.minStrongCoverage`, `minGoodCoverage`, `minFairCoverage`, `damageWindowSeconds`, `burstHealthFraction`, `shieldHitsPerSecond`, `minimumUsefulControl`, `regenerationPressureMultiplier` and `areaTargetBudget`. Their numerical values remain internal; only human-readable levels and explanations are shown.

The plain analysis and variant data also provide a future Codex discovery integration point. Discovery progression is separate from the live preview and does not alter what the current intelligence interface reveals.

Optional contextual hints on individual draft cards are deferred. Accurate comparisons would need to account for conditional effects and placement beyond this composition-only evaluation. The full preview, primary threats and current army comparison remain available in Warbands without those optional hints.

## Verification

`tests/wave-preview-ui.test.mjs` verifies actual composition and optional stats, known variants and existing glyphs, partial-preview and boss visibility boundaries, deduplication, readiness labels, empty armies, missing data, escaping, native controls, the absence of draft-opening actions, large rosters and read-only behavior. It also renders the actual campaign analyzer and army evaluator together, confirming that reserved defenders are excluded and future numerical detail remains concealed.

```sh
node --test tests/wave-preview-ui.test.mjs
```

Core analyzer, readiness and wave-selection tests cover their respective calculations, cache behavior, invariants and phase boundaries. Browser review checks both independently collapsible map panels, complete Warbands details, completed-wave filtering, immediately available five-candidate drafts, early wall demolition and individual enemy inspection at desktop and narrow-screen sizes.
