#!/usr/bin/env python3
"""
Group images by identical (prompt, negative_prompt) pairs.

Usage:
  python group_prompts.py --results ../data/results.json --images-dir ../images/medium --output ../data/grouped.json
  python group_prompts.py --make-folders --copy --limit 10

Options:
  --results PATH        Path to results.json (default: ../data/results.json)
  --images-dir PATH     Directory containing image files (default: ../images/medium)
  --output PATH         Output JSON file for group index (default: ../data/grouped.json)
  --make-folders        Create per-group folders under ../images/groups/<hash>
  --copy                Copy image files into group folders (implies --make-folders)
  --limit N             Only process first N entries (debugging)
  --min-count N         Only include groups with at least N images (default: 2)
  --slug-length N       Length of hash slug for folder naming (default: 10)
  --dry-run             Do everything except writing output JSON / creating folders

Output JSON structure:
{
  "generated_at": ISO timestamp,
  "source_file": path,
  "group_count": int,
  "groups": [
     {
       "id": "group_0001",
       "hash": "<sha1 first slug-length chars>",
       "prompt": "...",
       "negative_prompt": "...",
       "count": 5,
       "filenames": ["a.jpg", ...]
     }, ...
  ],
  "orphans": ["filename_without_prompt.jpg", ...]
}
"""
from __future__ import annotations
import argparse
import json
import hashlib
import datetime as dt
from pathlib import Path
from typing import Dict, List, Tuple
import shutil
import sys

def normalize( text: str ) -> str:
    """Collapse whitespace and strip."""
    return " ".join( text.split() ) if text is not None else ""

def hash_pair( prompt: str, negative: str ) -> str:
    h = hashlib.sha1( ( prompt + "\u241f" + negative ).encode( "utf-8" ) ).hexdigest()
    return h

def load_results( path: Path, limit: int | None ) -> List[dict]:
    data = json.loads( path.read_text( encoding="utf-8" ) )
    if limit is not None:
        data = data[:limit]
    return data

def load_existing_groups( path: Path ) -> Tuple[Dict[Tuple[str,str], List[str]], List[str]]:
    """Load existing grouped.json and return groups dict and orphans."""
    if not path.exists():
        return {}, []
    data = json.loads( path.read_text( encoding="utf-8" ) )
    groups: Dict[Tuple[str,str], List[str]] = {}
    for g in data.get( "groups", [] ):
        key = ( normalize( g["prompt"] ), normalize( g["negative_prompt"] ) )
        groups[key] = g["filenames"]
    orphans = data.get( "orphans", [] )
    return groups, orphans

def group_entries( entries: List[dict] ) -> Tuple[Dict[Tuple[str,str], List[dict]], List[str]]:
    groups: Dict[Tuple[str,str], List[dict]] = {}
    orphans: List[str] = []
    for item in entries:
        prompt = item.get( "prompt" )
        neg = item.get( "negative_prompt", "" )
        filename = item.get( "filename" )
        if prompt is None:
            if filename:
                orphans.append( filename )
            continue
        n_prompt = normalize( prompt )
        n_neg = normalize( neg )
        key = ( n_prompt, n_neg )
        groups.setdefault( key, [] ).append( item )
    return groups, orphans

def merge_groups( existing: Dict[Tuple[str,str], List[str]], new: Dict[Tuple[str,str], List[dict]] ) -> Dict[Tuple[str,str], List[str]]:
    """Merge new items into existing groups, returning combined groups."""
    merged = dict( existing )
    for key, items in new.items():
        filenames = [i.get( "filename" ) for i in items if i.get( "filename" )]
        if key in merged:
            # Add only new filenames
            merged[key].extend( f for f in filenames if f not in merged[key] )
        else:
            merged[key] = filenames
    return merged

