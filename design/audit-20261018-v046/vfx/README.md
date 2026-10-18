# Attack and ability VFX proposal — B07

Date: **18 October 2026**. **USER-APPROVED DESIGN — NOT IMPLEMENTED — IMPLEMENTATION DEFERRED TO MASTER.** See [the explicit B07 approval](approval.json). Conversation remains Czech; this English specification is suitable for the English animation/design gallery and its future exports.

This adds a separately owned visual effect layer to the existing model-specific motion. It does not redesign defenders, enemies, map, textures, colors or approved source illustrations. It covers **8 basic motion families / 48 rank models, 38 champions and 54 enemy motion models**, with **62 actual current enemy spawn configurations**. No code in this package is loaded by the game.

## Evidence and approval boundaries

The user requested the animation descriptions from **Geometricky 3D design V2** (thread 01a105d0-1804-7cf0-a4f8-36abf65d3472). Its 18 October approval authorizes the motion analysis and beginning animation work: “schvaluji analyzu, priprav detailni popisy pohybu a zacni animovat modely. U zakladnich obrancu zachovej stejny utok pro vsechny ranky.”. The analysis digest matches its approval receipt. Actual detailed specifications were read from the separate worktree at C:/Users/sinag/.codex/worktrees/4a36/Tower Defense game/output/design/motion-animation-v1.

The workshop provides all 140 previews, but its implementation receipt still records **humanAnimationApproval: false** and living-motion gameplay integration as pending. Do not claim final pose approval, baked production clips or completed integration. The latest user decision retains original materials and rejects the material/color revisions. All original evidence is preserved verbatim in [reference.json](reference.json).

Current gameplay authority is the main workspace runtime **0.4.5**, through campaignTowers/campaignEnemies and combat code. Some other-chat role descriptions are older than that adapter. The approved B01–B06 design is separate: see [the balance specification](../../../docs/BALANCE_PROPOSAL_20261018.md). Its +3 exceptions are Nature Spirit and Mother Nature; Archdruid becomes +1. Do not implement balance changes as a side effect of VFX work.

## Visual direction

Use crisp, lightly faceted shapes that belong with the approved geometric models: tapered ribbons, small crystalline chips, low-opacity smoke and clear physical projectiles. Keep silhouettes, health bars and route readable. Source, travel, contact, persistent status and passive aura must be distinguishable. A larger rank may have a slightly fuller treatment, never a new attack type.

The key visible additions are dragon flame from the **animated mouth**, branching electrical links with **small local flashes**, and a **green cloud around each actually poisoned enemy**. Fire, poison, frost, armor break and support keep separate silhouettes and glyphs; color alone never carries all meaning.

## Effect vocabulary and binding

