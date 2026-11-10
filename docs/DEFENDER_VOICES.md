# Defender voices — 0.6.12

The current game has **136 character families and 272 selection recordings**, two lines per character. This completes the 90 previously unvoiced native Dwarf and Elf characters and corrects five Human gender assignments: **190 new recordings**, alongside 82 retained recordings. All 92 original approved recordings and their exact source receipts remain preserved.

New recordings use ElevenLabs v4 (`eleven_v4`). Native Dwarf scripts include `[strong scottish accent]`; native Elf scripts include `[strong british accent]`. Every new line also has performance tags. Explicit male/female character annotations match their casting; unspecified and nonbiological identities retain their original character metadata separately from the actor choice.

Each faction has 46 distinct voice IDs. Basic ranks I–VI share their character's pair; separate champion identities have separate casting. Lady Claire retains one shared identity and approved pair across factions.

Committing a defender plays one of its two lines through the existing selection-audio system. The recordings obey mute and volume controls, duck music, cancel stale selections and retain their normal playback speed at every game speed. A native faction character never borrows an unrelated Human fallback.

The active [runtime catalogue](../public/assets/audio/voice-completion-current/catalogue.json) and [casting manifest](../public/assets/audio/voice-completion-current/manifest.json) contain the exact assignments and scripts. [Current voice constants](../game/audio/current-voice-assets.js) define the cache revision and 272-clip review contract. The older October constants describe preserved original evidence separately.

Automated checks cover all 272 real MP3s, unique casting, script tags, source preservation and browser playback through actual Keep actions. New human listening approval remains separate from generation, implementation and publication. Accent strength and naturalness are not certified by those automated checks; Rune Master's Richard voice is explicitly recorded as a British-base voice directed with Scottish tags.

The single design gallery remains local only. Each character profile contains two user-initiated audio players, casting metadata and recorded script directions.
