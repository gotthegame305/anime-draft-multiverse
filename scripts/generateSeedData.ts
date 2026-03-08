// scripts/generateSeedData.ts
// Converts anime_battle_roster_All.csv → static-characters.json
// Uses 'xlsx' package (already in your dependencies) — no extra installs needed

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const csvPath = path.join(__dirname, 'anime_battle_roster_All.csv');
const jsonPath = path.join(__dirname, 'static-characters.json');

try {
    const workbook = XLSX.readFile(csvPath, { type: 'file' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

    // Log first row so you can verify columns if needed
    if (rows.length > 0) {
        console.log('📋 Detected columns:', Object.keys(rows[0]));
    }

    const characters = rows.map((row) => ({
        name:        String(row['Name']         || '').trim(),
        series:      String(row['Series']       || '').trim(),
        favorites:   Number(row['Favorites']    || 0),
        winRate:     Number(row['Win Rate %']   || 0.5),
        captain:     Number(row['Captain']      || 3),
        viceCaptain: Number(row['Vice Captain'] || 3),
        tank:        Number(row['Tank']         || 3),
        duelist:     Number(row['Duelist']      || 3),
        support:     Number(row['Support']      || 3),
        aura:        Number(row['Aura']         || 3),
        traitor:     Number(row['Traitor']      || 3),
    })).filter(c => c.name.length > 0);

    fs.writeFileSync(jsonPath, JSON.stringify(characters, null, 2), 'utf8');
    console.log(`✅ Generated ${characters.length} characters → scripts/static-characters.json`);
} catch (err) {
    console.error('❌ Failed to generate seed data:', err);
    process.exit(1);
}