| Effect ID | Proposed appearance | Authoritative trigger | Limits |
| --- | --- | --- | --- |
| physical-contact | Short ivory tip streak or thin blade crescent, then a small directional contact spark. | Actual shot/contact and resolved outcome. | A ranged sword or lance gesture remains ranged. No long-lived slash field or bonus hit. |
| arrow | A clear arrow or bolt with a fine warm-grey trail and brief nock glint. Poison arrows retain their physical shaft with a green tip. | Existing shot, its progress and impact. | One rendered path per actual target; no permanent line or invented volley. |
| arcane | A small faceted violet/cyan spell head, tapered trail and compact geometric impact burst. | Existing spell shot and arrival. | Elven multishot is simultaneous target fan-out; it is not chain lightning. |
| holy | Ivory/gold focus at the actual staff, cross, palm or weapon endpoint; a small travelling spell and radiant impact. | Existing Holy shot and resolved contact. | Holy is a defense class. Color does not add healing, resurrection or armor bypass. |
| runic | Amber angular glyph fragments leave the hammer focus; a compact forged projectile and broken-shield accent at the target. | Engineer shot, actual shred state. | No floor hammer impact at the defender, new melee range or new ground shockwave damage. |
| siege | A visible bolt, bomb, stone or thrown canister leaves the approved release point; a local dust/shard burst at impact. | Actual shot progress and impact; mechanism pose supplies only its release anchor. | Arc height is cosmetic; preserve shot lifetime. Local bomb sparks do not imply new splash or burn. |
| dragon-breath | A narrow bright core with 2–3 low-poly orange flame ribbons opens into a short tapered plume from inside the animated mouth; embers fade toward the affected area. | Existing mouth pose plus active fire channel and visible eligible enemies. Aura-only sources use continuous aura state, not a new attack timer. | Breath is cosmetic. Never turn a circular aura into a directional damage cone, add damage ticks or gate damage by jaw opening. |
| heat-aura | A sparse low orange heat veil near affected enemies and a few lifted embers, with no opaque floor carpet. | Actual continuously applied burn-aura damage and current visibility. | Keep independent of ordinary shots and breath pulses. Do not pretend aura damage creates a lingering burn status. |
| lightning | An angular electric line with a thin white core and blue outer glow. A small target-centred halo flashes for 0.06–0.10 combat seconds; total accent fades in 0.16–0.24 seconds. | Actual primary electric shot, chain packet or fork packet and resolved outcome. | The local halo lights the area using a lightweight overlay/emissive effect, not full-screen flash. A failed hit has contact/block feedback, not a successful-damage flash. |
| chain | Render exactly the emitted enemy-to-enemy connections with short local flashes. Gold-white for Lady Claire, blue-white for Thunderbird. | Actual chain events; retain packet from/to and order. | No invented hops, extra target, delayed damage or second body cast. Simultaneous simulation hops may receive a brief ordered reveal within the visual lifetime only. |
| fork | One origin with several simultaneously visible branching lightning paths to the actual fork targets. | Actual fork proc paths; preserve source-to-target topology emitted by combat. | Visually distinct from a chain. Do not force targets through the primary victim or assume all configured targets were found. |
| frost | An icy faceted shard/ribbon and a small pale-blue impact mist, with Holy ivory in the core where appropriate. | Actual frost shot and outcome. | A frost-colored hit does not prove freeze. The ordinary slow uses a separate restrained status cue. |
| frost-bounce | A pale-blue/ivory bead with a short crystalline ribbon between actual bounce endpoints. Each real contact briefly sheds 2–3 ice chips. | Actual frost chain packets, including Angel allied-hit procs. | Do not use electric zigzags. Do not restart Angel body casting, add allies as enemies or invent a stun. |
| poison-cloud | A small translucent green cloud follows the infected enemy around the lower torso, with 2–4 sparse drifting motes. Keep its centre open so the silhouette stays readable. | Post-resolution enemy.statuses.poison with active applications. | One cloud per enemy, not per poison stack/source. Density has a low cap. No spreading, root cage, immobilization or persistent floor puddle. Hidden enemies emit none. |
| burn-status | Short orange tongues and rising embers cling to the actually burning target; distinguish from green poison smoke. | Active enemy.statuses.burn. | Track real expiry and immunity; do not attach to every fire-looking projectile or every heat-aura tick. |
| slow-status | Frost sources: a quiet broken cyan ring with a few ice grains. Ranger sources: thin teal wind bands around the lower body; flying targets receive bands at body altitude. | Actual strongest effective slow, after immunity/boss rules and aura membership. | Never visually root a merely slowed enemy. One status treatment per target; freeze/petrify takes priority. Ground-only Frozen Celestial follows approved B03 when implemented. |
| stun | A short gold/white star loop above the head and a small impact burst for blunt sources; icy crystals only for genuinely frost-themed sources. | Active freeze status used by the engine as a stun. | Do not apply icy appearance to every generic stun. Match actual duration/recovery; no added knockback or new animation timing. |
| stone-gaze | A low-intensity emerald eye/focus cue identifies an active Golem gaze. Only qualifying visible enemies accumulate a quiet mineral edge accent; actual petrification adds a removable stone shell and crack motes. | Actual source.stoneGaze and per-enemy facing/petrify state. | No guaranteed petrification and no generic status immunity rule: preserve the explicit Golem exception. Do not replace approved body materials. |
| armor-break | A compact amber broken-shield glyph and a few outward metallic flakes; persistent reduction uses a restrained existing status segment. | Actual strongest flat shred/aura contribution. | No model armor removal or additive aura graphics. Champion armor auras remain; MVP armor aura is removed by approved B01. |
| heal-block | A muted rose broken-cross marker with a thin interrupted ring near the target. | Active healBlock status. | No heal-block symbol from poison alone. Do not show healing success while healing is blocked. |
| critical | A stronger directional gold-white impact wedge and up to 3 brighter chips, with optional existing critical indicator. | Resolved effectiveDamage > 0 and confirmed critical result. | No pre-roll critical windup, extra projectile, camera shake or whole-screen white flash. |
| support | Quiet recipient cues: cyan clock arcs for haste; amber blade notch for damage; mint arrowheads for range; ivory reticle for True Strike; lavender shield for control protection. | Actual effective recipient support state; use existing support semantics. | Show source radius/links on inspection. No constant full-radius circles or one effect per duplicate support. Preserve the existing understandable symbols. |
| recover | A small gold-green mote acknowledges the source and keep-health display only after an actual heal. | Confirmed recover event and real health increase. | Never fire on every poison hit or show +1 when the keep was already full. |
| enemy-defense | Magic immunity: amber angular ward; Physical immunity: cool violet broken blade; Refraction: actual charge sectors; Shell: compact grey impact plates; reactive armor: restrained plate accents following live stacks. | Actual spawned variant fields, shield counts, block outcomes and reactiveStacks. | Do not infer abilities from name, color or geometry. Refraction recharge is distinct from HP recharge; Shell is distinct from immunity. |
| enemy-healing | Continuous regeneration: sparse green-gold motes only while effective healing occurs. HP Recharge: one cyan/green inward pulse at an actual successful recharge deadline. | Positive HP gain attributable to regen/recharge, with healBlock and full HP respected. | Proposed read-only healing presentation record is needed to distinguish coincident damage/healing. Net frame HP alone is insufficient; no invented heal event exists today. |
| enemy-control | Dread: a brief violet tether from the actual reaction source, then a small spiral on the affected defender. Disarm: a red broken-weapon sign on the actually disabled defender. Sapper: low dust/amber cracks on truly weakened ruins and affected defenders. | Actual dread deadline, disarm window/protection and weakened state. | A locomotion or weapon flourish cannot cast any of these. Dread is a reaction to real owned damage, not mere proximity or reflected HP damage. |
| enemy-movement | Rush/haste: short backward red/amber motion accents; Blink: a compact departure/arrival fold, not a line across the skipped path; Evasion: a short side-edge wisp only on a real dodge. | Actual active speed window, teleport event or evasion block outcome. | Keep route/gait authoritative. No per-frame footprints for flyers, no physical displacement on evasion and no extra movement ability. |
| stealth | A small grey-violet cloak/reveal puff at a legitimately visible transition, using existing concealment rules. | Authorized reveal/cloak transition and visible endpoints. | No clouds, chains, lights, status icons, tracks or death accents may reveal a concealed position. Flight over water needs no invented splash. |
| mvp-personal | Retain the personal MVP star/badge and inspectable own bonus. An optional quiet personal gold accent follows actual award only. | Actual MVP award/current own level after approved B01. | No ally buff halo, armor-reduction aura, persistent support beam or MVP 10 damage pulse. |
| melancholy | Reserved subdued blue-grey focus with the offensive release suppressed. | Only a nonzero enabled mechanic and actual active melancholy state. | DISABLED in current runtime: chance 0, duration 0. No new Melancholy effect or ability may be activated by this VFX proposal. |

## Basic defenders: one family action across I–VI

Normalized markers below describe the workshop pose. They are **not production delays**: schedule visual preparation before the existing event; do not delay a due shot to reach a marker. The current game event remains authoritative.

