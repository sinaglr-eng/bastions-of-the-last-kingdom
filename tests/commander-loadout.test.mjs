import test from 'node:test';
import assert from 'node:assert/strict';
import {MainMenu} from '../ui/main-menu.js';
import {generalView} from '../ui/war-table-view.js';
import {rankOverviewMarkup} from '../ui/account-progression.js';
import {commanderSkillArt} from '../ui/commander-art.js';
import {GENERAL_SKILLS} from '../game/core/general.js';

test('catalog, detail and top slots share a draft independent of visible cards', async () => {
 const equipped=['deep-refit','war-horn','decisive-strike'];
 const skills=Object.fromEntries([...equipped,'quartermaster'].map(id=>[id,1]));
 const checkbox={checked:true,focus(){}};
 const menu=Object.assign(Object.create(MainMenu.prototype),{
  player:{user:{},online:true,profile:{skills,equipped}},
  root:{querySelector:()=>checkbox},show:async()=>{},status(){},
 });
 await menu.setSkillEquipped('quartermaster',true,'[data-add-skill]');
 assert.equal(checkbox.checked,false);
 assert.deepEqual(menu.selectedLoadout,equipped);
 await menu.setSkillEquipped('war-horn',false,'[data-add-skill]');
 await menu.setSkillEquipped('quartermaster',true,'[data-remove-skill]');
 assert.deepEqual(menu.selectedLoadout,['deep-refit','decisive-strike','quartermaster']);
 await menu.setSkillEquipped('quartermaster',true,'[data-remove-skill]');
 await menu.setSkillEquipped('extended-range',true,'[data-remove-skill]');
 assert.deepEqual(menu.selectedLoadout,['deep-refit','decisive-strike','quartermaster']);
 assert.deepEqual(menu.player.profile.equipped,['deep-refit','war-horn','decisive-strike']);
});

test('open slots offer exactly the owned unequipped skills even when catalog filters hide them', () => {
 const equipped=['war-horn','extended-range'];
 const profile={xpTotal:1000,balance:0,skills:{'war-horn':2,'extended-range':1,quartermaster:3},equipped};
 const html=generalView(profile,true,{filter:'available'});
 assert.ok(html.indexOf('class="war-skill-detail"')<html.indexOf('class="war-skill-catalog"'));
 assert.match(html,/No skills match this filter/);
 const options=html.match(/<select data-add-skill[^>]*>([\s\S]*?)<\/select>/)[1];
 assert.deepEqual([...options.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]),['quartermaster']);
 assert.equal((html.match(/data-remove-skill="/g)||[]).length,2);
 assert.match(generalView(profile,false),/<select data-add-skill[^>]+disabled>/);
 assert.match(generalView(profile,false),/data-remove-skill="war-horn"[^>]+disabled>/);
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
