"""
Extract tokens from prompts and negative prompts, storing results in the database.
This should be run periodically to keep the tokens table up-to-date with current data.

Usage:
    python extract_tokens.py          # Full rebuild (clears and rebuilds entire table)
    python extract_tokens.py --update # Incremental update (updates counts, adds new tokens)
"""

import re
import mysql.connector
from collections import defaultdict
from pathlib import Path
import sys
import argparse

# Add parent directory to path for imports
sys.path.insert( 0, str( Path( __file__ ).parent ) )

def get_db_connection():
    """Create database connection."""
    return mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='perchance_gallery'
    )

def extract_tokens( text ):
    """Extract tokens from text using delimiters: comma, period, line breaks."""
    if not text:
        return []
    
    # Split by comma, period, or common line break indicators
    delimiters = r'[,.\n]|\\n'
    tokens = re.split( delimiters, text )
    
    # Clean up tokens: strip whitespace, filter empty strings, lowercase for consistency
    tokens = [token.strip().lower() for token in tokens if token.strip()]
    
    return tokens

def get_image_data( cursor, image_ids=None ):
    """Retrieve images with their prompts from the database.
    
    Args:
        cursor: Database cursor
        image_ids: Optional list of specific image IDs to retrieve. If None, gets all non-deleted images.
    """
    if image_ids:
        placeholders = ','.join(['%s'] * len(image_ids))
        query = f"""
            SELECT 
                i.id,
                pp.prompt_text AS prompt,
                np.prompt_text AS negative_prompt,
                i.art_style_id,
                ast.style_string
            FROM images i
            LEFT JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
            LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
            LEFT JOIN negative_prompts np ON pc.negative_prompt_id = np.id
            LEFT JOIN art_styles ast ON i.art_style_id = ast.id
            WHERE i.deleted = 0 AND i.id IN ({placeholders})
        """
        cursor.execute( query, image_ids )
    else:
        cursor.execute( """
            SELECT 
                i.id,
                pp.prompt_text AS prompt,
                np.prompt_text AS negative_prompt,
                i.art_style_id,
                ast.style_string
            FROM images i
            LEFT JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
            LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
            LEFT JOIN negative_prompts np ON pc.negative_prompt_id = np.id
            LEFT JOIN art_styles ast ON i.art_style_id = ast.id
            WHERE i.deleted = 0
        """ )
    return cursor.fetchall()

def extract_all_tokens( images ):
    """Extract and count all tokens from images."""
    prompt_tokens = defaultdict( int )
    negative_prompt_tokens = defaultdict( int )
    
    for item in images:
        prompt = item.get( 'prompt' ) or ''
        negative_prompt = item.get( 'negative_prompt' ) or ''
        style_string = item.get( 'style_string' ) or ''
        
        # Remove style string from prompt if it exists
        if style_string:
            prompt = prompt.replace( style_string, '' )
        
        # Extract and count tokens from prompt
        for token in extract_tokens( prompt ):
            prompt_tokens[token] += 1
        
        # Extract and count tokens from negative_prompt
        for token in extract_tokens( negative_prompt ):
            negative_prompt_tokens[token] += 1
    
    return prompt_tokens, negative_prompt_tokens