| Family | Approved motion / marker | VFX anchor | Effects and constraints |
| --- | --- | --- | --- |
| Soldier (soldier) | Compact forward thrust; spear at I and sword at II–VI use one identical normalized attack. Marker 0.38 | Actual spear/sword tip; contact on the real melee outcome. | physical-contact. One shared thrust for I–VI; no later-rank slash or shield bash. |
| Archer (archer) | Compact repeating draw, release and return, including the same raised preparation at every rank. Marker 0.42 | Actual bow nock at the common release. | arrow. Same draw/release for I–VI; density is capped at high haste. |
| Mage (mage) | Calm forward staff presentation with an unchanged supporting left arm. Marker 0.43 | Actual staff focus. | arcane. Magical cleave uses only real secondary targets, not a new ring of damage. |
| Frost Warden (frostwarden) | Defensive short staff push; faster VI preserves the exact family gesture. Marker 0.4 | Actual staff focus at the short push. | frost, slow-status. Physical hit with frost presentation; display slow rather than automatic freeze. |
| Cleric (cleric) | Gentle forward cross presentation, separate from the passive blessing aura. Marker 0.46 | Cross or staff focus at the common presentation. | holy, support. Passive haste/detection remains independent; a blessing does not create healing. |
| Druid (druid) | Short shallow inward-forward staff sweep with a small free-palm countergesture. Marker 0.41 | Actual staff focus during its shallow sweep. | arcane, poison-cloud. Green thorn/spore projectile; replace misleading immobilizing root cage with poison cloud. |
| Engineer (runebreaker) | Short forceful hammer projection with a small downward finish; ranged runic bolt, not melee contact. Marker 0.36 | Actual hammer focus at its short projection. | runic, armor-break. Display name Engineer; ranged runic shot, not ground hammer melee. |
| Stormcaller (stormcaller) | Crisp right-palm lightning presentation with a brief recoil; one discharge for simultaneous selected targets. Marker 0.35 | Actual right palm; existing book remains supported. | lightning. Up to three current simultaneous primary target paths, not a new chain proc. |

## All 38 champion assignments

The action column is the approved analysis reference, preserved verbatim. Counts and mechanics in VFX follow current runtime plus separately integrated approved balance fields. See the discrepancy table before using any historical role prose.

