"""
Build token relationship tables from prompts.
This script creates the tokens table and junction tables linking tokens to prompts.

Usage:
    python build_token_relationships.py          # Full rebuild (drops and recreates tables)
    python build_token_relationships.py --update # Incremental update (only new prompts)
"""

import re
import mysql.connector
from collections import defaultdict
import argparse
import hashlib

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

def get_or_create_token( cursor, token_text, token_cache ):
    """Get or create a token, return its ID."""
    # Use hash for lookup (since token is TEXT)
    token_hash = hashlib.sha256( token_text.encode( 'utf-8' ) ).hexdigest()
    
    if token_hash in token_cache:
        return token_cache[token_hash]
    
    # Try to find existing token
    cursor.execute( "SELECT id FROM tokens WHERE hash = %s", (token_hash,) )
    result = cursor.fetchone()
    
    if result:
        token_id = result[0]
    else:
        # Insert new token
        try:
            cursor.execute(
                "INSERT INTO tokens (token, hash) VALUES (%s, %s)",
                (token_text, token_hash)
            )
            token_id = cursor.lastrowid
        except mysql.connector.IntegrityError:
            # Handle race condition - token was inserted by another process
            cursor.execute( "SELECT id FROM tokens WHERE hash = %s", (token_hash,) )
            token_id = cursor.fetchone()[0]
    
    token_cache[token_hash] = token_id
    return token_id

def full_rebuild( cursor, db ):
    """Completely rebuild the token relationship tables from scratch."""
    print( "=== FULL REBUILD MODE ===" )
    
    # Read and execute the schema file
    print( "Recreating tables..." )
    with open( 'create_token_tables.sql', 'r', encoding='utf-8' ) as f:
        sql_script = f.read()
    
    # Split by semicolons and execute each statement
    statements = [s.strip() for s in sql_script.split( ';' ) if s.strip()]
    for statement in statements:
        cursor.execute( statement )
    db.commit()
    
    print( "Tables recreated successfully" )
    
    # Get all prompts
    print( "Loading prompts..." )
    cursor.execute( """
        SELECT id, prompt_text
        FROM positive_prompts
    """ )
    positive_prompts = cursor.fetchall()
    
    cursor.execute( """
        SELECT id, prompt_text
        FROM negative_prompts
    """ )
    negative_prompts = cursor.fetchall()
    
    print( f"Loaded {len( positive_prompts )} positive prompts and {len( negative_prompts )} negative prompts" )
    
    # Process prompts and build relationships
    print( "Extracting tokens and building relationships..." )
    token_cache = {}
    
    # Process positive prompts
    positive_relationships = []
    for prompt_id, prompt_text in positive_prompts:
        tokens = extract_tokens( prompt_text )
        for token_text in tokens:
            token_id = get_or_create_token( cursor, token_text, token_cache )
            positive_relationships.append( (prompt_id, token_id) )
    
    # Process negative prompts
    negative_relationships = []
    for prompt_id, prompt_text in negative_prompts:
        tokens = extract_tokens( prompt_text )
        for token_text in tokens:
            token_id = get_or_create_token( cursor, token_text, token_cache )
            negative_relationships.append( (prompt_id, token_id) )
    
    print( f"Created {len( token_cache )} unique tokens" )
    print( f"Building {len( positive_relationships )} positive prompt-token relationships..." )
    
    # Bulk insert positive relationships
    if positive_relationships:
        cursor.executemany(
            "INSERT IGNORE INTO positive_prompt_tokens (positive_prompt_id, token_id) VALUES (%s, %s)",
            positive_relationships
        )
    
    print( f"Building {len( negative_relationships )} negative prompt-token relationships..." )
    
    # Bulk insert negative relationships
    if negative_relationships:
        cursor.executemany(
            "INSERT IGNORE INTO negative_prompt_tokens (negative_prompt_id, token_id) VALUES (%s, %s)",
            negative_relationships
        )
    
    db.commit()
    
    print( "\n=== REBUILD COMPLETE ===" )
    print( f"  Total unique tokens: {len( token_cache )}" )
    print( f"  Positive prompt relationships: {len( positive_relationships )}" )
    print( f"  Negative prompt relationships: {len( negative_relationships )}" )

def incremental_update( cursor, db ):
    """Update token relationships for prompts that don't have tokens yet."""
    print( "=== INCREMENTAL UPDATE MODE ===" )
    
    # Find positive prompts without tokens
    print( "Finding prompts without tokens..." )
    cursor.execute( """
        SELECT pp.id, pp.prompt_text
        FROM positive_prompts pp
        LEFT JOIN positive_prompt_tokens ppt ON pp.id = ppt.positive_prompt_id
        WHERE ppt.positive_prompt_id IS NULL
    """ )
    new_positive_prompts = cursor.fetchall()
    
    cursor.execute( """
        SELECT np.id, np.prompt_text
        FROM negative_prompts np
        LEFT JOIN negative_prompt_tokens npt ON np.id = npt.negative_prompt_id
        WHERE npt.negative_prompt_id IS NULL
    """ )
    new_negative_prompts = cursor.fetchall()
    
    print( f"Found {len( new_positive_prompts )} new positive prompts and {len( new_negative_prompts )} new negative prompts" )
    
    if len( new_positive_prompts ) == 0 and len( new_negative_prompts ) == 0:
        print( "No new prompts to process" )
        return
    
    # Process new prompts
    print( "Extracting tokens and building relationships..." )
    token_cache = {}
    
    # Process positive prompts
    positive_relationships = []
    for prompt_id, prompt_text in new_positive_prompts:
        tokens = extract_tokens( prompt_text )
        for token_text in tokens:
            token_id = get_or_create_token( cursor, token_text, token_cache )
            positive_relationships.append( (prompt_id, token_id) )
    
    # Process negative prompts
    negative_relationships = []
    for prompt_id, prompt_text in new_negative_prompts:
        tokens = extract_tokens( prompt_text )
        for token_text in tokens:
            token_id = get_or_create_token( cursor, token_text, token_cache )
            negative_relationships.append( (prompt_id, token_id) )
    
    # Insert relationships
    if positive_relationships:
        print( f"Inserting {len( positive_relationships )} positive relationships..." )
        cursor.executemany(
            "INSERT IGNORE INTO positive_prompt_tokens (positive_prompt_id, token_id) VALUES (%s, %s)",
            positive_relationships
        )
    
    if negative_relationships:
        print( f"Inserting {len( negative_relationships )} negative relationships..." )
        cursor.executemany(
            "INSERT IGNORE INTO negative_prompt_tokens (negative_prompt_id, token_id) VALUES (%s, %s)",
            negative_relationships
        )
    
    db.commit()
    
    print( "\n=== UPDATE COMPLETE ===" )
    print( f"  New tokens created: {len( token_cache )}" )
    print( f"  New positive relationships: {len( positive_relationships )}" )
    print( f"  New negative relationships: {len( negative_relationships )}" )

def main():
    parser = argparse.ArgumentParser( description='Build token relationship tables from prompts' )
    parser.add_argument( '--update', action='store_true',
                        help='Incremental update (only new prompts) instead of full rebuild' )
    args = parser.parse_args()
    
    print( "Connecting to database..." )
    db = get_db_connection()
    cursor = db.cursor()
    
    try:
        if args.update:
            incremental_update( cursor, db )
        else:
            full_rebuild( cursor, db )
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    main()