def full_rebuild( cursor, db ):
    """Completely rebuild the tokens table from scratch."""
    print( "=== FULL REBUILD MODE ===" )
    print( "Loading images and prompts..." )
    
    images = get_image_data( cursor )
    print( f"Loaded {len( images )} images" )
    
    print( "Extracting tokens..." )
    prompt_tokens, negative_prompt_tokens = extract_all_tokens( images )
    
    # Sort by frequency (most common first)
    sorted_prompt_tokens = sorted( prompt_tokens.items(), key=lambda x: x[1], reverse=True )
    sorted_negative_tokens = sorted( negative_prompt_tokens.items(), key=lambda x: x[1], reverse=True )
    
    # Clear existing tokens
    print( "Clearing old tokens..." )
    cursor.execute( "SET FOREIGN_KEY_CHECKS = 0" )
    cursor.execute( "TRUNCATE TABLE tokens" )
    cursor.execute( "SET FOREIGN_KEY_CHECKS = 1" )
    db.commit()
    
    # Close and reconnect to ensure we see fresh data
    cursor.close()
    db.close()
    db = get_db_connection()
    cursor = db.cursor( dictionary=True )
    
    # Verify table is empty
    cursor.execute( "SELECT COUNT(*) as cnt FROM tokens" )
    result = cursor.fetchone()
    count = result['cnt']
    print( f"Table now has {count} rows (after reconnect)" )
    
    if count > 0:
        print( "ERROR: Table still has rows after TRUNCATE!" )
        cursor.execute( "SELECT token FROM tokens LIMIT 10" )
        print( "Sample rows:", cursor.fetchall() )
        return None
    
    # Combine all tokens and their counts
    all_tokens = {}
    for token, count in prompt_tokens.items():
        if token not in all_tokens:
            all_tokens[token] = {'positive': 0, 'negative': 0}
        all_tokens[token]['positive'] = count
    
    for token, count in negative_prompt_tokens.items():
        if token not in all_tokens:
            all_tokens[token] = {'positive': 0, 'negative': 0}
        all_tokens[token]['negative'] = count
    
    print( f"Combined into {len( all_tokens )} unique tokens" )
    
    # Debug: Check for 'P' specifically
    if 'P' in all_tokens:
        print( f"Token 'P' found with counts: {all_tokens['P']}" )
    
    # Convert to list to check for duplicates
    token_list = list(all_tokens.keys())
    print( f"Token list length: {len(token_list)}" )
    print( f"Unique tokens in list: {len(set(token_list))}" )
    
    # Count 'P' occurrences
    p_count = token_list.count('P')
    print( f"'P' appears {p_count} times in token list" )
    
    # Insert all tokens
    print( f"Inserting tokens..." )
    inserted = 0
    skipped = 0
    seen = set()
    for token, counts in all_tokens.items():
        if token in seen:
            print( f"WARNING: Token '{token}' already seen! Skipping..." )
            skipped += 1
            continue
        seen.add(token)
        
        try:
            cursor.execute( """
                INSERT INTO tokens (token, positive_prompt_count, negative_prompt_count)
                VALUES (%s, %s, %s)
            """, (token, counts['positive'], counts['negative']) )
            inserted += 1
            if inserted % 10000 == 0:
                print( f"  Inserted {inserted}/{len(all_tokens)}..." )
                db.commit()
        except Exception as e:
            # Skip tokens that cause errors (unicode issues, etc)
            skipped += 1
            if skipped <= 10:  # Only show first 10 errors
                print( f"Skipping problematic token: {repr(token)[:50]} - {e}" )
    
    db.commit()
    print( f"Successfully inserted {inserted} tokens (skipped {skipped} problematic tokens)" )
    
    return {
        'prompt_tokens': len( sorted_prompt_tokens ),
        'negative_tokens': len( sorted_negative_tokens ),
        'prompt_occurrences': sum( prompt_tokens.values() ),
        'negative_occurrences': sum( negative_prompt_tokens.values() ),
        'top_prompt': sorted_prompt_tokens[:10] if sorted_prompt_tokens else [],
        'top_negative': sorted_negative_tokens[:10] if sorted_negative_tokens else []
    }

