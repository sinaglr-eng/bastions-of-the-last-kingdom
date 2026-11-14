import {betterAuth} from 'better-auth';
import {D1Dialect} from 'kysely-d1';
import {playerName} from './validation.js';
import {authCapabilities,socialProviders} from './social-auth.js';

const instances=new WeakMap();
export function playerAuth(env){
 const cached=instances.get(env);if(cached&&Date.now()-cached.createdAt<12*60*60*1000)return cached.auth;
 if(!env.AUTH_SECRET||env.AUTH_SECRET.length<32)throw Error('Account authentication is not configured.');
 const local=env.AUTH_MAIL_MODE==='local',baseURL=env.AUTH_BASE_URL;
 if(!baseURL||local&&!['127.0.0.1','localhost','[::1]'].includes(new URL(baseURL).hostname))throw Error('Invalid authentication configuration.');
 const send=async(kind,{user,url})=>{
  if(local){if(!env.AUTH_LOCAL_MAIL)throw Error('Local mailbox is unavailable.');await env.AUTH_LOCAL_MAIL({kind,to:user.email,url,createdAt:Date.now()});return;}
  if(!env.RESEND_API_KEY||!env.AUTH_EMAIL_FROM)throw Error('Email delivery is not configured.');
  const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.AUTH_EMAIL_FROM,to:[user.email],subject:kind==='verify'?'Verify your Forged Alliances account':'Reset your Forged Alliances password',text:`${kind==='verify'?'Verify your email address':'Reset your password'}: ${url}\nIf you did not request this, ignore this email.`})});
  if(!result.ok)throw Error('Email delivery failed.');
 };
 const capabilities=authCapabilities(env),apple=capabilities.providers.includes('apple');
 const auth=betterAuth({
  appName:'Forged Alliances TD',baseURL,secret:env.AUTH_SECRET,basePath:'/api/auth',
  database:env.DB.sqlite||{dialect:new D1Dialect({database:env.DB}),type:'sqlite'},
  trustedOrigins:[...(env.GAME_ORIGINS||baseURL).split(',').map(s=>s.trim()),...(apple?['https://appleid.apple.com']:[])],
  socialProviders:socialProviders(env),
  account:{encryptOAuthTokens:true},
  emailAndPassword:{enabled:capabilities.emailPassword,minPasswordLength:10,maxPasswordLength:128,requireEmailVerification:true,autoSignIn:false,sendResetPassword:async args=>send('reset',args)},
  emailVerification:{sendOnSignUp:capabilities.emailPassword,sendOnSignIn:capabilities.emailPassword,autoSignInAfterVerification:true,sendVerificationEmail:async args=>send('verify',args)},
  session:{expiresIn:60*60*24*14,updateAge:60*60*24},
  rateLimit:{enabled:true,window:60,max:30},
  databaseHooks:{user:{create:{before:async user=>({data:{...user,name:playerName(user.name)}})},update:{before:async user=>user.name?{data:{...user,name:playerName(user.name)}}:undefined}}},
  advanced:{ipAddress:{ipAddressHeaders:['cf-connecting-ip']},useSecureCookies:new URL(baseURL).protocol==='https:',...(apple?{cookies:{state:{attributes:{sameSite:'none',secure:true}},oauth_state:{attributes:{sameSite:'none',secure:true}}}}:{})},
  telemetry:{enabled:false},
 });instances.set(env,{auth,createdAt:Date.now()});return auth;
}
export async function authenticatedPlayer(request,env){const session=await playerAuth(env).api.getSession({headers:request.headers});return session?.user?.emailVerified?session.user:null;}
