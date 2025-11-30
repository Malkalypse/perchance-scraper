import mysql.connector
from mysql.connector import Error
import json
import os
from pathlib import Path
from datetime import datetime
import hashlib

class OptimalNormalizedDatabaseMigration:
    """Migrates JSON data to optimally normalized MySQL database without redundant hash columns or derived tables"""
    
    def __init__( self, host='localhost', user='root', password='', database='perchance_gallery', folder='../data' ):
        self.host = host
        self.user = user
        self.password = password
        self.database = database
        self.folder = folder
        self.conn = None
        self.cursor = None
        
        # Cache for lookups to avoid duplicate inserts and reduce queries
        self.positive_prompt_cache = {}
        self.negative_prompt_cache = {}
        self.prompt_combination_cache = {}
        self.style_cache = {}
        self.title_cache = {}
    
    def connect( self ):
        """Establish database connection and create database if needed"""
        try:
            self.conn = mysql.connector.connect(
                host=self.host,
                user=self.user,
                password=self.password,
                use_pure=True
            )
            self.cursor = self.conn.cursor()
            
            # Increase packet size for large data
            self.cursor.execute( "SET GLOBAL max_allowed_packet=1073741824" )  # 1GB
            
            # Create database if it doesn't exist
            self.cursor.execute( f"CREATE DATABASE IF NOT EXISTS {self.database}" )
            self.cursor.execute( f"USE {self.database}" )
            
            print( f"Connected to MySQL database: {self.database}" )
        except Error as e:
            print( f"Error connecting to MySQL: {e}" )
            raise
    
    def create_normalized_schema( self ):
        """Create optimally normalized relational database schema"""
        print( "Creating optimally normalized schema..." )
        
        # Art styles table
        self.cursor.execute( '''
            CREATE TABLE IF NOT EXISTS art_styles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                style_string TEXT,
                INDEX idx_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''' )
        
        # Positive prompts table
        self.cursor.execute( '''
            CREATE TABLE IF NOT EXISTS positive_prompts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                prompt_hash VARCHAR(64) UNIQUE NOT NULL,
                prompt_text TEXT NOT NULL,
                FULLTEXT INDEX idx_prompt_text (prompt_text)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''' )
        
        # Negative prompts table
        self.cursor.execute( '''
            CREATE TABLE IF NOT EXISTS negative_prompts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                prompt_hash VARCHAR(64) UNIQUE NOT NULL,
                prompt_text TEXT NOT NULL,
                FULLTEXT INDEX idx_prompt_text (prompt_text)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''' )
        
        # Prompt combinations table (NEW - deduplicates positive + negative pairs)
        self.cursor.execute( '''
            CREATE TABLE IF NOT EXISTS prompt_combinations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                positive_prompt_id INT,
                negative_prompt_id INT,
                combination_hash VARCHAR(64) UNIQUE NOT NULL,
                FOREIGN KEY (positive_prompt_id) REFERENCES positive_prompts(id) ON DELETE CASCADE,
                FOREIGN KEY (negative_prompt_id) REFERENCES negative_prompts(id) ON DELETE CASCADE,
                INDEX idx_positive_prompt_id (positive_prompt_id),
                INDEX idx_negative_prompt_id (negative_prompt_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''' )
        
        # Titles table
        self.cursor.execute( '''
            CREATE TABLE IF NOT EXISTS titles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title_hash VARCHAR(64) UNIQUE NOT NULL,
                title_text TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''' )
        
        # Images table - now references prompt_combinations instead of individual prompts
        self.cursor.execute( '''
            CREATE TABLE IF NOT EXISTS images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                prompt_combination_id INT,
                art_style_id INT,
                title_id INT,
                seed VARCHAR(50),
                date_downloaded DATE,
                deleted TINYINT(1) DEFAULT 0,
                tags TEXT,
                FOREIGN KEY (prompt_combination_id) REFERENCES prompt_combinations(id) ON DELETE SET NULL,
                FOREIGN KEY (art_style_id) REFERENCES art_styles(id) ON DELETE SET NULL,
                FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE SET NULL,
                INDEX idx_filename (filename),
                INDEX idx_deleted (deleted),
                INDEX idx_date_downloaded (date_downloaded),
                INDEX idx_prompt_combination_id (prompt_combination_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''' )
        
        # Tokens table
        self.cursor.execute( '''
            CREATE TABLE IF NOT EXISTS tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                token VARCHAR(255) UNIQUE NOT NULL,
                positive_prompt_count INT DEFAULT 0,
                negative_prompt_count INT DEFAULT 0,
                total_count INT GENERATED ALWAYS AS (positive_prompt_count + negative_prompt_count) STORED,
                INDEX idx_token (token),
                INDEX idx_total_count (total_count)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''' )
        
        self.conn.commit()
        print( "Optimally normalized schema created successfully" )
    
    def get_or_create_style( self, style_name, style_string='' ):
        """Get or create an art style, return its ID"""
        if not style_name:
            return None
        
        # Check cache
        if style_name in self.style_cache:
            return self.style_cache[style_name]
        
        # Try to find existing
        self.cursor.execute( 'SELECT id FROM art_styles WHERE name = %s', ( style_name, ) )
        result = self.cursor.fetchone()
        
        if result:
            style_id = result[0]
        else:
            # Create new
            self.cursor.execute(
                'INSERT INTO art_styles (name, style_string) VALUES (%s, %s)',
                ( style_name, style_string )
            )
            style_id = self.cursor.lastrowid
        
        self.style_cache[style_name] = style_id
        return style_id
    
    def get_or_create_title( self, title_text ):
        """Get or create a title, return its ID"""
        if not title_text:
            return None
        
        # Create hash for deduplication
        title_hash = hashlib.sha256( title_text.encode( 'utf-8' ) ).hexdigest()
        
        # Check cache
        if title_hash in self.title_cache:
            return self.title_cache[title_hash]
        
        # Try to find existing
        self.cursor.execute( 'SELECT id FROM titles WHERE title_hash = %s', ( title_hash, ) )
        result = self.cursor.fetchone()
        
        if result:
            title_id = result[0]
        else:
            # Create new
            self.cursor.execute(
                'INSERT INTO titles (title_hash, title_text) VALUES (%s, %s)',
                ( title_hash, title_text )
            )
            title_id = self.cursor.lastrowid
        
        self.title_cache[title_hash] = title_id
        return title_id
    
    def get_or_create_positive_prompt( self, prompt_text ):
        """Get or create a positive prompt, return its ID"""
        if not prompt_text:
            return None
        
        # Create hash for deduplication
        prompt_hash = hashlib.sha256( prompt_text.encode( 'utf-8' ) ).hexdigest()
        
        # Check cache
        if prompt_hash in self.positive_prompt_cache:
            return self.positive_prompt_cache[prompt_hash]
        
        # Try to find existing
        self.cursor.execute( 'SELECT id FROM positive_prompts WHERE prompt_hash = %s', ( prompt_hash, ) )
        result = self.cursor.fetchone()
        
        if result:
            prompt_id = result[0]
        else:
            # Create new
            self.cursor.execute(
                'INSERT INTO positive_prompts (prompt_hash, prompt_text) VALUES (%s, %s)',
                ( prompt_hash, prompt_text )
            )
            prompt_id = self.cursor.lastrowid
        
        self.positive_prompt_cache[prompt_hash] = prompt_id
        return prompt_id
    
    def get_or_create_negative_prompt( self, prompt_text ):
        """Get or create a negative prompt, return its ID"""
        if not prompt_text:
            return None
        
        # Create hash for deduplication
        prompt_hash = hashlib.sha256( prompt_text.encode( 'utf-8' ) ).hexdigest()
        
        # Check cache
        if prompt_hash in self.negative_prompt_cache:
            return self.negative_prompt_cache[prompt_hash]
        
        # Try to find existing
        self.cursor.execute( 'SELECT id FROM negative_prompts WHERE prompt_hash = %s', ( prompt_hash, ) )
        result = self.cursor.fetchone()
        
        if result:
            prompt_id = result[0]
        else:
            # Create new
            self.cursor.execute(
                'INSERT INTO negative_prompts (prompt_hash, prompt_text) VALUES (%s, %s)',
                ( prompt_hash, prompt_text )
            )
            prompt_id = self.cursor.lastrowid
        
        self.negative_prompt_cache[prompt_hash] = prompt_id
        return prompt_id
    
    def get_or_create_prompt_combination( self, positive_prompt_id, negative_prompt_id ):
        """Get or create a prompt combination (positive + negative pair), return its ID"""
        # Create hash for the combination
        combined = f"{positive_prompt_id or 'NULL'}|||{negative_prompt_id or 'NULL'}"
        combination_hash = hashlib.sha256( combined.encode( 'utf-8' ) ).hexdigest()
        
        # Check cache
        if combination_hash in self.prompt_combination_cache:
            return self.prompt_combination_cache[combination_hash]
        
        # Try to find existing
        self.cursor.execute( 'SELECT id FROM prompt_combinations WHERE combination_hash = %s', ( combination_hash, ) )
        result = self.cursor.fetchone()
        
        if result:
            combo_id = result[0]
        else:
            # Create new
            self.cursor.execute(
                'INSERT INTO prompt_combinations (positive_prompt_id, negative_prompt_id, combination_hash) VALUES (%s, %s, %s)',
                ( positive_prompt_id, negative_prompt_id, combination_hash )
            )
            combo_id = self.cursor.lastrowid
        
        self.prompt_combination_cache[combination_hash] = combo_id
        return combo_id
    
    def migrate_results_json( self ):
        """Migrate results.json to normalized tables"""
        json_path = Path( self.folder ) / 'results.json'
        
        if not json_path.exists():
            print( f"  {json_path.name} not found, skipping" )
            return
        
        print( f"\nMigrating {json_path.name}..." )
        
        with open( json_path, 'r', encoding='utf-8' ) as f:
            data = json.load( f )
        
        print( f"  Found {len( data )} items" )
        
        inserted = 0
        skipped = 0
        
        for i, item in enumerate( data ):
            try:
                filename = item.get( 'filename', '' )
                if not filename:
                    skipped += 1
                    continue
                
                prompt_text = item.get( 'prompt', '' )
                negative_prompt = item.get( 'negative_prompt', '' )
                art_style = item.get( 'art_style', '' )
                seed = item.get( 'seed', '' )
                title = item.get( 'title', '' )
                date_downloaded = item.get( 'date_downloaded', '' )
                tags = item.get( 'tags', '' )
                deleted = 1 if not prompt_text else 0
                
                # Get or create foreign key IDs
                positive_prompt_id = self.get_or_create_positive_prompt( prompt_text )
                negative_prompt_id = self.get_or_create_negative_prompt( negative_prompt )
                prompt_combination_id = self.get_or_create_prompt_combination( positive_prompt_id, negative_prompt_id )
                style_id = self.get_or_create_style( art_style )
                title_id = self.get_or_create_title( title )
                
                # Insert image
                self.cursor.execute( '''
                    INSERT IGNORE INTO images 
                    (filename, prompt_combination_id, art_style_id, title_id, seed, date_downloaded, deleted, tags)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ''', ( filename, prompt_combination_id, style_id, title_id, seed, date_downloaded, deleted, tags ) )
                
                if self.cursor.rowcount > 0:
                    inserted += 1
                else:
                    skipped += 1
                
                # Commit every 1000 records
                if ( i + 1 ) % 1000 == 0:
                    self.conn.commit()
                    print( f"    Processed {i + 1} items ({inserted} inserted)..." )
            
            except Error as e:
                print( f"    Error processing item: {e}" )
        
        self.conn.commit()
        
        print( f"  Complete: {inserted} images inserted, {skipped} skipped" )
    
    def migrate_style_prompts_json( self ):
        """Migrate style_prompts.json to art_styles table"""
        json_path = Path( self.folder ) / 'style_prompts.json'
        
        if not json_path.exists():
            print( f"  {json_path.name} not found, skipping" )
            return
        
        print( f"\nMigrating {json_path.name}..." )
        
        with open( json_path, 'r', encoding='utf-8' ) as f:
            data = json.load( f )
        
        print( f"  Found {len( data )} art styles" )
        
        updated = 0
        
        for style_name, style_data in data.items():
            try:
                style_string = style_data.get( 'style_string', '' )
                
                # Update existing or insert new
                self.cursor.execute( '''
                    INSERT INTO art_styles (name, style_string)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE style_string = VALUES(style_string)
                ''', ( style_name, style_string ) )
                
                updated += 1
            
            except Error as e:
                print( f"    Error processing style '{style_name}': {e}" )
        
        self.conn.commit()
        print( f"  Complete: {updated} art styles updated" )
    
    def migrate_tokens_json( self ):
        """Migrate tokens.json to tokens table"""
        json_path = Path( self.folder ) / 'tokens.json'
        
        if not json_path.exists():
            print( f"  {json_path.name} not found, skipping" )
            return
        
        print( f"\nMigrating {json_path.name}..." )
        
        with open( json_path, 'r', encoding='utf-8' ) as f:
            data = json.load( f )
        
        # data structure: {"prompt_tokens": {...}, "negative_prompt_tokens": {...}, "stats": {...}}
        prompt_tokens = data.get( 'prompts', data.get( 'prompt_tokens', {} ) )
        negative_tokens = data.get( 'negative_prompts', data.get( 'negative_prompt_tokens', {} ) )
        
        # Combine all tokens
        all_tokens = {}
        
        for token, count in prompt_tokens.items():
            all_tokens[token] = {'positive': count, 'negative': 0}
        
        for token, count in negative_tokens.items():
            if token in all_tokens:
                all_tokens[token]['negative'] = count
            else:
                all_tokens[token] = {'positive': 0, 'negative': count}
        
        print( f"  Found {len( all_tokens )} unique tokens" )
        
        inserted = 0
        
        for token, counts in all_tokens.items():
            try:
                self.cursor.execute( '''
                    INSERT INTO tokens (token, positive_prompt_count, negative_prompt_count)
                    VALUES (%s, %s, %s)
                ''', ( token, counts['positive'], counts['negative'] ) )
                
                inserted += 1
            
            except Error as e:
                if 'Duplicate entry' not in str( e ):
                    print( f"    Error inserting token '{token}': {e}" )
        
        self.conn.commit()
        print( f"  Complete: {inserted} tokens inserted" )
    
    def verify_migration( self ):
        """Verify the migrated data"""
        print( "\n" + "="*60 )
        print( "MIGRATION SUMMARY" )
        print( "="*60 )
        
        tables = [
            'art_styles',
            'positive_prompts',
            'negative_prompts',
            'prompt_combinations',
            'titles',
            'images',
            'tokens'
        ]
        
        for table in tables:
            self.cursor.execute( f"SELECT COUNT(*) FROM {table}" )
            count = self.cursor.fetchone()[0]
            print( f"  {table}: {count} rows" )
        
        # Show top art styles
        print( "\nTop 10 art styles by usage:" )
        self.cursor.execute( '''
            SELECT a.name, COUNT(*) as usage_count
            FROM art_styles a
            JOIN images i ON a.id = i.art_style_id
            GROUP BY a.id, a.name
            ORDER BY usage_count DESC 
            LIMIT 10
        ''' )
        for name, count in self.cursor.fetchall():
            try:
                print( f"  {name}: {count}" )
            except UnicodeEncodeError:
                safe_name = name.encode( 'ascii', 'replace' ).decode( 'ascii' )
                print( f"  {safe_name}: {count}" )
        
        # Show prompt combination stats
        self.cursor.execute( 'SELECT COUNT(*) FROM prompt_combinations' )
        unique_combos = self.cursor.fetchone()[0]
        self.cursor.execute( 'SELECT COUNT(*) FROM images WHERE prompt_combination_id IS NOT NULL' )
        total_images = self.cursor.fetchone()[0]
        
        print( f"\nPrompt combination deduplication:" )
        print( f"  {total_images} images use {unique_combos} unique prompt combinations" )
        if total_images > 0:
            dedup = ( total_images - unique_combos ) / total_images * 100
            print( f"  {dedup:.1f}% reduction through deduplication" )
        
        # Show reusability of combinations
        self.cursor.execute( '''
            SELECT COUNT(*) FROM (
                SELECT prompt_combination_id 
                FROM images 
                WHERE prompt_combination_id IS NOT NULL
                GROUP BY prompt_combination_id 
                HAVING COUNT(*) > 1
            ) AS reused
        ''' )
        reused_combos = self.cursor.fetchone()[0]
        print( f"  {reused_combos} prompt combinations used by multiple images" )
        
        # Show top reused combinations
        print( f"\nTop 5 most reused prompt combinations:" )
        self.cursor.execute( '''
            SELECT 
                COUNT(*) as usage_count,
                pp.prompt_text,
                np.prompt_text as negative
            FROM images i
            JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
            LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
            LEFT JOIN negative_prompts np ON pc.negative_prompt_id = np.id
            GROUP BY pc.id, pp.prompt_text, np.prompt_text
            ORDER BY usage_count DESC
            LIMIT 5
        ''' )
        for usage, positive, negative in self.cursor.fetchall():
            pos_preview = (positive[:50] + '...') if positive and len(positive) > 50 else (positive or 'NULL')
            neg_preview = (negative[:30] + '...') if negative and len(negative) > 30 else (negative or 'NULL')
            try:
                print( f"  {usage}x: {pos_preview} | neg: {neg_preview}" )
            except UnicodeEncodeError:
                print( f"  {usage}x: [Unicode text]" )
    
    def close( self ):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print( f"\nDatabase connection closed" )
    
    def run( self ):
        """Run the full migration process"""
        try:
            self.connect()
            self.create_normalized_schema()
            
            # Migrate in order (style_prompts first to populate art_styles)
            self.migrate_style_prompts_json()
            self.migrate_results_json()
            self.migrate_tokens_json()
            
            self.verify_migration()
        except Exception as e:
            print( f"Migration failed: {e}" )
            import traceback
            traceback.print_exc()
        finally:
            self.close()