def build_index( groups: Dict[Tuple[str,str], List[str]], orphans: List[str], min_count: int, slug_length: int, source_file: Path ) -> dict:
    # Separate groups with multiple entries from single entries
    multi_groups = []
    single_groups = []
    
    for key, filenames in groups.items():
        if len( filenames ) < min_count:
            continue
        prompt, negative = key
        full_hash = hash_pair( prompt, negative )
        slug = full_hash[:slug_length]
        group_data = {
            "id": "",  # Will be assigned later
            "hash": slug,
            "prompt": prompt,
            "negative_prompt": negative,
            "count": len( filenames ),
            "filenames": filenames,
        }
        
        if len( filenames ) > 1:
            multi_groups.append( group_data )
        else:
            single_groups.append( group_data )
    
    # Sort multi-groups by count (descending) then prompt
    multi_groups.sort( key=lambda g: ( -g["count"], g["prompt"][:80] ) )
    
    # Sort single-groups by prompt
    single_groups.sort( key=lambda g: g["prompt"][:80] )
    
    # Combine: multi-groups first, then single-groups
    out_groups = multi_groups + single_groups
    
    # Assign IDs
    for idx, group in enumerate( out_groups, start=1 ):
        group["id"] = f"group_{idx:04d}"
    
    return {
        "generated_at": dt.datetime.utcnow().isoformat( timespec="seconds" ) + "Z",
        "source_file": str( source_file ),
        "group_count": len( out_groups ),
        "groups": out_groups,
    }

def create_group_folders( base_images: Path, groups: List[dict], copy: bool ) -> None:
    target_root = base_images.parent / "groups"
    target_root.mkdir( parents=True, exist_ok=True )
    for g in groups:
        slug = g["hash"]
        folder = target_root / slug
        folder.mkdir( exist_ok=True )
        if copy:
            for fname in g["filenames"]:
                src = base_images / fname
                if not src.exists():
                    continue
                dst = folder / fname
                if not dst.exists():
                    shutil.copy2( src, dst )

def parse_args( argv: List[str] ) -> argparse.Namespace:
    p = argparse.ArgumentParser( description="Group images by identical prompt + negative_prompt" )
    p.add_argument( "--results", default="../data/results.json" )
    p.add_argument( "--images-dir", default="../images/medium" )
    p.add_argument( "--output", default="../data/grouped.json" )
    p.add_argument( "--make-folders", action="store_true" )
    p.add_argument( "--copy", action="store_true", help="Copy images into folders (implies --make-folders)" )
    p.add_argument( "--limit", type=int )
    p.add_argument( "--min-count", type=int, default=1 )
    p.add_argument( "--slug-length", type=int, default=10 )
    p.add_argument( "--dry-run", action="store_true" )
    return p.parse_args( argv )

def main( argv: List[str] ) -> int:
    args = parse_args( argv )
    results_path = Path( args.results )
    images_dir = Path( args.images_dir )
    output_path = Path( args.output )
    if not results_path.exists():
        print( f"ERROR: results file not found: {results_path}", file=sys.stderr )
        return 2
    
    # Load existing groups (incremental mode)
    existing_groups, existing_orphans = load_existing_groups( output_path )
    
    # Load and group new entries
    entries = load_results( results_path, args.limit )
    new_groups, new_orphans = group_entries( entries )
    
    # Merge
    merged_groups = merge_groups( existing_groups, new_groups )
    all_orphans = list( set( existing_orphans + new_orphans ) )
    
    # Build final index
    index = build_index( merged_groups, all_orphans, args.min_count, args.slug_length, results_path )
    
    # If folder creation requested, ensure we keep only groups with >= min_count
    if args.make_folders or args.copy:
        create_group_folders( images_dir, index["groups"], copy=args.copy )
    if args.dry_run:
        print( json.dumps( index, indent=2 )[:5000] )
    else:
        output_path.parent.mkdir( parents=True, exist_ok=True )
        output_path.write_text( json.dumps( index, indent=2 ), encoding="utf-8" )
        print( f"Wrote {index['group_count']} groups to {output_path}" )
    return 0

if __name__ == "__main__":
    raise SystemExit( main( sys.argv[1:] ) )