| Champion / stable ID | Motion reference | Assigned attack and ability effects |
| --- | --- | --- |
| Frostsword Watchmen / rimewatch | Drive one short diagonal cut from the torso; the second hand follows the hilt instead of sliding independently along the blade. | An icy edge ribbon leaves the two-hand diagonal sword cut; one frost shard reaches the actual ranged target. Channels: frost, slow-status |
| Frost Knight / frostblade | Extend the right shoulder and elbow in a short lance thrust, retaining the shield and rein relationship on the opposite side. | A narrow lance-axis streak and travelling physical strike; pale-blue slow and secondary cleave accents appear at actual affected targets. Channels: physical-contact, slow-status |
| Lionheart Champion / roseguard | Deliver a precise forward jab with restrained torso rotation, retaining the lion shield silhouette, rein control and a stable pelvis over the saddle. | A precise lance-line strike; lion-gold critical impact only after the real roll. Channels: physical-contact, critical |
| Kingslayer / highking | Unwind into one forceful oblique cut, keeping the sword clear of the horse neck and the left rein hand throughout its arc. | A brief oblique sword-edge trace and ranged strike; separate compact slow/cleave/critical target feedback, never extra swings. Channels: physical-contact, slow-status, critical |
| King / crownofages | Execute a compact commanding downward cut, transferring rotation through the torso without pulling the pelvis away from the saddle. | One commanding downward sword trace; steel/gold target strike and broken-shield accents at real shred victims. Channels: physical-contact, armor-break, slow-status, critical |
| Elven Ranger / thornwarden | Complete a short draw with the string visibly following the hand; keep the left arm supportive rather than unnaturally locked straight. | One bow release fans into the actual three-target volley; fine leaf-green trim remains cosmetic. Channels: arrow |
| Elven Elite Warrior / verdantguard | Hold a compact full-draw silhouette, right elbow behind the shoulder line and left wrist aligned with the bow grip. | One expert release produces up to five actual arrow paths; short bright tips keep the volley readable. Channels: arrow |
| Elven Mage / tempest | Open the palm and extend the chest a little while the right hand steadies the staff, creating a clear focus-to-target line. | Violet/cyan focus-to-target spell fan for up to five real targets. Decorative crystals do not fire independently. Channels: arcane |
| Elven Archmage / stormcitadel | Present the staff crown and open the palm through a broad shallow gesture; remain centered instead of lunging toward the lane. | An ivory-cyan crown focus emits up to ten real simultaneous spell paths, with restrained shared release glow. Channels: arcane |
| Baby Fire Dragon / embercrown | Open the muzzle slightly and broaden the wing roots while heat presence remains continuous around the already implemented aura area. | Small orange mouth plume and sparse nearby embers while the existing circular fire aura affects enemies. No ordinary damaging projectile. Channels: dragon-breath, heat-aura |
| Mother Fire Dragon / worldfire | Lift the head and open the jaw modestly as wing roots spread; this expression communicates heat and does not initiate a new damaging exhalation. | A wider layered orange plume follows the opened mouth; stronger local embers identify the same continuous aura role. Channels: dragon-breath, heat-aura |
| Thunderbird / starfall | Give one firm downstroke and short forward head emphasis; a small torso pitch supplies intent while preserving the bird silhouette. | Wing/beak release emits a small electric-looking primary spell; real conditional secondary arcs flash locally. No guaranteed chain on every wingbeat. Channels: arcane, chain, lightning |
| Elemental Male Dragon / thunderheart | Project the head in a short decisive normal attack, using wing-root expansion rather than inventing a human arm-casting action. | Separate the mouth electric primary attack from low orange heat breath/embers; actual fork proc branches from its runtime origin. Channels: lightning, fork, dragon-breath, heat-aura |
| Ancient Dragon Patriarch / phoenix | Lift and project the muzzle once as wing shoulders broaden, retaining the ancient layered-scale silhouette and a connected rigid horn crown. | A heavy orange mouth attack with a sparse venom-green tip; infected targets get green smoke, while actual fork lightning remains an independent white-blue accent. Channels: dragon-breath, heat-aura, poison-cloud, fork |
| Master Druid / greenheart | Extend the focus hand in a short offering-like cast while the right wrist and staff provide a steady counterline. | A green faceted thorn/spore spell leaves the offering-like hand/staff focus; low translucent poison follows real infected targets. Channels: arcane, poison-cloud |
| Archdruid / eldergrove | Extend the palm and direct the staff crown along the target line, using a small wrist action rather than a spear-like physical lunge. | Green focus-to-target thorn spell; quiet recipient range arrowheads show approved +1 support without repeated buff casting. Channels: arcane, poison-cloud, support |
| Ballista / kingsreach | Release the latch so both limbs unload together and the continuous string advances symmetrically toward its relaxed position. | A visible heavy bolt leaves the actual string nock as limbs unload; metallic flakes identify target armor reduction. Channels: arrow, armor-break |
| Priest / sunward | Open the palm in a concise benediction as the torso rises gently and the right hand steadies the tall staff. | Ivory/gold staff focus and a small radiant projectile; existing support symbols remain quiet between attacks. Channels: holy, support |
| Frozen Celestial / winterhold | Give a short forward-downward blade presentation, letting connected faceted torso segments turn rather than squash as if made of soft flesh. | Pale Holy frost leaves the forward-downward blade presentation. The low cold veil marks real slow recipients; approved ground-only restriction applies after B03 integration. Channels: frost, slow-status |
| Archangel / dawnspire | Present one measured downward stroke, using the empty hand as counterbalance and preserving a stable center above the original footprint. | A restrained golden sword-edge release with an icy-white core; cold recipient cues remain independent of haste and detection. Channels: holy, slow-status, support |
| Dwarf Firebomber / royalmarshal | Make a compact three-quarter toss, elbow leading and hand opening without tearing the work-coat sleeve away from the arm. | A lit-fuse bomb leaves the three-quarter hand toss; compact orange sparks/dust at the actual single target. Armor aura remains an independent amber cue, not a burning spray. Channels: siege, armor-break |
| Catapult / stonewarden | Accelerate the arm forward as one lever; the bowl carries the stone until the clearly defined release rather than letting it float beforehand. | Stone leaves the real throwing bowl; dust/chips at contact and a gold star loop only if the actual stun succeeds. Channels: siege, stun |
| Ranger / wyvernhunter | Draw along the arrow axis with the right elbow clearly behind the shoulder; raise the bow only for an airborne selected target. | A clean arrow follows the aimed bow axis; anti-air armor/slow accents apply only to eligible flying targets. Channels: arrow, armor-break, slow-status |
| Elven King / royalarsenal | Extend the palm in a brief royal command and emphasize the staff, avoiding both an archer’s draw and mechanical recoil. | Three real magical spell paths leave the commanding hand/staff focus. Use a regal gold/cyan spell identity; no catapult rock or fourth shot from decorative spirits. Channels: arcane |
| Nature Spirit / rangermentor | Unfurl that arm toward the target as the upper presence rotates slightly against the slower lower seed orbit. | A green spore spell leaves the unfurling focus hand; quiet mint range/ivory aim symbols preserve current +3 allied range bonus. Channels: arcane, poison-cloud, support |
| Paladin / kingdomprotector | Drive one compact forward-downward stroke through hips and torso while keeping the left guard between the body and the attack direction. | A short gold hammer-edge trace and travelling Holy strike follows the existing ranged release; lavender protection belongs to actual recipients. Channels: holy, support |
| Mother Nature / mothernature | Present the palm firmly and incline the root staff toward the target, retaining the calm face rather than delivering a physical staff blow. | Root-staff focus emits a vivid green thorn/spore projectile; a single bounded cloud marks each poison victim, and recipient range/aim cues retain +3. Channels: arcane, poison-cloud, support |
| Master Ranger / royalranger | Complete a tight expert draw with minimal chest sway and clear contact between glove, real string and nocked arrow. | Physical arrow with a green venom tip; actual poison and flying-hit debuffs plus rare confirmed keep recovery. Approved new general slow aura uses teal wind bands. Channels: arrow, poison-cloud, armor-break, slow-status, recover |
| Dark Ranger / kingsrangerguard | Reach full draw with restrained torso rotation, visible face below the hood and the right wrist beside the cheek rather than inside it. | A dark steel arrow with a muted blue-violet edge; flying-hit debuffs stay target-specific. Approved general slow aura uses teal wind bands, with no invented poison. Channels: arrow, armor-break, slow-status |
| Ranger Oathbreaker / elvenking | Use a decisive full draw and slight forward chest emphasis, preserving coherent angular bow limbs, visible string and glove contact. | One strong physical arrow; only actual Burned proc creates a local orange radial burst over real victims. Instant fire splash is not a lingering burn status unless one exists. Approved aura uses teal wind bands. Channels: arrow, slow-status, burn-status |
| Fire Ballista / fireballista | Unload both limbs together in a crisp symmetrical snap, moving the nock forward through the center instead of twisting the entire bow frame. | A heavy bolt with a small ember tip leaves the nock; actual burn clings to the target, alongside a compact broken-shield accent. Channels: arrow, burn-status, armor-break |
| Golem / emeraldgolem | Present the forearm weapon squarely and give one short release recoil instead of making the whole construct throw or detach its fist. | A stone/metal forearm projectile and short recoil; real armor break/stun feedback. Only an active gaze lights the eye focus and only actual petrification adds the stone shell. Channels: siege, armor-break, stun, stone-gaze |
| Dwarf Griffin bomber / griffinbomber | Toss overhand clear of beak and feathers, preserving left-hand rein control and stable rider hips throughout the throw. | A bomb leaves the rider hand above the beak; local orange fragments and actual stun stars. The mount does not breathe fire; armor aura stays independent. Channels: siege, armor-break, stun |
| Dwarship / mechanicalgolem | Use a short outward-downward right-arm throw with the left hand on the rail, retaining coherent coat, glove and beard contacts. | A toxic canister follows the approved right-hand throw, not an invented cannon firing gesture. Target poison smoke is separate from the real local slow/heal-block area and independent armor aura. Channels: siege, poison-cloud, armor-break, slow-status, heal-block |
| High Priest / monk | Present the staff briefly and use a calm chest-led chant gesture, retaining a clear sun emblem and readable book cover. | A short ivory/gold staff release while the book remains supported; quiet recipient clock, blade and shield cues identify the actual support. Channels: holy, support |
| Archbishop / archbishop | Extend one measured benediction from elbow and wrist; a slight chest rise distinguishes the action from idle without a large body sway. | Measured gold-white benediction and projectile; continuous support uses a quiet distinct Otomad clock accent, never one pulse per accelerated allied shot. Channels: holy, support |
| Angel / archangel | Extend palm and focus in a soft outward cast with small wing-root lift rather than a sword-warrior slash or charging movement. | Soft palm/orb frost release. Allied-triggered frost beads follow actual bounce packets, with a small focus acknowledgment that does not restart the body cast. Channels: frost, frost-bounce, slow-status |
| Lady Claire / ladyclaire | Open the palm and give a concise staff emphasis while preserving poised expression and stable gown silhouette, without a heavy warrior lunge. | Gold-white focus at the actual ring-staff endpoint; distinct sequential chain and simultaneous fork paths illuminate only actual target surroundings. No Melancholy cue while disabled. Channels: holy, chain, fork, lightning |

