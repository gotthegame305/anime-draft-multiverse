import pandas as pd
import json
import os

excel_path = r'C:\Users\carlm\Downloads\pre gen ai anime stats guessing game.xlsx'
output_path = r'c:\Users\carlm\ALL Projects made with Antigravity\anime guess game\scripts\static-characters.json'

mapping = {
    'Name': 'name',
    'Series': 'series',
    'Favorites': 'favorites',
    'Win Rate %': 'winRate',
    'Captain': 'captain',
    'Vice Captain': 'viceCaptain',
    'Tank': 'tank',
    'Duelist': 'duelist',
    'Support': 'support',
    'Aura': 'aura',
    'Traitor': 'traitor'
}

try:
    df = pd.read_excel(excel_path)
    
    # Rename columns based on mapping
    df = df.rename(columns=mapping)
    
    # Only keep the columns we mapped
    available_cols = [col for col in mapping.values() if col in df.columns]
    df = df[available_cols]
    
    # Handle NaN values (fill with 0 or empty string)
    df = df.fillna({
        'name': 'Unknown',
        'series': 'Unknown',
        'favorites': 0,
        'winRate': 0.5,
        'captain': 1,
        'viceCaptain': 1,
        'tank': 1,
        'duelist': 1,
        'support': 1,
        'aura': 1,
        'traitor': 1
    })
    
    # Convert winRate if it's a percentage (e.g., 43 -> 0.43)
    if 'winRate' in df.columns:
        df['winRate'] = df['winRate'].apply(lambda x: x / 100.0 if x > 1 else x)

    # Convert to list of dicts
    data = df.to_dict(orient='records')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully converted Excel to {output_path}")
    print(f"Total characters: {len(data)}")
    if len(data) > 0:
        print("First sample character:")
        print(json.dumps(data[0], indent=2))

except Exception as e:
    print(f"Error during conversion: {e}")
