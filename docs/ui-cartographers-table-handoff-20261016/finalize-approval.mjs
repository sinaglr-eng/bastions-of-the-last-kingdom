// Documentation/gallery status only; never modifies game or production assets.
import fs from 'node:fs';
const repo=new URL('../../',import.meta.url),gallery=new URL('output/design/ui-cartographers-table-20261016-v2/',repo);
const read=f=>fs.readFileSync(new URL(f,gallery),'utf8'),write=(f,s)=>fs.writeFileSync(new URL(f,gallery),s);
const entry='../../../docs/ui-cartographers-table-handoff-20261016/README.md';
const current=JSON.parse(read('current-review.json'));
current.status='UI DESIGN APPROVED FOR HANDOFF; GAME NOT IMPLEMENTED; NOT DEPLOYED';
current.approvalRecord='../../../docs/ui-cartographers-table-handoff-20261016/APPROVAL_RECORD.json';
current.implementationHandoff=entry;
current.rules.appearanceScope='UI only; no defender/enemy/map/model/animation/effect changes';
current.rules.previewArt='Original approved geometric authoring-reference illustrations, not model renders or generated UI character art';
current.headerDescription='Eleven approved UI layout studies for iPad and desktop. The implementation handoff is saved. Existing character/map appearance stays unchanged; UI portraits must use approved original geometric reference illustrations.';
write('current-review.json',JSON.stringify(current,null,2)+'\n');
let overview=read('README.md');
overview=overview.replace('**DIRECTION SELECTED FOR FURTHER DESIGN; SCREEN DESIGNS PROPOSED; NOT IMPLEMENTED.**','**UI DESIGN APPROVED FOR HANDOFF; GAME NOT IMPLEMENTED; NOT DEPLOYED.**');
if(!overview.includes('## Approved implementation handoff'))overview=overview.replace('## Studies','## Approved implementation handoff\n\nThe user accepted the current UI design and requested saved implementation materials for Master verze hry. Read the [consolidated handoff]('+entry+') and its approval/scope record. The user then explicitly restricted scope to UI, preserving all defender/enemy/map appearance. Every character preview must come from the original approved geometric illustration used to build that model, never a model render. The generated character/terrain pixels below are layout placeholders and are not approved replacement art. Implementation and publication remain separately authorized. Historical proposed labels in original prompts/reviews are preserved evidence.\n\n## Studies');
overview=overview.replace('final engineering handoff remains unfrozen pending screen review.','the approved consolidated handoff now defines the implementation contract.');
overview=overview.replace('The screen studies require review before the detailed implementation plan is frozen and before separate implementation authorization.','The current UI layout is approved and the consolidated handoff is prepared. Game implementation and publication still require separate authorization in Master verze hry.');
write('README.md',overview);
let notes=read('design-notes.md');
notes=notes.replace('**DIRECTION SELECTED FOR FURTHER DESIGN; SCREEN DESIGNS PROPOSED; NOT IMPLEMENTED.**','**UI DESIGN APPROVED FOR HANDOFF; GAME NOT IMPLEMENTED; NOT DEPLOYED.**');
notes=notes.replace('This working design accompanies the visual studies. It is a design-review draft, not implementation authorization or a frozen final engineering handoff. The original requirement to approve the visual concepts before implementation still applies.','These design notes accompany the visual studies. The user accepted the UI design on October 16, 2026. The [consolidated implementation handoff]('+entry+') now takes precedence and restricts work to UI plus original geometric-reference preview pictures. Existing defender, enemy and map appearance stays unchanged. Game implementation and publication are not authorized by this preparation.');
notes=notes.replace('## Acceptance before implementation approval','## Verification for separately authorized implementation');
notes=notes.replace('Once these screens are accepted, freeze the final component/interaction specification, reconcile every approved 0.3.31 requirement and then request or follow the separate implementation instruction.','The screens are accepted; the saved handoff consolidates the component/interaction specification and preserved 0.3.31 behavior. Follow the separate implementation instruction in Master verze hry.');
write('design-notes.md',notes);
let generator=read('build-gallery.mjs');
generator=generator.replace('Direction A selected for development; screen designs remain proposed.','UI design approved for handoff; game not implemented. Original geometric reference portraits are required.');
generator=generator.replaceAll('Proposed screen design','Approved UI layout reference');
generator=generator.replace('<footer><p>CONCEPT ONLY','<footer><p><a href="../../../docs/ui-cartographers-table-handoff-20261016/README.md">Implementation handoff in the project documentation</a></p><p>CONCEPT ONLY');
// The viewer server serves only the gallery root. Use a local project-file handoff link in README,
// not a broken cross-root navigation item in the HTTP viewer.
generator=generator.replace('<p><a href="../../../docs/ui-cartographers-table-handoff-20261016/README.md">Implementation handoff in the project documentation</a></p>','');
write('build-gallery.mjs',generator);
const ledger=new URL('GAME_DESIGN.md',repo);let gameDesign=fs.readFileSync(ledger,'utf8');
const paragraph='The user subsequently accepted the current Cartographer UI and requested a saved implementation package for Master verze hry. The [approved UI-only handoff](docs/ui-cartographers-table-handoff-20261016/README.md) consolidates 40 requirements, exact interaction/layout rules, implementation and release prompts, 29 acceptance scenarios, 22 selected screenshots and original reference-art provenance for 136 identities. Latest explicit scope: no changes to defender/enemy/map appearance, models, animation or effects; UI previews use approved original geometric illustrations used to create those models, never model renders. Status: **UI DESIGN APPROVED — HANDOFF PREPARED — GAME NOT IMPLEMENTED — NOT DEPLOYED**. This supersedes earlier proposed/unfrozen status for the current redesign only; historical records remain intact. Implementation and production publication require direct authorization in Master. No message has been sent to that chat.\n\n';
if(!gameDesign.includes('The [approved UI-only handoff]'))fs.writeFileSync(ledger,gameDesign.replace('### UI audit backlog, 2026-10-13',paragraph+'### UI audit backlog, 2026-10-13'));
console.log('Saved approved handoff status in current design documentation and gallery metadata.');
