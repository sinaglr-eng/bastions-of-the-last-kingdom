import {DatabaseSync} from 'node:sqlite';

export function sqliteDatabase(path=':memory:'){
  const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const wrap=(query,args=[])=>({bind(...values){return wrap(query,values);},async first(){return sqlite.prepare(query).get(...args)||null;},async all(){return {results:sqlite.prepare(query).all(...args)};},async run(){return sqlite.prepare(query).run(...args);},execute(){return sqlite.prepare(query).run(...args);}});
  return {sqlite,prepare:query=>wrap(query),async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}
