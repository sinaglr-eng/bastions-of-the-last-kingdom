// Keep game assets on their existing public distribution, and authentication
// first-party on the existing backend Site. Never forward cookies upstream.
const ASSET_BASE='https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/';
export async function hostedGame(request,{fetcher=fetch}={}){
 const url=new URL(request.url);
 if(url.pathname==='/play')return Response.redirect(url.origin+'/play/'+url.search,308);
 if(!url.pathname.startsWith('/play/'))return null;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 let file;try{file=decodeURIComponent(url.pathname.slice(6));}catch{return new Response('Invalid path',{status:400});}
 if(!file)file='index.html';
 if(file.includes('\\')||file.split('/').some(p=>p==='..'||p==='.')||file.startsWith('/')||!(/^(assets\/[A-Za-z0-9_./ -]+)$/.test(file)||['index.html','release.json','runtime-assets.json','favicon.svg','privacy.html','archer.html'].includes(file)))return new Response('Not found',{status:404});
 const upstream=new URL(file,ASSET_BASE);upstream.search=url.search;
 const headers=new Headers();for(const key of ['accept','range','if-none-match'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
 const result=await fetcher(upstream.href,{method:request.method,headers,redirect:'manual',cf:{cacheEverything:true,cacheTtl:file==='index.html'||file.endsWith('.json')?0:3600}});
 if(result.status>=300&&result.status<400&&result.status!==304)return new Response('Asset redirect refused',{status:502});
 const responseHeaders=new Headers(result.headers);for(const key of ['set-cookie','access-control-allow-origin','access-control-allow-credentials'])responseHeaders.delete(key);
 responseHeaders.set('X-Content-Type-Options','nosniff');
 if(['index.html','release.json','privacy.html'].includes(file))responseHeaders.set('Cache-Control','no-store');
 if(file==='index.html'&&result.ok&&request.method==='GET'){
  // Also serves the immediately preceding page during the release transition.
  const html=(await result.text()).replaceAll('/bastions-of-the-last-kingdom/','/play/');responseHeaders.delete('content-length');responseHeaders.delete('content-encoding');return new Response(html,{status:result.status,headers:responseHeaders});
 }
 return new Response(result.body,{status:result.status,headers:responseHeaders});
}