def incremental_update( cursor, db, image_ids=None ):
    """Update token counts incrementally without clearing the table.
    
    Args:
        cursor: Database cursor (must be dictionary cursor)
        db: Database connection
        image_ids: Optional list of specific image IDs to process. If None, processes all images.
    """
    print( "=== INCREMENTAL UPDATE MODE ===" )
    
    # Get initial counts
    cursor.execute( "SELECT COUNT(*) as count FROM tokens" )
    initial_token_count = cursor.fetchone()['count']
    
    print( "Loading images and prompts..." )
    images = get_image_data( cursor, image_ids )
    print( f"Loaded {len( images )} images" )
    
    if len( images ) == 0:
        print( "No images to process." )
        return
    
    print( "Extracting tokens..." )
    prompt_tokens, negative_prompt_tokens = extract_all_tokens( images )
    
    # Combine all tokens
    all_tokens = {}
    for token, count in prompt_tokens.items():
        if token not in all_tokens:
            all_tokens[token] = {'positive': 0, 'negative': 0}
        all_tokens[token]['positive'] = count
    
    for token, count in negative_prompt_tokens.items():
        if token not in all_tokens:
            all_tokens[token] = {'positive': 0, 'negative': 0}
        all_tokens[token]['negative'] = count
    
    # Update or insert tokens with progress
    print( f"Updating {len( all_tokens )} unique tokens..." )
    total = len( all_tokens )
    for idx, (token, counts) in enumerate( all_tokens.items(), 1 ):
        cursor.execute( """
            INSERT INTO tokens (token, positive_prompt_count, negative_prompt_count)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE 
                positive_prompt_count = positive_prompt_count + %s,
                negative_prompt_count = negative_prompt_count + %s
        """, (token, counts['positive'], counts['negative'], counts['positive'], counts['negative']) )
        
        # Show progress every 10%
        if total > 100 and idx % (total // 10 or 1) == 0:
            print( f"  Progress: {idx}/{total} ({idx*100//total}%)" )
    
    db.commit()
    
    # Get final counts
    cursor.execute( "SELECT COUNT(*) as count FROM tokens" )
    final_token_count = cursor.fetchone()['count']
    new_tokens = final_token_count - initial_token_count
    
    print( f"\nUpdate complete:" )
    print( f"  Tokens before: {initial_token_count}" )
    print( f"  Tokens after: {final_token_count}" )
    print( f"  New tokens added: {new_tokens}" )
    
    # Sort for display
    sorted_prompt_tokens = sorted( prompt_tokens.items(), key=lambda x: x[1], reverse=True )
    sorted_negative_tokens = sorted( negative_prompt_tokens.items(), key=lambda x: x[1], reverse=True )
    
    return {
        'prompt_tokens': len( sorted_prompt_tokens ),
        'negative_tokens': len( sorted_negative_tokens ),
        'prompt_occurrences': sum( prompt_tokens.values() ),
        'negative_occurrences': sum( negative_prompt_tokens.values() ),
        'top_prompt': sorted_prompt_tokens[:10] if sorted_prompt_tokens else [],
        'top_negative': sorted_negative_tokens[:10] if sorted_negative_tokens else []
    }

def print_stats( stats ):
    """Print statistics about the token extraction."""
    print( f"\nResults saved to tokens table" )
    print( f"  Unique prompt tokens: {stats['prompt_tokens']}" )
    print( f"  Unique negative prompt tokens: {stats['negative_tokens']}" )
    print( f"  Total prompt token occurrences: {stats['prompt_occurrences']}" )
    print( f"  Total negative prompt token occurrences: {stats['negative_occurrences']}" )
    
    # Show top 10 most common tokens
    if stats['top_prompt']:
        print( f"\nTop 10 most common prompt tokens:" )
        for token, count in stats['top_prompt']:
            print( f"  {count:6d}x  {token[:80]}" )
    
    if stats['top_negative']:
        print( f"\nTop 10 most common negative prompt tokens:" )
        for token, count in stats['top_negative']:
            print( f"  {count:6d}x  {token[:80]}" )

def main():
    parser = argparse.ArgumentParser( description='Extract tokens from prompts and update database' )
    parser.add_argument( '--update', action='store_true', 
                        help='Incremental update mode (default: full rebuild)' )
    args = parser.parse_args()
    
    print( "Connecting to database..." )
    db = get_db_connection()
    cursor = db.cursor( dictionary=True )
    
    try:
        if args.update:
            stats = incremental_update( cursor, db )
        else:
            stats = full_rebuild( cursor, db )
        
        print_stats( stats )
    
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    main()
