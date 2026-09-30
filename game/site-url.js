// Runtime URLs must keep Vite's deployment directory on GitHub project Pages.
export function siteUrl(path='',base=import.meta.env?.BASE_URL||'/') {
  return `${base.endsWith('/')?base:base+'/'}${path.replace(/^\/+/, '')}`;
}
