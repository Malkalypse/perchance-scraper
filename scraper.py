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
        out_path = os.path.join( "images/medium", filename + ".jpg" )   # construct output path
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
            if not os.path.exists( os.path.join( "images/medium", base + ".jpg" ) ):
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
    '''Save all results to data/results.json.'''
    with open( "data/results.json", "w", encoding="utf-8" ) as f:
        json.dump( all_results, f, ensure_ascii=False, indent=2 )


if __name__ == "__main__":

    # Parse command line arguments
    parser = argparse.ArgumentParser( description='Scrape Perchance gallery images' )
    parser.add_argument( '--continue-on-empty', action='store_true',
                        help='Continue scraping even when no new items found in a batch' )
    args = parser.parse_args()

    # Ensure folder structure exists
    os.makedirs( "images/medium", exist_ok=True )
    os.makedirs( "data", exist_ok=True )

    if os.path.exists( "data/results.json" ): # check for existing results file
        # Load existing results from JSON file
        with open( "data/results.json", "r", encoding="utf-8" ) as f:
            old_results = json.load( f )

    else:
        old_results = []

    known_files = {item["filename"] for item in old_results if item.get( "filename" )}
    new_results = []
    skip = 0

    while True:
        items = scrape_page( skip ) # scrape one page of results
        if not items: break         # stop if no items returned

        batch_new_count = 0         # track new items in this batch

        # Collect only new items
        for item in items:
            if item["filename"] not in known_files:
                new_results.append( item )
                known_files.add( item["filename"] )
                batch_new_count += 1

        # Save progress after each batch
        all_results = new_results + old_results
        save_results( all_results )
        print( f"Saved {len( all_results )} items so far (skip={skip}, {batch_new_count} new this batch)" )

        # Stop if no new items found in this batch (unless --continue-on-empty is set)
        if batch_new_count == 0 and not args.continue_on_empty:
            print( "No new items, stopping." )
            break

        skip += 200     # increment skip for next page
        time.sleep( 2 ) # polite delay

    print( f"Added {len( new_results )} new items. Total now {len( new_results ) + len( old_results )}." )
    
    # Run grouping script
    if new_results:
        print( "Running grouping script..." )

        try:

            # Invoke group_prompts.py as a subprocess
            result = subprocess.run(
                [sys.executable,
                 "group_prompts.py", # the script to run
                 "--results", # path to results JSON file
                 "data/results.json", # the results file
                 "--images-dir", # directory containing images
                 "images/medium", # the images directory
                 "--output", # output file for grouped results
                 "data/grouped.json"], # the output file
                capture_output=True,
                text=True,
                check=True
            )

            print( result.stdout )

        # Handle errors from subprocess
        except subprocess.CalledProcessError as e:
            print( f"Grouping failed: {e.stderr}" )