import fs from 'node:fs';
export function migrateFr010(db){
 db.sqlite.exec('CREATE TABLE IF NOT EXISTS game_schema_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)');
 for(const name of ['0000_auth_fr010.sql','0001_fr010.sql','0002_manual_achievements.sql'])if(!db.sqlite.prepare('SELECT name FROM game_schema_migrations WHERE name=?').get(name)){
  db.sqlite.exec('BEGIN IMMEDIATE');try{db.sqlite.exec(fs.readFileSync(new URL('./migrations/'+name,import.meta.url),'utf8'));db.sqlite.prepare('INSERT INTO game_schema_migrations (name,applied_at) VALUES (?,?)').run(name,Date.now());db.sqlite.exec('COMMIT');}catch(error){db.sqlite.exec('ROLLBACK');throw error;}
 }
}
