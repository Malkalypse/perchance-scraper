import cloudscraper             # Cloudflare bypassing scraper
from bs4 import BeautifulSoup   # HTML parsing
from PIL import Image
import json
import os
import io
import time
#import requests
from requests.exceptions import RequestException
import subprocess
import sys
import re
from datetime import datetime
import argparse
import mysql.connector
from mysql.connector import Error
import hashlib

BASE_URL = "https://image-generation.perchance.org/gallery"

params = {
    "sort": "recent",
    "timeRange": "1-month",
    "hideIfScoreIsBelow": -1,
    "contentFilter": "none",
    "subChannel": "public",
    "channel": "ai-text-to-image-generator",
    "imageElementsHtmlOnly": "true"
}

scraper = cloudscraper.create_scraper() # create CloudScraper instance


class DatabaseManager:
    """Manages database connections and image insertion."""
    
    def __init__(self, host='localhost', user='root', password='', database='perchance_gallery'):
        self.host = host
        self.user = user
        self.password = password
        self.database = database
        self.conn = None
        self.cursor = None
        
        # Caches for deduplication
        self.positive_prompt_cache = {}
        self.negative_prompt_cache = {}
        self.prompt_combination_cache = {}
        self.style_cache = {}
        self.title_cache = {}
    
    def connect(self):
        """Establish database connection."""
        try:
            self.conn = mysql.connector.connect(
                host=self.host,
                user=self.user,
                password=self.password,
                database=self.database,
                charset='utf8mb4',
                use_unicode=True
            )
            self.cursor = self.conn.cursor()
            print(f"Connected to database: {self.database}")
        except Error as e:
            print(f"Error connecting to MySQL: {e}")
            raise
    
    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
    
    def get_or_create_positive_prompt(self, prompt_text):
        """Get or create a positive prompt, return its ID."""
        if not prompt_text:
            return None
        
        prompt_hash = hashlib.sha256(prompt_text.encode('utf-8')).hexdigest()
        
        if prompt_hash in self.positive_prompt_cache:
            return self.positive_prompt_cache[prompt_hash]
        
        self.cursor.execute('SELECT id FROM positive_prompts WHERE hash = %s', (prompt_hash,))
        result = self.cursor.fetchone()
        
        if result:
            prompt_id = result[0]
        else:
            self.cursor.execute(
                'INSERT INTO positive_prompts (hash, prompt_text) VALUES (%s, %s)',
                (prompt_hash, prompt_text)
            )
            prompt_id = self.cursor.lastrowid
        
        self.positive_prompt_cache[prompt_hash] = prompt_id
        return prompt_id
    
    def get_or_create_negative_prompt(self, prompt_text):
        """Get or create a negative prompt, return its ID."""
        if not prompt_text:
            return None
        
        prompt_hash = hashlib.sha256(prompt_text.encode('utf-8')).hexdigest()
        
        if prompt_hash in self.negative_prompt_cache:
            return self.negative_prompt_cache[prompt_hash]
        
        self.cursor.execute('SELECT id FROM negative_prompts WHERE hash = %s', (prompt_hash,))
        result = self.cursor.fetchone()
        
        if result:
            prompt_id = result[0]
        else:
            self.cursor.execute(
                'INSERT INTO negative_prompts (hash, prompt_text) VALUES (%s, %s)',
                (prompt_hash, prompt_text)
            )
            prompt_id = self.cursor.lastrowid
        
        self.negative_prompt_cache[prompt_hash] = prompt_id
        return prompt_id
    
    def get_or_create_prompt_combination(self, positive_prompt_id, negative_prompt_id):
        """Get or create a prompt combination, return its ID."""
        combined = f"{positive_prompt_id or 'NULL'}|||{negative_prompt_id or 'NULL'}"
        combination_hash = hashlib.sha256(combined.encode('utf-8')).hexdigest()
        
        if combination_hash in self.prompt_combination_cache:
            return self.prompt_combination_cache[combination_hash]
        
        self.cursor.execute('SELECT id FROM prompt_combinations WHERE hash = %s', (combination_hash,))
        result = self.cursor.fetchone()
        
        if result:
            combo_id = result[0]
        else:
            self.cursor.execute(
                'INSERT INTO prompt_combinations (positive_prompt_id, negative_prompt_id, hash) VALUES (%s, %s, %s)',
                (positive_prompt_id, negative_prompt_id, combination_hash)
            )
            combo_id = self.cursor.lastrowid
        
        self.prompt_combination_cache[combination_hash] = combo_id
        return combo_id
    
    def get_or_create_style(self, style_name):
        """Get or create an art style, return its ID."""
        if not style_name:
            return None
        
        if style_name in self.style_cache:
            return self.style_cache[style_name]
        
        self.cursor.execute('SELECT id FROM art_styles WHERE name = %s', (style_name,))
        result = self.cursor.fetchone()
        
        if result:
            style_id = result[0]
        else:
            self.cursor.execute(
                'INSERT INTO art_styles (name, style_string) VALUES (%s, %s)',
                (style_name, '')
            )
            style_id = self.cursor.lastrowid
        
        self.style_cache[style_name] = style_id
        return style_id
    
    def get_or_create_title(self, title_text):
        """Get or create a title, return its ID."""
        if not title_text:
            return None
        
        title_hash = hashlib.sha256(title_text.encode('utf-8')).hexdigest()
        
        if title_hash in self.title_cache:
            return self.title_cache[title_hash]
        
        self.cursor.execute('SELECT id FROM titles WHERE hash = %s', (title_hash,))
        result = self.cursor.fetchone()
        
        if result:
            title_id = result[0]
        else:
            self.cursor.execute(
                'INSERT INTO titles (hash, title_text) VALUES (%s, %s)',
                (title_hash, title_text)
            )
            title_id = self.cursor.lastrowid
        
        self.title_cache[title_hash] = title_id
        return title_id
    
    def image_exists(self, filename):
        """Check if an image with this filename already exists."""
        self.cursor.execute('SELECT id FROM images WHERE filename = %s', (filename,))
        return self.cursor.fetchone() is not None
    
    def insert_image(self, item):
        """Insert a new image into the database. Returns the new image ID."""
        # Get or create foreign key IDs
        positive_prompt_id = self.get_or_create_positive_prompt(item['prompt'])
        negative_prompt_id = self.get_or_create_negative_prompt(item['negative_prompt'])
        prompt_combination_id = self.get_or_create_prompt_combination(positive_prompt_id, negative_prompt_id)
        style_id = self.get_or_create_style(item['art_style'])
        title_id = self.get_or_create_title(item['title'])
        
        # Insert image
        self.cursor.execute('''
            INSERT INTO images 
            (filename, prompt_combination_id, art_style_id, title_id, seed, date_downloaded, deleted, tags)
            VALUES (%s, %s, %s, %s, %s, %s, 0, '')
        ''', (
            item['filename'],
            prompt_combination_id,
            style_id,
            title_id,
            item['seed'],
            item['date_downloaded']
        ))
        
        self.conn.commit()
        return self.cursor.lastrowid  # Return the ID of the newly inserted image


