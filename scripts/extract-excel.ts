import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = 'C:\\Users\\carlm\\Downloads\\pre gen ai anime stats guessing game.xlsx';
const outPath = path.join(__dirname, 'static-characters.json');

console.log(`Reading Excel file from: ${filePath}`);

const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = xlsx.utils.sheet_to_json(sheet) as any[];

const characters = rows.map(row => {
    const name = row['Name'];
    const series = row['Series'] || 'Unknown';
    const favorites = Number(row['Favorites']) || 0;
    
    let winRate = 0;
    if (typeof row['Win Rate %'] === 'string') {
         winRate = parseFloat(row['Win Rate %'].replace('%', ''));
    } else if (typeof row['Win Rate %'] === 'number') {
         winRate = row['Win Rate %'];
    }
    if (isNaN(winRate)) winRate = 0;

    return {
        name,
        series,
        favorites,
        winRate,
        captain: Number(row['Captain']) || 1,
        viceCaptain: Number(row['Vice Captain']) || 1,
        tank: Number(row['Tank']) || 1,
        duelist: Number(row['Duelist']) || 1,
        support: Number(row['Support']) || 1,
        aura: Number(row['Aura']) || 1,
        traitor: Number(row['Traitor']) || 1
    };
}).filter(c => c.name);

fs.writeFileSync(outPath, JSON.stringify(characters, null, 2));
console.log(`Saved ${characters.length} characters to ${outPath}`);
