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
    db = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='perchance_gallery'
    )
    cursor = db.cursor(dictionary=True)
    
    counts = {}
    
    # Art Styles count
    cursor.execute("""
        SELECT COUNT(DISTINCT ast.id) as count 
        FROM art_styles ast 
        LEFT JOIN images i ON i.art_style_id = ast.id 
        WHERE i.id IS NOT NULL
    """)
    counts['art-styles'] = cursor.fetchone()['count']
    
    # Positive Prompts count
    cursor.execute("""
        SELECT COUNT(DISTINCT pp.id) as count 
        FROM positive_prompts pp 
        LEFT JOIN prompt_combinations pc ON pc.positive_prompt_id = pp.id 
        LEFT JOIN images i ON i.prompt_combination_id = pc.id 
        WHERE i.id IS NOT NULL
    """)
    counts['positive-prompts'] = cursor.fetchone()['count']
    
    # Negative Prompts count
    cursor.execute("""
        SELECT COUNT(DISTINCT np.id) as count 
        FROM negative_prompts np 
        LEFT JOIN prompt_combinations pc ON pc.negative_prompt_id = np.id 
        LEFT JOIN images i ON i.prompt_combination_id = pc.id 
        WHERE i.id IS NOT NULL
    """)
    counts['negative-prompts'] = cursor.fetchone()['count']
    
    # Tags count
    cursor.execute("""
        SELECT COUNT(DISTINCT t.id) as count 
        FROM tags t 
        LEFT JOIN image_tags it ON it.tag_id = t.id 
        WHERE it.image_id IS NOT NULL
    """)
    counts['tags'] = cursor.fetchone()['count']
    
    # Tokens count - only tokens that appear in at least one prompt
    cursor.execute("""
        SELECT COUNT(DISTINCT t.id) as count 
        FROM tokens t 
        LEFT JOIN positive_prompt_tokens ppt ON ppt.token_id = t.id 
        LEFT JOIN negative_prompt_tokens npt ON npt.token_id = t.id 
        WHERE ppt.positive_prompt_id IS NOT NULL OR npt.negative_prompt_id IS NOT NULL
    """)
    counts['tokens'] = cursor.fetchone()['count']
    
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
    
    print(f"Table counts updated successfully:")
    for table, count in counts.items():
        print(f"  {table}: {count:,}")
    print(f"\nCache saved to: {cache_file}")

if __name__ == '__main__':
    try:
        counts = get_table_counts()
        save_counts_cache(counts)
    except Exception as e:
        print(f"Error updating table counts: {e}")
        exit(1)