db = DatabaseManager()


def download_and_compress( url, filename ):
    """Download original image and save at 50% JPEG quality."""

    # Download image
    try:
        resp = scraper.get( url, timeout=10 )   # response object from scraper call
        resp.raise_for_status()                 # check for request errors

        # Open original in memory
        img = Image.open( io.BytesIO( resp.content ) )                  # open image from bytes in memory
        if img.mode in ( "RGBA", "P" ): img = img.convert( "RGB" )      # remove alpha channel

        # Save at 50% quality
        out_path = os.path.join( "../images/medium", filename + ".jpg" )   # construct output path
        img.save( out_path, "JPEG", quality=50, optimize=True )         # save compressed image

        return filename + ".jpg"
    
    # Handle download errors
    except RequestException as e:
        print( f"Failed to download {url}: {e}" )
        return None


def extract_art_style( title ):
    """Extract art style from title's opening parentheses."""

    if not title: return ""                     # if no title, return empty
    if title.startswith( '((' ): return ""      # if title starts with nested parentheses, return empty

    match = re.match( r'^\(([^)]+)\)', title )  # get style within starting parentheses 
    if match: return match.group( 1 ).lower().replace( ' ', '_' ) # transform to snake_case
    
    return ""


def scrape_page( skip ):
    """Scrape one page of gallery results (200 items)."""

    params["skip"] = skip # set skip parameter for pagination

    try:
        resp = scraper.get( BASE_URL, params=params, timeout=15 )
        resp.raise_for_status()

    # Handle request errors 
    except RequestException as e:
        print( f"Skipping batch {skip}: {e}" )
        return [] # return empty list instead of crashing

    soup = BeautifulSoup( resp.text, "html.parser" ) # parse HTML content with BeautifulSoup
    results = [] # initialize results list

    # For each image container, extract metadata
    for ctn in soup.select( ".imageCtn" ):

        # Extract metadata from container attributes
        prompt = ctn.get( "data-prompt", "" ).strip()
        negative_prompt = ctn.get( "data-negative-prompt", "" ).strip()
        seed = ctn.get( "data-seed", "" ).strip()
        title = ctn.get( "data-title", "" ).strip()
        img = ctn.find( "img" )
        url = img["src"] if img else None

        filename = None

        # Download and compress image if URL exists
        if url:          
            base = os.path.splitext( os.path.basename( url ) )[0] # derive base filename from URL

            # Only download if not already present
            if not os.path.exists( os.path.join( "../images/medium", base + ".jpg" ) ):
                filename = download_and_compress( url, base )
            else:
                filename = base + ".jpg" 

        date_downloaded = datetime.now().strftime( "%Y-%m-%d" )
        art_style = extract_art_style( title )

        # Append JSON entry to results list
        results.append( {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "seed": seed,
            "title": title,
            "filename": filename,
            "date_downloaded": date_downloaded,
            "art_style": art_style
        } )

    return results


