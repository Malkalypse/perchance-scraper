import cloudscraper             # Cloudflare bypassing scraper
from bs4 import BeautifulSoup   # HTML parsing
# from PIL import Image
import json
import os
import time
from requests.exceptions import RequestException
import subprocess
import sys
import re
from datetime import datetime
import argparse
from mysql.connector import Error

import db
from utils import process_image

BASE_URL = "https://image-generation.perchance.org/gallery"

# Default parameters for Perchance gallery scraping
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

db_manager = db.PerchanceDatabaseManager()


def extract_art_style( title ):
    '''Extract art style from title's opening parentheses.'''

    if not title: return ""                     # if no title, return empty
    if title.startswith( '((' ): return ""      # if title starts with nested parentheses, return empty

    match = re.match( r'^\(([^)]+)\)', title )  # get style within starting parentheses 
    if match: return match.group( 1 ).lower().replace( ' ', '_' )   # transform to snake_case
    
    return ""


def scrape_page( skip ):
    '''Scrape one page of gallery results (200 items).'''

    params["skip"] = skip # set skip parameter for pagination

    try:
        resp = scraper.get( BASE_URL, params=params, timeout=15 ) # get page content
        resp.raise_for_status()                                   # process HTTP errors

    # Handle request errors 
    except RequestException as e:
        print( f"Skipping batch {skip}: {e}" )
        return [] # return empty list instead of crashing

    # Collect images and metadata

    soup = BeautifulSoup( resp.text, "html.parser" ) # parse HTML content with BeautifulSoup
    results = []                                     # initialize results list

    # For each image container, extract metadata and download image
    for ctn in soup.select( ".imageCtn" ):

        # Extract metadata from container attributes
        prompt          = ctn.get( "data-prompt", "" ).strip()
        negative_prompt = ctn.get( "data-negative-prompt", "" ).strip()
        seed            = ctn.get( "data-seed", "" ).strip()
        title           = ctn.get( "data-title", "" ).strip()
        img             = ctn.find( "img" )
        url             = img["src"] if img else None

        filename = None

        # Download and compress image if URL exists
        if url:          
            base = os.path.splitext( os.path.basename( url ) )[0]  # derive base filename from URL
            dir  = os.path.join("../images/medium", base + ".jpg") # set local path

            # Only download if not already present
            if not os.path.exists( dir ):
                filename = process_image(
                    source=url,
                    output_path=dir,
                )
            else:
                filename = base + ".jpg" 

        # Prepare other metadata fields
        date_downloaded = datetime.now().strftime( "%Y-%m-%d" )
        art_style       = extract_art_style( title )

        # Append JSON entry to results list
        results.append( {
            "prompt":           prompt,
            "negative_prompt":  negative_prompt,
            "seed":             seed,
            "title":            title,
            "filename":         filename,
            "date_downloaded":  date_downloaded,
            "art_style":        art_style
        } )

    return results


def parse_args():
    '''Parse command line arguments.'''

    parser = argparse.ArgumentParser(
        description='Scrape Perchance gallery images'
    )
    parser.add_argument(
        '--continue-on-empty',
        action='store_true',
        help='Continue scraping even when no new items found in a batch'
    )
    return parser.parse_args()


def ensure_directories():
    '''Ensure necessary directories exist.'''

    os.makedirs( "../images/medium", exist_ok=True )
    os.makedirs( "data", exist_ok=True )


def load_known_files( db_manager ):
    '''Load known filenames from database and existing JSON results.'''

    # Load from DB
    db_manager.cursor.execute( 'SELECT filename FROM images WHERE filename IS NOT NULL')
    known_files = {row[0] for row in db_manager.cursor.fetchall()}

    # Load from JSON (backward compatibility)
    old_results = []
    if os.path.exists( "../data/results.json" ):
        with open( "../data/results.json", "r", encoding="utf-8" ) as f:
            old_results = json.load( f )
            known_files.update(
                {item["filename"] for item in old_results if item.get( "filename" )}
            )

    return known_files, old_results


def process_batch( items, known_files, db_manager, new_results, new_image_ids ):
    '''Process a batch of scraped items, inserting new ones into the database.'''

    batch_new_count = 0

    for item in items:
        if item["filename"] and item["filename"] not in known_files:

            try:
                image_id = db_manager.insert_image( item )
                new_results.append( item )
                new_image_ids.append( image_id )
                known_files.add( item["filename"] )
                batch_new_count += 1

            except Error as e:
                print( f"Failed to insert {item['filename']}: {e}" )

    return batch_new_count


def save_results( new_results, old_results=None ):
    """
    Save results to ../data/results.json (kept for backup/compatibility).

    Args:
        new_results: List of newly scraped items.
        old_results: Optional list of previously loaded items (default None).
    """

    if old_results is None:
        all_results = new_results
    else:
        all_results = new_results + old_results

    with open( "../data/results.json", "w", encoding="utf-8" ) as f:
        json.dump( all_results, f, ensure_ascii=False, indent=2 )


def update_token_relationships( new_image_ids ):
    if not new_image_ids:
        return
    print(f"\nUpdating token relationships for {len(new_image_ids)} new images...")
    import subprocess
    try:
        subprocess.run(
            [sys.executable, 'build_token_relationships.py', '--update'],
            cwd='c:/xampp/htdocs/perchance-scraper/python',
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Error updating token relationships: {e}")
        print(e.stderr)


def update_table_counts_cache():
    print("\nUpdating table counts cache...")
    try:
        from pathlib import Path
        script_dir = Path(__file__).parent
        result = subprocess.run(
            [sys.executable, str(script_dir / 'update_table_counts.py')],
            capture_output=True,
            text=True,
            cwd=str(script_dir)
        )
        if result.returncode != 0:
            error_msg = f"Warning: Failed to update table counts cache (exit code {result.returncode})"
            if result.stderr:
                error_msg += f":\n{result.stderr}"
            if result.stdout:
                error_msg += f"\nOutput: {result.stdout}"
            print(error_msg)
    except Exception as e:
        print(f"Warning: Could not update table counts cache: {e}")


def main():
    '''Main scraping loop.'''

    args = parse_args()  # parse command line arguments
    ensure_directories() # ensure necessary directories exist
    db_manager.connect() # connect to database

    known_files, old_results = load_known_files( db_manager ) # load known filenames

    new_results, new_image_ids = [], [] # track new results and their IDs
    skip = 0

    try:
        while True:
            items = scrape_page( skip ) # scrape one page of results
            if not items: break         # stop if no items returned

            # Process and insert new items in the batch
            batch_new_count = process_batch(
                items,
                known_files,
                db_manager,
                new_results,
                new_image_ids
            )

            save_results( new_results, old_results ) # save to JSON for backup
            
            print( f"Saved {len(known_files)} items in database (skip={skip}, {batch_new_count} new this batch)" )

            # Stop if no new items found in this batch (unless --continue-on-empty is set)
            if batch_new_count == 0 and not args.continue_on_empty:
                print( "No new items, stopping." )
                break

            skip += 200     # increment skip for next page
            time.sleep( 2 ) # polite delay

    finally:
        db_manager.close()

    print( f"Added {len( new_results )} new items. Total now {len( known_files )}." )

    if new_image_ids:
        update_token_relationships(new_image_ids)
        update_table_counts_cache()


if __name__ == "__main__":
    main()