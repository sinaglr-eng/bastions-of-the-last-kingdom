import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportPKCS8,jwtVerify} from 'jose';
import {authCapabilities,appleClientSecret,socialNickname,socialProviders} from '../backend/social-auth.js';
import {hostedGame} from '../backend/hosted-game.js';
import {PlayerClient} from '../game/player-client.js';
import {MainMenu} from '../ui/main-menu.js';

test('public auth advertises only configured identity providers, never a non-deliverable email signup',()=>{
 assert.deepEqual(authCapabilities({AUTH_BASE_URL:'https://game.example'}),{providers:[],emailPassword:false});
 assert.deepEqual(authCapabilities({AUTH_BASE_URL:'https://game.example',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'}),{providers:['google'],emailPassword:false});
 assert.equal(authCapabilities({AUTH_BASE_URL:'http://127.0.0.1',AUTH_MAIL_MODE:'local'}).emailPassword,true);
 assert.equal(authCapabilities({AUTH_BASE_URL:'https://game.example',AUTH_ENABLE_EMAIL:'true',RESEND_API_KEY:'test',AUTH_EMAIL_FROM:'test@example.test'}).emailPassword,true);
});
test('Apple uses a signed short-lived client secret, and an HTTPS callback',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('ES256',{extractable:true}),env={AUTH_BASE_URL:'https://game.example',APPLE_CLIENT_ID:'game.test.web',APPLE_TEAM_ID:'TESTTEAM',APPLE_KEY_ID:'TESTKEY',APPLE_PRIVATE_KEY:await exportPKCS8(privateKey)},now=Math.floor(Date.now()/1000),token=await appleClientSecret(env,now),verified=await jwtVerify(token,publicKey,{issuer:env.APPLE_TEAM_ID,audience:'https://appleid.apple.com'});
 assert.equal(verified.payload.sub,env.APPLE_CLIENT_ID);assert.equal(verified.payload.exp-verified.payload.iat,86400);assert.equal(verified.protectedHeader.kid,env.APPLE_KEY_ID);assert.deepEqual(authCapabilities(env).providers,['apple']);assert.equal(authCapabilities({...env,AUTH_BASE_URL:'http://localhost'}).providers.length,0);assert.equal((await socialProviders(env).apple()).clientId,env.APPLE_CLIENT_ID);
});
test('provider names become short valid nicknames without publishing an email address',()=>{
 assert.equal(socialNickname({given_name:'Jana',name:'Jana Novakova',email:'private@example.test'}),'Jana');assert.equal(socialNickname({name:'🎮'}),'Commander');assert.equal(socialNickname({}), 'Commander');assert.equal([...socialNickname({name:'x'.repeat(100)})].length,24);
});
test('hosted game proxy keeps API cookies first-party and never sends them to the asset host',async()=>{
 let sent;const r=await hostedGame(new Request('https://game.example/play/?v=7',{headers:{Cookie:'private-session',Authorization:'Bearer private',Range:'bytes=0-99'}}),{fetcher:async(url,options)=>{sent={url,options};return new Response('<script src="/bastions-of-the-last-kingdom/assets/game.js"></script>',{headers:{'Content-Type':'text/html','Set-Cookie':'upstream=wrong'}});}});
 assert.equal(sent.url,'https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/index.html?v=7');assert.equal(sent.options.headers.has('cookie'),false);assert.equal(sent.options.headers.has('authorization'),false);assert.equal(sent.options.headers.get('range'),'bytes=0-99');assert.equal(r.headers.has('set-cookie'),false);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),/src="\/play\/assets\/game.js"/);
});
test('hosted proxy rejects file/host traversal and non-read methods before fetching',async()=>{
 let calls=0;const options={fetcher:async()=>{calls++;return new Response('unexpected');}};
 for(const path of ['.env','backend/auth.js','https://evil.example/file','%2F%2Fevil.example','assets/%2e%2e/%2e%2e/.env']){assert.ok(((await hostedGame(new Request('https://game.example/play/'+path),options))?.status??404)>=400,path);}
 assert.equal((await hostedGame(new Request('https://game.example/play/assets/a.png',{method:'POST'}),options)).status,405);assert.equal(calls,0);
});
test('social login client only follows HTTPS redirects to the selected provider',async()=>{
 const client=new PlayerClient({fetcher:async()=>Response.json({url:'https://accounts.google.com/o/oauth2/v2/auth?state=test'})});client.authOptions={providers:['google']};assert.match(await client.beginSocial('google','https://game.example/play/'),/^https:\/\/accounts.google.com\//);await assert.rejects(client.beginSocial('apple','https://game.example/play/'),/not available/);client.fetcher=async()=>Response.json({url:'https://evil.example'});await assert.rejects(client.beginSocial('google','https://game.example/play/'),/Invalid sign-in/);
});
test('public sign-in and registration expose the same existing-account flow without an email form',()=>{
 const menu=Object.create(MainMenu.prototype);menu.player={authOptions:{providers:['google'],emailPassword:false}};const html=menu.socialMarkup('register');assert.match(html,/Continue with Google/);assert.match(html,/profile automatically/);assert.doesNotMatch(html,/<input/);assert.match(html,/data-provider="apple" disabled/);assert.equal(menu.socialMarkup('reset-password'),'');
});