def save_results( all_results ):
    '''Save all results to ../data/results.json (kept for backup/compatibility).'''
    with open( "../data/results.json", "w", encoding="utf-8" ) as f:
        json.dump( all_results, f, ensure_ascii=False, indent=2 )


if __name__ == "__main__":

    # Parse command line arguments
    parser = argparse.ArgumentParser( description='Scrape Perchance gallery images' )
    parser.add_argument( '--continue-on-empty', action='store_true',
                        help='Continue scraping even when no new items found in a batch' )
    args = parser.parse_args()

    # Ensure folder structure exists
    os.makedirs( "../images/medium", exist_ok=True )
    os.makedirs( "data", exist_ok=True )

    # Connect to database
    db.connect()

    # Load existing filenames from database to avoid duplicates
    db.cursor.execute('SELECT filename FROM images WHERE filename IS NOT NULL')
    known_files = {row[0] for row in db.cursor.fetchall()}
    
    # Also load from JSON if it exists (for backward compatibility during transition)
    if os.path.exists( "../data/results.json" ):
        with open( "../data/results.json", "r", encoding="utf-8" ) as f:
            old_results = json.load( f )
            known_files.update({item["filename"] for item in old_results if item.get("filename")})
    else:
        old_results = []

    new_results = []
    new_image_ids = []  # Track IDs of newly inserted images
    skip = 0

    try:
        while True:
            items = scrape_page( skip ) # scrape one page of results
            if not items: break         # stop if no items returned

            batch_new_count = 0         # track new items in this batch

            # Collect and insert only new items
            for item in items:
                if item["filename"] and item["filename"] not in known_files:
                    # Insert into database
                    try:
                        image_id = db.insert_image(item)
                        new_results.append(item)
                        new_image_ids.append(image_id)  # Track the new image ID
                        known_files.add(item["filename"])
                        batch_new_count += 1
                    except Error as e:
                        print(f"Failed to insert {item['filename']}: {e}")

            # Also save to JSON for backup
            all_results = new_results + old_results
            save_results( all_results )
            
            total_in_db = len(known_files)
            print( f"Saved {total_in_db} items in database (skip={skip}, {batch_new_count} new this batch)" )

            # Stop if no new items found in this batch (unless --continue-on-empty is set)
            if batch_new_count == 0 and not args.continue_on_empty:
                print( "No new items, stopping." )
                break

            skip += 200     # increment skip for next page
            time.sleep( 2 ) # polite delay

    finally:
        db.close()

    print( f"Added {len( new_results )} new items. Total now {len( known_files )}." )
    
    # Skip grouping script - no longer needed with database
    print( "Database updated. Grouping is done dynamically via queries." )
    
    # Update token relationships if new items were added
    if len( new_image_ids ) > 0:
        print( f"\nUpdating token relationships for {len(new_image_ids)} new images..." )
        import subprocess
        try:
            result = subprocess.run(
                ['python', 'build_token_relationships.py', '--update'],
                cwd='c:/xampp/htdocs/perchance-scraper/python',
                capture_output=True,
                text=True,
                check=True
            )
            print( "Token relationships updated successfully." )
            print( result.stdout )
        except subprocess.CalledProcessError as e:
            print( f"Error updating token relationships: {e}" )
            print( e.stderr )