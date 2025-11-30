import json
from collections import defaultdict

def find_common_substrings( strings ):
    """Find the longest substring common to all strings in the list."""
    if not strings:
        return ""
    if len( strings ) == 1:
        return strings[0]
    
    # Start with the first string and find substrings
    base = strings[0]
    best_match = ""
    
    # Try all possible substrings of the first string
    for length in range( len( base ), 0, -1 ):
        for start in range( len( base ) - length + 1 ):
            substring = base[start:start + length]
            # Check if this substring exists in all other strings
            if all( substring in s for s in strings[1:] ):
                if len( substring ) > len( best_match ):
                    best_match = substring
        # If we found a match at this length, no need to check shorter ones
        if best_match:
            break
    
    return best_match.strip()

def main():
    # Load results
    with open( '../data/results.json', 'r', encoding='utf-8' ) as f:
        data = json.load( f )
    
    # Group prompts by art_style, filtering out prompts over 3000 characters
    style_prompts = defaultdict( list )
    for item in data:
        art_style = item.get( 'art_style', '' )
        prompt = item.get( 'prompt', '' )
        if art_style and prompt and len( prompt ) <= 3000:
            style_prompts[art_style].append( prompt )
    
    # Find longest common substring for each style
    results = {}
    for style, prompts in sorted( style_prompts.items() ):
        # Skip styles with only one prompt
        if len( prompts ) < 2:
            continue
            
        common = find_common_substrings( prompts )
        
        # Skip if no common string found
        if not common:
            continue
            
        results[style] = {
            'count': len( prompts ),
            'style_string': common,
            'length': len( common )
        }
        print( f"{style}: {len( prompts )} prompts, common string length: {len( common )}" )
        if common:
            print( f"  → {common[:100]}{'...' if len( common ) > 100 else ''}" )
    
    # Save results
    with open( '../data/style_prompts.json', 'w', encoding='utf-8' ) as f:
        json.dump( results, f, ensure_ascii=False, indent=2 )
    
    print( f"\nProcessed {len( results )} styles. Results saved to ../data/style_prompts.json" )

if __name__ == "__main__":
    main()
