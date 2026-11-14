import {getMigrations} from 'better-auth/db/migration';
import {playerAuth} from '../backend/auth.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import fs from 'node:fs';
const db=sqliteDatabase(),env={DB:db,AUTH_SECRET:'migration-only-secret-not-a-runtime-credential',AUTH_BASE_URL:'http://127.0.0.1:4174',AUTH_MAIL_MODE:'local',AUTH_LOCAL_MAIL:()=>{}};
const migration=await getMigrations(playerAuth(env).options);
fs.writeFileSync(new URL('../backend/migrations/0000_auth_fr010.sql',import.meta.url),await migration.compileMigrations());
db.sqlite.close();