### Dragon presentation without changing damage

- Baby Fire Dragon and Mother Fire Dragon have zero direct damage and a continuous circular heat aura. Use a mouth plume tied to their existing breathing pose, plus sparse embers on actual affected enemies around the full aura. No damaging cone, new projectile or breath cooldown.
- Elemental Male Dragon has a direct electric presentation, continuous heat and a conditional fork. Those three channels can coexist; the primary mouth flash and a brief heat plume must remain readable as different effects.
- Ancient Dragon Patriarch uses fiery mouth release, continuous heat, poison and actual conditional forks. Poison smoke belongs to successfully infected targets and persists for their real status lifetime.
- Never infer a critical, evasion bypass, transformation or resurrection from an outdated description or the stable ID phoenix.

### Poison, slow and composite target effects

One target owns one poison-cloud instance regardless of source/stack count. Suggested normal radius is 0.25–0.45 tile around the lower torso, scaled to the actual model bounds; opacity 0.12–0.22, sparse maximum 4 motes on iPad. These are approved initial art targets, not measured performance results. Preserve the centre opening and keep nearby green clouds from forming an opaque wall. Render at body height for flying targets. Reconcile from the actual post-resolution status state; a shot or generic impact cannot establish infection.

Persistent poison/burn/slow can coexist. Keep poison as small smoke behind the target, burn as sparse flames near its edge and slow as thin lower-body bands. Freeze/petrify suppresses redundant moving slow accents while retaining the correct inspectable status. The cloud is cosmetic and never spreads poison, immobilizes enemies or changes duration. On expiry/death, emission stops immediately; any final cosmetic fade must remain visibly detached and must not survive concealment.

Ranger slow uses teal wind bands, not binding roots. Frozen Celestial uses cold dust only on actual ground recipients after B03. Neither aura expands with a range bonus unless the separately approved combat field explicitly does so.

## Enemy abilities: dispatch from actual variants

Locomotion animation describes weight and gait, not a combat cast. Existing hostile units generally traverse the route and trigger their configured abilities; do not turn weapon swings, jaws or drum motion into new attacks against defenders. Preserve approved one-shot death motion. Ground foot dust is optional and sparse at actual contacts; no ground dust for flight or smoke that reveals hidden movement.

The following table covers every enemy motion identity. Its source fields are obtained by merging the actual variant over the base. The six Moon Clan pairs share model geometry and have separate runtime configurations in mapping.json; the four alternate wraith identities keep their separate motion/anatomy.

