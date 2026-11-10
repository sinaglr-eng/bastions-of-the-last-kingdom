// Current complete defender voice catalogue. Approved original recording files
// remain exact; the current map adds native faction voices and explicit recasts.
export const CURRENT_DEFENDER_VOICE_REVISION="voice-completion-20261110-v4-02d1a9224942";
export const CURRENT_DEFENDER_VOICE_CATALOGUE=`assets/audio/voice-completion-current/catalogue.json?v=${CURRENT_DEFENDER_VOICE_REVISION}`;
export const CURRENT_DEFENDER_VOICE_CHARACTER_COUNT=136;
export const CURRENT_DEFENDER_VOICE_CLIP_COUNT=CURRENT_DEFENDER_VOICE_CHARACTER_COUNT*2;
export const CURRENT_VOICE_REVIEW=Object.freeze({revision:CURRENT_DEFENDER_VOICE_REVISION,expected:CURRENT_DEFENDER_VOICE_CLIP_COUNT});
