import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {handle} from '../backend/worker.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sections = ['runs', 'waves', 'defenders', 'draws', 'decisions'];
const durationColumns=['runId','version','mode','outcome','durationSeconds','durationMs'];

export function csvRows(rows,extraColumns=[]) {
  const columns = [...new Set([...rows.flatMap(row => Object.keys(row)),...extraColumns])];
  if (!columns.length) return '\uFEFF';
  const cell = value => {
    let text = value === null || value === undefined ? '' : String(value);
    // Keep owner reports safe to open in spreadsheet applications.
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return '\uFEFF' + [columns.map(cell).join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\r\n') + '\r\n';
}

export async function report({apiUrl = process.env.API_URL, adminToken = process.env.STATISTICS_ADMIN_TOKEN,
  dataDirectory = process.env.STATISTICS_DATA_DIR || path.join(root, 'artifacts', 'statistics'),
  outputDirectory = path.join(root, 'artifacts', 'statistics-reports')} = {}) {
  let response, database;
  try {
    if (apiUrl) {
      const url = new URL(apiUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('API_URL must be an HTTP(S) statistics-service base URL without credentials, query or fragment.');
      }
      if (!adminToken) throw new Error('Set STATISTICS_ADMIN_TOKEN to access a remote owner report.');
      response = await fetch(`${url.href.replace(/\/$/, '')}/api/admin/statistics`, {
        headers: {Authorization: `Bearer ${adminToken}`}, signal: AbortSignal.timeout(30000),
      });
    } else {
      const filename = path.join(path.resolve(dataDirectory), 'bastions.sqlite');
      try {await fs.access(filename);} catch {throw new Error(`Statistics database does not exist: ${filename}. Start backend/server.mjs and collect a run first.`);}
      let localToken = adminToken || process.env.ADMIN_TOKEN;
      if (!localToken) {
        try {localToken = (await fs.readFile(path.join(path.resolve(dataDirectory), 'owner-token.txt'), 'utf8')).trim();}
        catch {throw new Error('The local owner-token.txt is missing. Start backend/server.mjs or supply STATISTICS_ADMIN_TOKEN.');}
      }
      if (!localToken) throw new Error('The local owner token is empty.');
      database = sqliteDatabase(filename);
      response = await handle(new Request('http://localhost/api/admin/statistics', {
        headers: {Authorization: `Bearer ${localToken}`},
      }), {DB: database, ADMIN_TOKEN: localToken});
    }
    if (!response.ok) throw new Error(`Owner statistics request failed with HTTP ${response.status}.`);
    const payload = await response.json();
    if (!payload || sections.some(section => !Array.isArray(payload[section]) || payload[section].some(row => !row || typeof row !== 'object' || Array.isArray(row)))) {
      throw new Error('The statistics service returned an unsupported report format.');
    }
    if (payload.runDurations!==undefined&&(!Array.isArray(payload.runDurations)||payload.runDurations.some(row=>!row||typeof row!=='object'||Array.isArray(row))))throw new Error('The statistics service returned an unsupported duration report format.');
    const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    const destination = path.join(path.resolve(outputDirectory), timestamp);
    await fs.mkdir(destination, {recursive: true});
    await fs.writeFile(path.join(destination, 'statistics.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
    // Older services may not expose the new elapsed clock. Keep explicit empty
    // duration cells rather than deriving them from legacy wall/combat times.
    for (const section of sections) await fs.writeFile(path.join(destination, `${section}.csv`), csvRows(payload[section],section==='runs'?['timedRuns','totalDurationSeconds','averageDurationSeconds']:[]), 'utf8');
    await fs.writeFile(path.join(destination,'run-durations.csv'),csvRows(payload.runDurations||[],durationColumns),'utf8');
    return {destination, counts: {...Object.fromEntries(sections.map(section => [section, payload[section].length])),runDurations:payload.runDurations?.length||0}};
  } finally {database?.sqlite.close();}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.includes('--help')) {
    console.log('Usage: node tools/statistics-report.mjs\nDefault: local artifacts/statistics/bastions.sqlite\nOptional environment: API_URL + STATISTICS_ADMIN_TOKEN, STATISTICS_DATA_DIR\nOutput: artifacts/statistics-reports/<timestamp>/{statistics.json,runs.csv,run-durations.csv,waves.csv,defenders.csv,draws.csv,decisions.csv}');
  } else {
    try {
      const result = await report();
      console.log(`Statistics report saved: ${result.destination}`);
      console.log(Object.entries(result.counts).map(([section, count]) => `${section}: ${count}`).join(', '));
    } catch (error) {
      // Do not include request bodies, authorization headers, or remote response text.
      console.error(`Statistics report failed: ${error.message}`);process.exitCode = 1;
    }
  }
}