| Motion model / name | Actual current spawn configurations and ability fields | VFX channels |
| --- | --- | --- |
| host_01 / Orc Skull Scavengers | Orc Skull Scavengers [host_01]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_02 / Goblin Thornstriders | Goblin Thornstriders [host_02]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_03 / Ogre Gluttons | Ogre Gluttons [host_03]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_04 / Orc Scrap Tinkers | Orc Scrap Tinkers [host_04]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_05 / Bat Scouts | Bat Scouts [host_05]: no special fields; Bat Scouts · Moon Clan [host_05]: evasion=0.25 | enemy-movement |
| host_06 / Mossback Trolls | Mossback Trolls [host_06]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_07 / Marsh Orc Hunters | Marsh Orc Hunters [host_07]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_08 / Shadowblood Trolls | Shadowblood Trolls [host_08]: regen=0.2, stealth=true | enemy-healing, stealth |
| host_09 / Goblin Dust Dancers | Goblin Dust Dancers [host_09]: evasion=0.25 | enemy-movement |
| host_10 / Mogrok, the Gatebreaker | Mogrok, the Gatebreaker [host_10]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_11 / Orc Hookbearers | Orc Hookbearers [host_11]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_12 / Goblin Bell Devourers | Goblin Bell Devourers [host_12]: disarm=true | enemy-control |
| host_13 / Red Tusk Orc Huntresses | Red Tusk Orc Huntresses [host_13]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_14 / Orc Mirror Shieldbearers | Orc Mirror Shieldbearers [host_14]: refraction=3 | enemy-defense |
| host_15 / Blood Bat Riders | Blood Bat Riders [host_15]: regen=0.2; Blood Bat Riders · Moon Clan [host_15]: evasion=0.25, regen=0.2 | enemy-healing, enemy-movement |
| host_16 / Orc Ash Pickpockets | Orc Ash Pickpockets [host_16]: magicImmune=true, thief=50 | enemy-defense |
| host_17 / Cursed Totem Trolls | Cursed Totem Trolls [host_17]: untouchable=0.75 | enemy-control |
| host_18 / Silent Orc Executioners | Silent Orc Executioners [host_18]: stealth=true, disarm=true | enemy-control, stealth |
| host_19 / Bloodwolf Orc Riders | Bloodwolf Orc Riders [host_19]: rush=5 | enemy-movement |
| host_20 / Gorvash, the Bone Patriarch | Gorvash, the Bone Patriarch [host_20]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_21 / Rotroot Trolls | Rotroot Trolls [host_21]: regen=0.2 | enemy-healing |
| host_22 / Iron Ram Ogres | Iron Ram Ogres [host_22]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_23 / Shard-Soul Orc Warlocks | Shard-Soul Orc Warlocks [host_23]: physicalImmune=true, refraction=3 | enemy-defense |
| host_24 / Riveted Goblin Mutants | Riveted Goblin Mutants [host_24]: reactiveArmor=8 | enemy-defense |
| host_25 / Iron Bat Orc Riders | Iron Bat Orc Riders [host_25]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_26 / Orc Spell Eaters | Orc Spell Eaters [host_26]: magicImmune=true | enemy-defense |
| host_27 / Spectral Bat Riders | Spectral Bat Riders [host_27]: physicalImmune=true, untouchable=0.75; Spectral Bat Riders · Moon Clan [host_27]: physicalImmune=true, evasion=0.25, untouchable=0.75 | enemy-defense, enemy-control, enemy-movement |
| host_28 / Goblin Scrapwings | Goblin Scrapwings [host_28]: reactiveArmor=8; Goblin Scrapwings · Moon Clan [host_28]: evasion=0.25, stealth=true | enemy-defense, enemy-movement, stealth |
| host_29 / Prismatic Bat Tricksters | Prismatic Bat Tricksters [host_29]: evasion=0.25, refraction=3; Prismatic Bat Tricksters · Moon Clan [host_29]: evasion=0.25, refraction=3 | enemy-defense, enemy-movement |
| host_30 / Zaruun, Lord of Storm Wings | Zaruun, Lord of Storm Wings [host_30]: no special fields | No invented attack or ability VFX; optional sparse grounded dust. |
| host_31 / Orc Dual-Seal Inquisitors | Ashen Dual-Seal Inquisitors [host_31-ember]: magicImmune=true, refraction=3 | enemy-defense |
| host_32 / Soul-Drinker Trolls | Soul-Drinker Trolls [host_32]: recharge=0.5 | enemy-healing |
| host_33 / Orc Wraiths of the Shattered World | Orc Wraiths of the Shattered World [host_33]: physicalImmune=true, blink=6 | enemy-defense, enemy-movement |
| host_34 / Goblin Gallows Fliers | Goblin Gallows Fliers [host_34]: evasion=0.25, thief=50 | enemy-movement |
| host_35 / Eclipse Bat Guard | Ashen Eclipse Bat Riders [host_35-ember]: magicImmune=true | enemy-defense |
| host_36 / Orc Oathbreakers | Ashen Oathbreakers [host_36-ember]: magicImmune=true | enemy-defense |
| host_37 / Riftwolf Orc Riders | Riftwolf Orc Riders [host_37]: blink=6 | enemy-movement |
| host_38 / Black Marsh Knifemen / Blood-Leech Trolls | Black Marsh Knifemen [host_38]: stealth=true, disarm=true | enemy-control, stealth |
| host_39 / Thunder Manta Orc Riders | Thunder Manta Orc Riders [host_39]: evasion=0.25, untouchable=0.75, krakenShell=100 | enemy-defense, enemy-control, enemy-movement |
| host_40 / Vorlak, the Hollow Sky King | Vorlak, the Hollow Sky King [host_40]: krakenShell=110 | enemy-defense |
| host_41 / Orc Crystal Phalanx | Orc Crystal Phalanx [host_41]: refraction=3; Orc Crystal Phalanx · Moon Clan [host_41]: evasion=0.25, refraction=3 | enemy-defense, enemy-movement |
| host_42 / Fire Bat Orc Lancers | Fire Bat Orc Lancers [host_42]: magicImmune=true, rush=2 | enemy-defense, enemy-movement |
| host_43 / Ogres of the Imprisoned Souls | Ogres of the Imprisoned Souls [host_43]: evasion=0.25, untouchable=0.75, recharge=0.5 | enemy-healing, enemy-control, enemy-movement |
| host_44 / Orc Ash Executioners | Orc Ash Executioners [host_44]: magicImmune=true, blink=6 | enemy-defense, enemy-movement |
| host_45 / Flying Drummers of the Black Horde | Flying Drummers of the Black Horde [host_45]: hasteAura=1.5, disarm=true | enemy-control, enemy-movement |
| host_46 / Ogre Revenants in Hollow Armor | Ogre Revenants in Hollow Armor [host_46]: physicalImmune=true | enemy-defense |
| host_47 / Orc Riders of the Last Howl | Orc Riders of the Last Howl [host_47]: magicImmune=true, untouchable=0.75, rush=5 | enemy-defense, enemy-control, enemy-movement |
| host_48 / Bat Thieves of Black Fire | Bat Thieves of Black Fire [host_48]: magicImmune=true, evasion=0.25, disarm=true, thief=50 | enemy-defense, enemy-control, enemy-movement |
| host_49 / Troll Guardians of the Deep Maw | Troll Guardians of the Deep Maw [host_49]: krakenShell=200, recharge=0.5 | enemy-defense, enemy-healing |
| host_50 / Lord Bernhard | Lord Bernhard, the Black Sorcerer on the Wyvern Queen [host_50]: krakenShell=210; Lord Bernhard, the Black Sorcerer on the Wyvern Queen [host_50-tyrant]: magicImmune=true, krakenShell=210; Lord Bernhard, the Black Sorcerer on the Wyvern Queen [host_50-devourer]: krakenShell=273 | enemy-defense |
| host_31-wraith / Spectral Dual-Seal Inquisitors | Spectral Dual-Seal Inquisitors [host_31-wraith]: physicalImmune=true, refraction=3 | enemy-defense |
| host_35-wraith / Spectral Eclipse Bat Riders | Spectral Eclipse Bat Riders [host_35-wraith]: physicalImmune=true | enemy-defense |
| host_36-wraith / Spectral Oathbreakers | Spectral Oathbreakers [host_36-wraith]: physicalImmune=true | enemy-defense |
| host_38-wraith / Blood-Leech Trolls | Blood-Leech Trolls [host_38-wraith]: regen=0.25 | enemy-healing |

Important distinctions:

- Physical/Magical immunity uses distinct ward shapes and actual defense outcomes. These are not elemental resistances. Holy does not grant every companion status an immunity bypass.
- Refraction charge sectors follow actual shields. Their return follows shield recharge; green HP regeneration and periodic HP Recharge are different effects.
- Blood-Leech Troll (host_38-wraith) has regeneration and removes the knifer variant’s stealth/disarm. Never inherit the knifer’s ability cues just because the base wave is the same.
- Moon Clan Goblin Scrapwings replaces reactive armor with stealth and has evasion. Other Moon Clan effects are read from actual merged fields; the clan name alone is insufficient.
- The final boss has three current runtime variants: ordinary Shell, magic-immune Tyrant and stronger-Shell Devourer. They share the workshop host_50 motion reference, while their real variant identity and existing appearance remain unchanged. Their ability cues must stay distinct.
- Legacy sapper/shaman/berserker branches test type, not model. A similarly named campaign model alone cannot grant a new sapping, haste or rage effect.
- Dread affects the actual damaging defender after a real reaction, including DOT. It is not a damage-reflection beam. Disarm follows current windows and protection; its visual source cannot add an attack.
- Blink shows only visible actual departure/arrival; no trail through skipped route. Evasion gets a brief edge wisp after an actual dodge, without changing actor position.
- Thief feedback occurs at actual leak/economy loss. No flying coins or invented stealing projectile during normal movement.
- Boss size scales anchors and local effect width, not particle counts in direct proportion to body area. Ordinary status cues remain distinct from the existing boss HP display.

