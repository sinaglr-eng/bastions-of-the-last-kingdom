# Wave 24 and late-wave rendering

This presentation and loading patch applies to game 0.6.9. The FR-005 revision 2 rules, Dwarf air-target correction, score cohort, player scores, approved source artwork and GLB bytes remain unchanged.

## Rendering

- Compatible opaque V3 surfaces use constant linear RGB vertex colors instead of separate diffuse color uniforms. All other material settings, decoded image identities, samplers, UV transforms, bone bindings and animation clips must match. Different textures or shading parameters stay separate.
- Enemy dynamic surfaces remain private motion inputs with their original part names, topology and UVs. Compatible outputs are submitted in fewer batches. Identical live poses share submitted buffers; copy-on-write preserves older poses and corpses until their last borrower releases them.
- Approved coordinate-only enemy fields evaluate each exact repeated position once per part. Index-dependent fields retain per-vertex evaluation. UV seams, flat shading and normal calculation remain intact.
- Completed grounded corpses stop rebuilding unchanged object/world matrices. Their full final pose remains until the existing cleanup boundary.
- Repeated castle masonry uses instances of the same geometry and material. Original per-tile meshes remain available to precise tower selection and enemy occlusion. Instances own only their instance buffers.

## Champion readiness

During preparation, the renderer may warm at most two likely results from already revealed ingredients and public recipes. Current-round secrets and latent draw identities are excluded. Placed defenders take priority; warm decoding occupies one background slot and is cleared for combat or graphics interruption. Existing models remain protected until their actual borrowers retire.

A prepared model can appear synchronously on crafting. A first request made while offline, before the shortlist loads, or immediately after a new recipe becomes relevant still depends on transport and decoding; the patch does not promise instantaneous cold network requests.

## Size

The five boss presentations and the seven ordinary V6 sources at least 3.7 native units tall are reduced by 25% from the previous displayed size. The ordinary sources are `host_22`, `host_39`, `host_42`, `host_43`, `host_45`, `host_46`, and `host_49`. Other ordinary enemies retain their displayed size. World picking and attack/status attachment heights follow the new presentation scale. Combat values and routes do not change.

## Evidence and reproduction

Current evidence is in `output/implementation/wave24-current/`. `REPORT.md` distinguishes frozen-layout measurements, moving native animation and active combat smoke checks. Browser timings describe this PC and scene, not a physical iPad or a guaranteed frame rate.

The native audits verify all 258 faction profiles at six actual clip poses and all 54 enemy profiles at six gait and three grounded-fall poses. Independent enemy controls disable palette batching, dynamic batches and coordinate memoization. Exact source arrays and private deformation attributes are compared; transformed submitted positions allow a 2e-5 floating-point tolerance. Source PNG bindings are verified separately from actual browser pixels.

Run the ordinary Node regression suite, `tools/renderer-validation/enemy-dynamic-audit.mjs`, and the production Vite build. `tools/renderer-validation/wave24-review.html` opens on the local Vite server and provides controlled 30-enemy scenes, a corpse fixture, moving animation, active 5× combat, and preparation/crafting checks. These fixtures use the real game and renderer with development mode enabled, no score submission client, and no player record writes. They are rendering stress fixtures, not evidence of legal army acquisition or a full campaign playthrough.
