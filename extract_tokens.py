import json
import re
from collections import defaultdict

def load_json( filepath ):
    """Load JSON file and return data."""
    with open( filepath, 'r', encoding='utf-8' ) as f:
        return json.load( f )

def save_json( filepath, data ):
    """Save data to JSON file."""
    with open( filepath, 'w', encoding='utf-8' ) as f:
        json.dump( data, f, ensure_ascii=False, indent=2 )

def extract_tokens( text ):
    """Extract tokens from text using delimiters: comma, period, line breaks."""
    if not text:
        return []
    
    # Split by comma, period, or common line break indicators
    # Patterns: \n, \\n (escaped newline string), actual newlines
    delimiters = r'[,.\n]|\\n'
    tokens = re.split( delimiters, text )
    
    # Clean up tokens: strip whitespace, filter empty strings
    tokens = [token.strip() for token in tokens if token.strip()]
    
    return tokens

def main():
    print( "Loading data files..." )
    
    # Load results and style strings
    results = load_json( 'data/results.json' )
    style_prompts = load_json( 'data/style_prompts.json' )
    
    # Build lookup for style strings
    style_strings = {}
    for style, data in style_prompts.items():
        style_strings[style] = data['style_string']
    
    print( f"Loaded {len( results )} results and {len( style_strings )} style strings" )
    
    # Count tokens
    prompt_tokens = defaultdict( int )
    negative_prompt_tokens = defaultdict( int )
    
    print( "Extracting tokens..." )
    
    for item in results:
        prompt = item.get( 'prompt', '' )
        negative_prompt = item.get( 'negative_prompt', '' )
        art_style = item.get( 'art_style', '' )
        
        # Remove style string from prompt if art_style exists
        if art_style and art_style in style_strings:
            style_string = style_strings[art_style]
            prompt = prompt.replace( style_string, '' )
        
        # Extract and count tokens from prompt
        for token in extract_tokens( prompt ):
            prompt_tokens[token] += 1
        
        # Extract and count tokens from negative_prompt
        for token in extract_tokens( negative_prompt ):
            negative_prompt_tokens[token] += 1
    
    # Sort by frequency (most common first)
    sorted_prompt_tokens = dict( sorted( prompt_tokens.items(), key=lambda x: x[1], reverse=True ) )
    sorted_negative_tokens = dict( sorted( negative_prompt_tokens.items(), key=lambda x: x[1], reverse=True ) )
    
    # Prepare output
    output = {
        'prompt_tokens': sorted_prompt_tokens,
        'negative_prompt_tokens': sorted_negative_tokens,
        'stats': {
            'unique_prompt_tokens': len( sorted_prompt_tokens ),
            'unique_negative_tokens': len( sorted_negative_tokens ),
            'total_prompt_occurrences': sum( sorted_prompt_tokens.values() ),
            'total_negative_occurrences': sum( sorted_negative_tokens.values() )
        }
    }
    
    # Save to file
    save_json( 'data/tokens.json', output )
    
    print( f"\nResults saved to data/tokens.json" )
    print( f"  Unique prompt tokens: {output['stats']['unique_prompt_tokens']}" )
    print( f"  Unique negative prompt tokens: {output['stats']['unique_negative_tokens']}" )
    print( f"  Total prompt token occurrences: {output['stats']['total_prompt_occurrences']}" )
    print( f"  Total negative prompt token occurrences: {output['stats']['total_negative_occurrences']}" )
    
    # Show top 10 most common tokens
    print( f"\nTop 10 most common prompt tokens:" )
    for token, count in list( sorted_prompt_tokens.items() )[:10]:
        print( f"  {count:6d}x  {token[:80]}" )
    
    print( f"\nTop 10 most common negative prompt tokens:" )
    for token, count in list( sorted_negative_tokens.items() )[:10]:
        print( f"  {count:6d}x  {token[:80]}" )

if __name__ == "__main__":
    main()