def main():
    import argparse
    
    parser = argparse.ArgumentParser( 
        description='Migrate JSON files to optimally normalized MySQL database',
        epilog='Creates a fully normalized database eliminating all redundancy (no hashes, no derived tables)'
    )
    parser.add_argument( '--host', default='localhost', help='MySQL host (default: localhost)' )
    parser.add_argument( '--user', default='root', help='MySQL user (default: root)' )
    parser.add_argument( '--password', default='', help='MySQL password (default: empty)' )
    parser.add_argument( '--database', default='perchance_gallery', help='Database name (default: perchance_gallery)' )
    parser.add_argument( '--folder', default='data', help='Folder containing JSON files (default: data)' )
    parser.add_argument( '--drop', action='store_true', help='Drop existing database and recreate' )
    
    args = parser.parse_args()
    
    print( "="*60 )
    print( "OPTIMALLY NORMALIZED DATABASE MIGRATION" )
    print( "="*60 )
    print( f"Folder: {args.folder}" )
    print( f"Database: {args.database}" )
    print( f"Host: {args.host}" )
    print( "="*60 )
    
    # Check if we should drop database
    if args.drop:
        try:
            conn = mysql.connector.connect(
                host=args.host,
                user=args.user,
                password=args.password
            )
            cursor = conn.cursor()
            cursor.execute( f"DROP DATABASE IF EXISTS {args.database}" )
            conn.commit()
            conn.close()
            print( f"\nDropped existing database: {args.database}\n" )
        except Error as e:
            print( f"Error dropping database: {e}" )
            return
    
    # Run migration
    migration = OptimalNormalizedDatabaseMigration( args.host, args.user, args.password, args.database, args.folder )
    migration.run()
    
    print( "\n" + "="*60 )
    print( f"Database: {args.database}" )
    print( f"Access via phpMyAdmin: http://localhost/phpmyadmin" )
    print( "="*60 )


if __name__ == '__main__':
    main()
