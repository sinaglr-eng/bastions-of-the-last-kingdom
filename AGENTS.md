# Gallery language

The user requires the design gallery to remain in English in every future update.

- Write all gallery UI, headings, names, descriptions, controls, validation messages, placeholders, image captions, accessibility labels, and newly authored gallery documentation in English.
- Use English subject names and English number formatting. Do not display Czech name aliases or Czech fallback text.
- Keep gallery generators and verification checks aligned with the English interface, including portable exports and future generated image captions.
- Preserve approved images and original recorded prompts, review records, and source data verbatim. Historical evidence may retain its original language, but must be clearly distinguished from current gallery copy.
- This language rule applies to galleries and their deliverables. It does not change the user's preferred conversation language or unrelated game interfaces.

# One canonical design gallery

The user requires one maintained gallery with tabs, rather than separate galleries for roster, abilities, 3D models and graphic references.

- The current gallery is LOCAL ONLY, as explicitly requested by the user. Maintain the existing source in `sites/defender-faction-atlas-20261021/` and serve its `dist/` at `http://127.0.0.1:59544/` using `Open Bastions Gallery.cmd` or `scripts/Start-LocalGallery.ps1`. Bind the server only to loopback.
- Do not upload, push or publish gallery updates unless the user explicitly requests hosted distribution again. The former Site project `appgprj_6ad904aebc80819188dc27f8b3a41fb4` and its hosted URL are historical records, not the current gallery handoff.
- Keep Roster, Abilities, 3D models, and Graphic references with their details in that gallery. Preserve existing deep links and useful specialist tools.
- Import current visual decisions and source mappings into the shared gallery. Keep combat data and visual-reference revisions distinct; an older modeling package must not overwrite newer combat rules.
- Maintain only the current approved gallery version. Replace obsolete gallery versions and remove previous-version controls and comparison copies; do not create archives or historical gallery snapshots. Preserve approved original artwork, recorded prompts, appearance decisions and local models. Do not create another maintained gallery, duplicate Site, or competing approval flow unless the user explicitly asks for one.
- Reference inspection, generated proposals, human approval, and actual model availability are separate facts. Keep their labels and records accurate.
- Keep 3D model binaries on the local PC. Do not upload GLB, glTF, FBX, OBJ, Blender, or equivalent model files to the Site or its source repository. The Models tab may inspect user-selected local files in the browser without sending them to a server. Graphic references and model metadata may remain in the shared gallery.
- Preserve exact original images alongside the local gallery; web copies may be used for fast browsing. Tie appearance review identity to the exact original image so a delivery format change alone does not reset decisions.

# Game release retention

Maintain only the current approved game release (currently 0.6.11). Do not retain previous game releases, source/production backup packages, release tags or backup branches unless the user explicitly requests one. Replace the current release when a new version is authorized. Preserve current runtime dependencies, approved original artwork and models, exact recorded prompts/reviews, required regression fixtures and player score records. Ordinary Git change history is not a maintained release or backup; do not rewrite it without an explicit request.
