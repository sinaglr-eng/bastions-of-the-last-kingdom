import {writeFileSync} from 'node:fs';
import {CONTACT_NAMES,CONTACT_SLICE_SECONDS} from '../game/audio/contact-cues.js';

// Mono foley layers. A resonating body, two inharmonic modes and a
// band-limited friction transient give each material a distinct envelope.
// Values: length (ms), fundamental (Hz), second mode ratio, downward bend,
// friction centre (Hz), friction level, relative time of the second tap.
const voices={
  pierce:[100,270,3.2,.46,2900,.6,0], arrow:[125,196,1.65,.26,1240,.62,.20],
  cleave:[118,310,3.97,.23,3720,.53,0], anvil:[210,216,2.77,.12,1900,.25,.09],
  pick:[136,530,2.43,.08,3440,.40,.16], rock:[175,126,1.52,.36,970,.88,.37],
  oak:[195,105,1.92,.18,780,.48,.18], drum:[245,118,1.58,.37,485,.19,0],
  powder:[310,91,1.48,.67,1440,1.35,.18], talon:[78,460,3.11,.62,2610,.76,.23],
  silk:[145,590,1.51,.73,1950,.28,.27], rune:[185,518,1.51,-.20,970,.07,0],
  moon:[191,747,1.99,.32,3350,.12,.20], holy:[295,820,1.499,.015,1800,.035,.12],
  storm:[99,392,3.65,.80,4330,.94,.21], seed:[164,278,1.58,.37,1090,.59,.30],
  ember:[183,120,2.13,.39,1760,1.2,.30], frost:[143,1240,1.46,.12,4100,.21,.27],
  block:[155,397,2.75,.04,2810,.24,.09], dodge:[138,650,1.29,.51,2390,1.8,0],
  ward:[193,408,1.414,-.49,920,.09,.15], breach:[160,670,2.38,.60,1810,.26,.38],
  critical:[98,557,2.15,.17,3290,.49,.43], execute:[256,148,2.56,.62,1600,.50,.16],
  spark:[72,1460,2.35,.58,4170,.66,.34], rebound:[110,852,2.59,-.44,2250,.21,.20],
  shatter:[192,1130,1.72,.18,3820,.47,.40], root:[161,179,2.18,.41,1020,.68,.25],
  venom:[191,407,1.31,.60,3140,1.1,.3], stagger:[110,474,1.54,.12,1420,.24,.40],
  shred:[148,647,3.19,.69,2800,.82,.31], wither:[175,336,1.46,.44,1040,.32,.27],
  charge:[197,282,1.99,-.69,1800,.12,0], hoof:[160,123,2.34,.42,616,.65,.54],
  wing:[173,142,1.22,.24,987,1.75,.47], steam:[227,346,1.27,.23,3330,2.1,0],
  valve:[120,239,2.56,.35,1990,.54,.41], banshee:[240,648,1.04,.34,1260,.11,.14],
};
const sampleRate=24000,frames=Math.round(sampleRate*CONTACT_SLICE_SECONDS);
const wav=Buffer.alloc(44+CONTACT_NAMES.length*frames*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);
wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
for(const [index,name] of CONTACT_NAMES.entries()){
  const [ms,hz,ratio,bend,center,friction,second]=voices[name],length=Math.round(sampleRate*ms/1000);
  const samples=new Float32Array(length);
  let seed=419+index,low=0,band=0,phase=0,peak=.01;
  const coefficient=2*Math.sin(Math.PI*center/sampleRate);
  for(let i=0;i<length;i++){
    const t=i/sampleRate,u=i/length;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    low+=coefficient*band;band+=coefficient*((seed/2147483648-1)-low-.84*band);
    phase+=2*Math.PI*hz*(1-bend*u)/sampleRate;
    const attack=Math.min(1,t/.0025);
    const tap=second&&u>=second?.45*Math.exp(-(u-second)*20):0;
    const ring=Math.sin(phase)*Math.exp(-5*u)+.46*Math.sin(phase*ratio)*Math.exp(-7*u)+.17*Math.sin(phase*(ratio+.83))*Math.exp(-14*u);
    const sample=attack*(ring*(.64+tap)+friction*band*(Math.exp(-12*u)+tap))*Math.min(1,(1-u)*16);
    samples[i]=sample;peak=Math.max(peak,Math.abs(sample));
  }
  for(let i=0;i<length;i++)wav.writeInt16LE(Math.round(22500*samples[i]/peak),44+2*(index*frames+i));
}
writeFileSync(new URL('../public/assets/audio/combat-effects-current/contact-atlas-1.wav',import.meta.url),wav);
