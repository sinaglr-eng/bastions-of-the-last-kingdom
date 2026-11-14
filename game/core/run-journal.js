export const FIXED_STEP=1/60;
export const RECORDED_COMMANDS=Object.freeze(['select','setTowerAttackPaused','selectEnemy','beginMove','cancelMove','selectMove','place','keep','downgrade','merge','craft','remove','reroll','reserve','startCombat','finishRecruitment','activateGeneral','setPriority','setPinned']);
export function installJournal(game){
 Object.defineProperty(game,'journal',{value:[],writable:true,enumerable:false});
 Object.defineProperty(game,'journalDepth',{value:0,writable:true,enumerable:false});
 for(const name of RECORDED_COMMANDS){const original=game[name];Object.defineProperty(game,name,{enumerable:false,configurable:true,value:function(...args){const root=this.journalDepth++===0;try{return original.apply(this,args);}finally{this.journalDepth--;if(root&&this.recordCommands!==false&&!this.developerMode)this.journal.push({action:name,args:structuredClone(args)});}}});}
}
export function recordAdvance(game,ticks){if(!ticks||game.recordCommands===false||game.developerMode)return;const last=game.journal.at(-1);if(last?.action==='advance')last.ticks+=ticks;else game.journal.push({action:'advance',ticks});}
export function replayCommands(game,commands,{maxTicks=600,maxCommands=400}={}){
 if(!Array.isArray(commands)||commands.length>maxCommands)throw Error('Invalid command batch.');let ticks=0;game.recordCommands=false;
 try{for(const command of commands){if(!command||typeof command!=='object')throw Error('Invalid command.');if(command.action==='advance'){if(!Number.isInteger(command.ticks)||command.ticks<1||(ticks+=command.ticks)>maxTicks)throw Error('Invalid tick budget.');if(game.advanceTicks(command.ticks)!==command.ticks)throw Error('Invalid combat advance.');}else{if(!RECORDED_COMMANDS.includes(command.action)||!Array.isArray(command.args)||command.args.length>3||command.args.some(x=>typeof x==='object'&&x!==null))throw Error('Invalid player command.');game[command.action](...command.args);}}}finally{game.recordCommands=true;}
 return game;
}
