import {importPKCS8,SignJWT} from 'jose';

const present=value=>typeof value==='string'&&value.trim().length>0;
export function authCapabilities(env){
 const https=!!env.AUTH_BASE_URL&&new URL(env.AUTH_BASE_URL).protocol==='https:';
 const providers=[];
 if(present(env.GOOGLE_CLIENT_ID)&&present(env.GOOGLE_CLIENT_SECRET))providers.push('google');
 if(https&&['APPLE_CLIENT_ID','APPLE_TEAM_ID','APPLE_KEY_ID','APPLE_PRIVATE_KEY'].every(key=>present(env[key])))providers.push('apple');
 const emailPassword=env.AUTH_MAIL_MODE==='local'||env.AUTH_ENABLE_EMAIL==='true'&&present(env.RESEND_API_KEY)&&present(env.AUTH_EMAIL_FROM);
 return {providers,emailPassword:!!emailPassword};
}
// The public nickname is editable; no inbox, Drive or contacts access is requested.
export function socialNickname(profile){
 const first=String(profile.given_name||profile.name||'Commander').normalize('NFKC').trim().split(/\s+/)[0].replace(/[^\p{L}\p{M}\p{N}._-]/gu,'');
 return [...(first&&/[\p{L}\p{N}]/u.test(first)?first:'Commander')].slice(0,24).join('');
}
export async function appleClientSecret(env,now=Math.floor(Date.now()/1000)){
 const key=await importPKCS8(env.APPLE_PRIVATE_KEY.replace(/\\n/g,'\n'),'ES256');
 return new SignJWT({}).setProtectedHeader({alg:'ES256',kid:env.APPLE_KEY_ID}).setIssuer(env.APPLE_TEAM_ID).setSubject(env.APPLE_CLIENT_ID).setAudience('https://appleid.apple.com').setIssuedAt(now).setExpirationTime(now+86400).sign(key);
}
export function socialProviders(env){
 const capabilities=authCapabilities(env),providers={};
 const mapProfileToUser=profile=>({name:socialNickname(profile),image:null});
 if(capabilities.providers.includes('google'))providers.google={clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,prompt:'select_account',includeGrantedScopes:false,mapProfileToUser};
 if(capabilities.providers.includes('apple'))providers.apple=async()=>({clientId:env.APPLE_CLIENT_ID,clientSecret:await appleClientSecret(env),mapProfileToUser});
 return providers;
}
