import os
import json
from datetime import datetime
from send2trash import send2trash   # pip install Send2Trash
import pathlib

FULL_DIR = "images/full"
MEDIUM_DIR = "images/medium"

def delete_file( filename, folder ):
    path = os.path.join( folder, filename )
    if os.path.exists( path ):
        send2trash( path )
        print( f"Sent {pathlib.Path( path ).as_posix()} to recycle bin" )

def run_scheduler():
    # Load metadata
    with open( "data/results.json", "r", encoding="utf-8" ) as f:
        results = json.load( f )

    today = datetime.now().date()

    for item in results:
        filename = item.get( "filename" )
        date_str = item.get( "date_downloaded" )
        if not filename or not date_str:
            continue

        date_downloaded = datetime.strptime( date_str, "%Y-%m-%d" ).date()
        age = ( today - date_downloaded ).days

        # Delete full images older than 30 days
        if age > 30:
            delete_file( filename, FULL_DIR )

        # Delete medium images older than 90 days
        if age > 90:
            delete_file( filename, MEDIUM_DIR )

if __name__ == "__main__":
    run_scheduler()