## Discrepancies resolved for this proposal

| Subject | Historical description / current mismatch | Binding decision |
| --- | --- | --- |
| Elven Ranger | Motion text refers to four targets. | Runtime multishot is 3. Keep one release, show only the actual three or fewer targets. |
| Elven Elite Warrior | Motion text refers to seven targets. | Runtime multishot is 5. Keep one release, show only actual targets. |
| Frost Knight / Kingslayer / King | Some motion role text calls cleave Pure. | Current cleave defense class is Physical. Do not restore obsolete Pure bypass. |
| Elven Mage / Elven Archmage | Current visual dispatcher groups them with lightning sources. | Proposed ordinary attack is arcane fan-out, not an extra chain ability. |
| Elven King | Stable ID royalarsenal is currently grouped with lobbed siege visuals. | Approved gesture is a staff/palm command; current damage is Magical, multishot 3. Use spell paths. |
| Dwarship | Current renderer presents a cannon toxic dart; motion specifies a hand throw. | Use the approved thrown-canister release. Poison is present, so infected targets receive cosmetic smoke. No new AOE poison. |
| Fire Ballista | Historical motion text says the Fire name adds no burning. | Current runtime explicitly has burnDps 120 / 3 seconds. Show actual burn. |
| Lady Claire | Motion analysis includes Melancholy cancellation. | Runtime chance and duration are both 0. Keep dormant support only, no activation. |
| Dragons | Some runtime prose mentions critical hits or evasion bypass. | No live critChance or trueStrike on these dragon profiles. Do not infer extra effects from prose or ID phoenix. |
| Angel / Archangel | Stable IDs archangel and dawnspire can be misleading. | archangel = Angel with allied-triggered frost bounces; dawnspire = sword-bearing Archangel. |
| Enemy variants | A shared base ID or Moon Clan name can obscure overrides. | Merge actual spawned variant over base. Blood-Leech Troll is regen, not stealth/disarm; Moon Scrapwings replace reactive armor with stealth plus evasion. |
| Legacy enemy archetypes | Some combat branches test enemy.type === sapper/shaman/berserker. | A campaign model field with that name does not activate the legacy type branch. Do not assign sapping, proximity haste or low-HP rage merely from model appearance. |

## Implementation contract for later work

| ID | Requirement | Acceptance intent |
| --- | --- | --- |
| V01 | Visual layer only | No change to damage, targets, timings, RNG, status durations, immunity, route or economy. B01–B06 remain a separate approved balance change. |
| V02 | Preserve approved assets | Keep V7/V8/V6 geometry, rig, materials, textures, palettes, source images, original prompts and motion originals byte-identical. Temporary external overlays are separately owned and removable. |
| V03 | Shared basic identity | I–VI share the approved family motion and VFX vocabulary. Rank may modestly raise clarity/detail within caps; never add extra attacks, beams or huge clouds. |
| V04 | Authoritative events | Animation describes preparation/release. Only actual shot, resolved damage, proc, current status and effective aura state create gameplay VFX. |
| V05 | Moving anchors | Use actual animated world-space mouth, palm, staff focus, bow nock, throwing hand/bowl or weapon tip; bind per model through verified metadata in new paths, not a guessed height offset. |
| V06 | No temporal distortion | Keep shot lifetime, progress, target and impact. Shortened animation recovery under haste cannot delay shots or stack new anticipations. One body release can accompany simultaneous multishot. |
| V07 | Separate channels | Persistent aura, direct attack, proc and target status are independent channels. One target with poison/burn/slow receives a bounded composite cue. |
| V08 | Correct target feedback | Blocked/evaded/immune hits can show appropriate contact/defense feedback, but no successful-damage flash or status cue unless the runtime effect exists. Generic impact alone is insufficient. |
| V09 | Visibility | Respect actual reveal state for sources, targets, paths, lights, smoke, footprints and deaths. Hidden endpoints suppress the revealing path; no effect reveals a hidden enemy. |
| V10 | Ground and flight | Use target body altitude; ground-only effects follow B03 after integration. Poison smoke follows flying victims at body level; ground status rings never falsely attach them to the floor. |
| V11 | Readable color and shape | Poison = green smoke/drop; burn = orange tongues; electric = angular line; frost = pale shards; Holy = ivory/gold core. Use glyph/shape as well as color; retain established effect symbols. |
| V12 | Local flash only | Lightning briefly brightens a small area around actual targets. No camera shake, full-screen strobe, permanent bloom wash or point light for every projectile. |
| V13 | Quiet auras | Ordinary combat shows affected recipients and sparse source accents. Full support/slow/shred radii and source links appear on inspection; do not cover the map with circles. |
| V14 | Approved balance compatibility | No MVP ally/armor aura after B01. Preserve champion armor auras. Archdruid +1; Nature Spirit/Mother Nature +3. Ranger auras and Frozen Celestial ground targeting read actual integrated fields, never activate from this mapping alone. |
| V15 | Pause, speed and reduced motion | Use one combat clock with speed applied once. Pause freezes transient and persistent motion. Reduced motion removes flash/repeated wobble and uses static angular links/status glyphs without losing information. |
| V16 | Budgets and lifecycle | Pool and batch VFX; seed visual variation separately from gameplay RNG. Cap clouds by target and detail by screen space. Dispose on death, expiry, hide, reset and scene teardown; no stale source links. |
| V17 | Review in context | Preview isolated release/travel/hit/proc/status and crowded battles at iPad/desktop scale, both immunity variants, flying targets, pause, high haste and reduced motion. A preview must explicitly distinguish forced demonstration from actual proc probability. |
| V18 | Approval and execution boundary | The user explicitly approved B07 on 18 October 2026. Implementation remains deferred to Master verze hry; design approval does not authorize implementation in this chat or production deployment. |

Reuse and refine existing CombatEffects, support-effect glyphs and enemy-effect presentation instead of running a second duplicate renderer. Existing production already has flame streams, lightning, impacts, aura/status glyphs and concealment handling. This proposal improves fidelity, anchors, target status treatment and graph distinctions; it does not claim those effects are currently absent.

