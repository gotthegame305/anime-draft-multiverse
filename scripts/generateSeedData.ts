import fs from 'fs';
import csvParser from 'csv-parser';
import path from 'path';

const inputFilePath = path.join(__dirname, 'anime_battle_roster_All.csv');
const outputFilePath = path.join(__dirname, 'static-characters.json');

const characters = [];

fs.createReadStream(inputFilePath)
  .pipe(csvParser())
  .on('data', (row) => {
    characters.push(row);
  })
  .on('end', () => {
    fs.writeFileSync(outputFilePath, JSON.stringify(characters, null, 2));
    console.log('CSV file successfully processed and converted to JSON.');
  });

