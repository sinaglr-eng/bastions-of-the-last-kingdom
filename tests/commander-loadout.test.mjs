import test from 'node:test';
import assert from 'node:assert/strict';
import {MainMenu} from '../ui/main-menu.js';
import {generalView,skillPickerMarkup} from '../ui/commander-skills.js';
import {rankOverviewMarkup} from '../ui/account-progression.js';
import {commanderSkillArt} from '../ui/commander-art.js';
import {GENERAL_SKILLS} from '../game/core/general.js';

test('a full loadout replaces exactly one owned skill and only commits on Save Loadout', async () => {
 const equipped=['deep-refit','war-horn','decisive-strike'];
 const skills=Object.fromEntries([...equipped,'quartermaster'].map(id=>[id,1]));
 const calls=[], button={dataset:{},setAttribute(){},removeAttribute(){}};
 const menu=Object.assign(Object.create(MainMenu.prototype),{
  player:{user:{},online:true,profile:{skills,equipped},async changeProfile(action,body){
   calls.push([action,body]);this.profile.equipped=body.equipped;
  }},
  root:{querySelector:()=>null},show:async()=>{},status(){},
 });
 await menu.updateSkillSlot(3,'quartermaster');
 await menu.updateSkillSlot(1,'extended-range');
 await menu.updateSkillSlot(1,'deep-refit');
 assert.deepEqual(menu.selectedLoadout,equipped);
 await menu.updateSkillSlot(1,'quartermaster');
 assert.deepEqual(menu.selectedLoadout,['deep-refit','quartermaster','decisive-strike']);
 assert.deepEqual(menu.player.profile.equipped,equipped);
 assert.equal(calls.length,0);
 await menu.writeSkills('equip',button);
 assert.deepEqual(calls,[['equip',{equipped:['deep-refit','quartermaster','decisive-strike']}]]);
 assert.equal(menu.equipmentDraft,null);
});

test('slot picker offers only owned and unequipped skills independently of filters', () => {
 const equipped=['war-horn','extended-range'];
 const profile={xpTotal:1000,balance:0,skills:{'war-horn':2,'extended-range':1,quartermaster:3},equipped};
 const html=generalView(profile,true,{filter:'available'});
 assert.ok(html.indexOf('class="skills-library')<html.indexOf('class="skills-detail'));
 assert.match(html,/No skills match this filter/);
 const picker=skillPickerMarkup(equipped,profile.skills,{slot:2});
 assert.deepEqual([...picker.matchAll(/data-picker-skill="([^"]+)"/g)].map(m=>m[1]),['quartermaster']);
 assert.equal((html.match(/data-skill-slot="/g)||[]).length,3);
 assert.match(generalView(profile,false),/data-skill-slot="0"[^>]*disabled/);
 const replacement=skillPickerMarkup(equipped,profile.skills,{skill:'quartermaster'});
 assert.match(replacement,/data-picker-slot="0" data-picker-skill="quartermaster"/);
 assert.match(replacement,/Replace War Horn/);
});

test('a purchase keeps the pending loadout, ignores a second tap and allows retry after failure',async()=>{
 const calls=[], root={querySelector:()=>null}, equipped=['deep-refit'];
 const button={dataset:{buy:'quartermaster'},isConnected:true,setAttribute(){},removeAttribute(){}};
 let release;
 const menu=Object.assign(Object.create(MainMenu.prototype),{
  equipmentDraft:['deep-refit','war-horn'],root,show:async()=>{},status(){},
  player:{user:{},online:true,profile:{equipped,skills:{'deep-refit':1,'war-horn':1}},
   async changeProfile(action,body){calls.push([action,body]);await new Promise(resolve=>{release=resolve});throw Error('Connection lost');}
  }
 });
 const pending=menu.writeSkills('purchase',button);
 await menu.writeSkills('purchase',button);
 assert.deepEqual(calls,[['purchase',{skill:'quartermaster'}]]);
 release();
 await pending;
 assert.equal(button.disabled,false);
 menu.player.changeProfile=async function(action,body){calls.push([action,body]);this.profile.skills.quartermaster=1;};
 await menu.writeSkills('purchase',button);
 assert.equal(menu.player.profile.skills.quartermaster,1);
 assert.deepEqual(menu.player.profile.equipped,equipped);
 assert.deepEqual(menu.selectedLoadout,['deep-refit','war-horn']);
});

test('all permanent ranks display their matching skill thumbnail and chest count shares achievement badge styling', () => {
 const ranks=rankOverviewMarkup({xpTotal:200});
 for(const id of Object.keys(GENERAL_SKILLS)){
  assert.equal(ranks.split('src="'+commanderSkillArt(id)+'"').length-1,3);
 }
 const shell=MainMenu.prototype.shell.call({page:'home',player:{profile:{artifacts:{counts:[{status:'ready',count:2},{status:'opened',count:4}]}},readyAchievements:[]}},'','');
 assert.match(shell,/class="war-count" data-chest-count aria-label="2 ready chests"[^>]*>2</);
 assert.match(shell,/class="war-count" data-ready-count[^>]* hidden/);
});