Read existing shot/chain/aura-attack/impact/hit/critical-hit/deflect/teleport/recover/death events and effective support/status state. **impact is emitted even when a hit fails**; hit is emitted before applyEffects, so reconcile statuses after the combat step. An aura-attack target is a representative visual target, not a complete victim list. A chain packet can exist without positive damage, so connection and successful-damage flash are separate. These event limitations require explicit handling.

Some states have no dedicated presentation event. If needed later, add read-only records for heal cause/actual amount, status transitions or resolved proc victims without additional RNG or changes to ordering/damage. Name these as proposed presentation records; do not pretend that such events already exist. Any observer must be validated against real resolved combat data. Preserve exact actual chain topology and immunity outcome.

Socket binding is a new external metadata layer keyed by stable identity plus approved mesh/rig version. Use actual animated world transforms, including articulated jaws and loaded skinned meshes; do not patch approved GLBs. Grounded weapon holders do not leap to force a ranged contact. Dwarship’s approved throw uses its hand anchor despite the legacy cannon effect. Preview-only lookahead uses a known shot schedule; production must never add windup latency. Missing lookahead degrades visual anticipation, not combat timing.

### Proposed iPad/desktop budgets

These are initial acceptance targets to measure later, not benchmark claims:

- iPad: at most 96 detailed transient instances, 256 batched status billboards/motes, 4 simultaneous detailed breath plumes, and 0 added dynamic lights or full-screen postprocess passes for VFX. Basic projectile/connection representation must remain available through a lightweight batch when detailed capacity is exceeded.
- Desktop: at most 192 detailed transient instances, 512 batched status billboards/motes and 8 detailed breath plumes. Keep the same no-per-shot-light architecture.
- Aim for at most 12 extra batched VFX draw calls on iPad and 20 on desktop under the reference crowded scene. Profile alpha overdraw and CPU reconciliation, not only geometry counts. If budgets fail, simplify sparks/smoke before dropping readable primary paths or critical status glyphs.
- Measure near/far zoom and real campaign maximum density on a named physical iPad model and desktop configuration; record render resolution, FPS/frame times, active counts and quality tier. No FPS guarantee is made by this document.
- Under high haste, coalesce local flash accents by target within a short combat-time window. Do not merge gameplay hits, alter projectile timing or let visual variation consume the gameplay RNG stream.

## Future validation checklist

1. One row for every one of 8 basic families, 38 champions and 54 enemy motion identities; 48 basic rank IDs remain linked.
2. Source approval analysis SHA-256 matches the approval receipt; preserve all approved original assets and source materials.
3. No gameplay RNG draw, damage/status call, target selection or clock change originates from presentation.
4. Every basic I/VI pair keeps the same gesture, source anchor identity and effect vocabulary.
5. Four dragon mouth plumes remain attached through jaw opening, turns, pause and reset; no throat clipping or chest-origin flame.
6. Aura-only Baby/Mother dragons keep circular continuous damage, including affected enemies outside the illustrative plume direction.
7. Direct dragon shots, ongoing heat and fork procs render independently without resetting each other.
8. Stormcaller multishot, Thunderbird chain, Lady Claire sequential chain and fork have the actual distinct graph topology.
9. Angel frost bounce is icy, can originate from the allied-hit proc, and does not restart the ordinary body cast.
10. A real poison application adds one green cloud; additional stacks modify bounded density only. Expiry removes it.
11. Poison blocked by immunity/shield/evasion creates no infection cloud; hidden infected targets reveal no smoke.
12. Dwarship local slow/heal-block victims are not automatically poisoned or damaged by the decorative burst.
13. Generic Catapult/Griffin stun uses star feedback; frost slow is not rendered as full immobilization.
14. Golem gaze requires the actual proc/facing state; petrification shell appears only on actual petrify, with the explicit immunity exception preserved.
15. Fire Ballista shows actual burn; Oathbreaker instant Burned splash creates no invented lingering burn.
16. No false dragon critical, fourth Elven Ranger arrow, seventh Elite Warrior arrow, Elven King siege bomb or active Claire Melancholy.
17. Runtime ranger auras and ground-only Frozen Celestial match separately integrated B03/B04; presentation never creates those mechanics.
18. No MVP ally or armor aura after B01; champion armor auras and strongest-only cues remain.
19. Archdruid +1 and Nature Spirit/Mother Nature +3 recipient range cues match actual effective state and do not sum.
20. All 62 current enemy spawn configurations select VFX from merged fields, including Moon Clan evasion, override removal and all three final-boss variants.
21. Host 31/35/36 Ashen and Spectral variants retain their actual opposite immunities. Host 38 knifer and troll have distinct stealth/disarm versus regen cues.
22. Refraction sector loss/recharge follows actual shields. HP recharge and regeneration show actual unblocked healing, never a false heal at full HP.
23. Dread follows real damage reaction, disarm follows active/protected windows, blink uses actual endpoints, and evasion does not move the actor.
24. Global pause, supported speed modes and reduced motion have deterministic seek/reset; no double speed multiplication.
25. Dense actual campaign scenes at iPad and desktop resolution stay within measured VFX budgets; effects leave target silhouettes, HP bars and route readable.
26. Reset, defeat, victory, scene teardown, cloak transitions and enemy death leave zero pooled ownership leaks or ghost effects; original one-shot death motion remains unchanged.

The current bundle verifies mapping coverage and unchanged reference/source files only. It runs no VFX implementation, browser visual review, device benchmark or campaign balance simulation. The user has approved the VFX design separately from the balance values; visual implementation review and measured performance validation remain future work.

## Handoff files

- [mapping.json](mapping.json): complete machine-readable approved assignments, actual runtime stats, all 62 enemy spawn configurations, requirements and acceptance cases.
- [reference.json](reference.json): preserved approved analysis/specifications, approval receipt, current profiles and source hashes. Historical source copy is retained verbatim, including original language and old role prose.
- [implementation-prompt.txt](implementation-prompt.txt): later implementation prompt: VFX design is approved; execution authorization in Master remains required.
- [preview-prompt.txt](preview-prompt.txt): an isolated visual-review prompt; no live gameplay integration authorized.
- [verification.json](verification.json): this preparation’s coverage and source-preservation evidence.

**Review status: B07 design approved by the user on 18 October 2026. Implementation is deferred to Master verze hry. No animation, material, gallery, game code, production configuration or deployed build has been changed.**
