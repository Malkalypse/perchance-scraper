#!/usr/bin/env python3
"""
Update table counts cache for the web interface.
Run this after the scraper completes or after deleting images.
"""

import json
import mysql.connector
from pathlib import Path

def get_table_counts():
    """Query database for table counts and return as dictionary."""
    print("Connecting to database...")
    db = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='perchance_gallery'
    )
    cursor = db.cursor(dictionary=True)
    
    counts = {}
    
    # Art Styles count
    print("Counting art styles...", end='', flush=True)
    cursor.execute("SELECT MAX(id) as count FROM art_styles")
    counts['art-styles'] = cursor.fetchone()['count'] or 0
    print(f" {counts['art-styles']:,}")
    
    # Positive Prompts count
    print("Counting positive prompts...", end='', flush=True)
    cursor.execute("SELECT MAX(id) as count FROM positive_prompts")
    counts['positive-prompts'] = cursor.fetchone()['count'] or 0
    print(f" {counts['positive-prompts']:,}")
    
    # Negative Prompts count
    print("Counting negative prompts...", end='', flush=True)
    cursor.execute("SELECT MAX(id) as count FROM negative_prompts")
    counts['negative-prompts'] = cursor.fetchone()['count'] or 0
    print(f" {counts['negative-prompts']:,}")
    
    # Tags count
    print("Counting tags...", end='', flush=True)
    cursor.execute("SELECT MAX(id) as count FROM tags")
    counts['tags'] = cursor.fetchone()['count'] or 0
    print(f" {counts['tags']:,}")
    
    # Tokens count
    print("Counting tokens...", end='', flush=True)
    cursor.execute("SELECT MAX(id) as count FROM tokens")
    counts['tokens'] = cursor.fetchone()['count'] or 0
    print(f" {counts['tokens']:,}")
    
    cursor.close()
    db.close()
    
    return counts

def save_counts_cache(counts):
    """Save counts to JSON cache file."""
    # Get the project root (parent of python directory)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    cache_file = project_root / 'web' / 'api' / 'table_counts.json'
    
    # Ensure directory exists
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Write counts to file
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(counts, f, indent=2)
    
    print(f"\n✓ Cache saved to: {cache_file}")

if __name__ == '__main__':
    try:
        counts = get_table_counts()
        save_counts_cache(counts)
    except Exception as e:
        print(f"Error updating table counts: {e}")
        exit(1)
