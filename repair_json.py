import json
import re

# Read the corrupted file
with open( 'data/results.json', 'r', encoding='utf-8' ) as f:
    content = f.read()

# Find where the corruption starts (Extra data error at char 176495838)
# Let's try to find the first complete JSON array
print( "File size:", len( content ) )

# Try to find valid JSON by looking for the main array structure
# The file should start with [ and end with ]
# Let's find where valid JSON ends

try:
    # Try to parse incrementally
    bracket_count = 0
    in_string = False
    escape_next = False
    last_valid_pos = 0
    
    for i, char in enumerate( content ):
        if not in_string:
            if char == '"' and not escape_next:
                in_string = True
            elif char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1
                if bracket_count == 0:
                    # Found potential end of JSON array
                    last_valid_pos = i + 1
                    break
        else:
            if char == '"' and not escape_next:
                in_string = False
            escape_next = ( char == '\\' and not escape_next )
    
    print( f"Last valid position: {last_valid_pos}" )
    
    # Extract valid JSON
    valid_json = content[:last_valid_pos]
    
    # Try to parse it
    data = json.loads( valid_json )
    print( f"Successfully parsed {len( data )} items" )
    
    # Save backup
    with open( 'data/results.json.backup', 'w', encoding='utf-8' ) as f:
        f.write( content )
    print( "Saved backup to data/results.json.backup" )
    
    # Save repaired file
    with open( 'data/results.json', 'w', encoding='utf-8' ) as f:
        json.dump( data, f, ensure_ascii=False, indent=2 )
    print( f"Saved repaired file with {len( data )} items" )
    
except Exception as e:
    print( f"Error: {e}" )
    print( "Attempting alternative repair method..." )
    
    # Alternative: try to find where duplication starts
    # Look for the pattern where JSON array closes and reopens
    match = re.search( r'\]\s*\[', content )
    if match:
        print( f"Found duplicate array at position {match.start()}" )
        # Keep only first array
        valid_json = content[:match.start()+1]
        try:
            data = json.loads( valid_json )
            print( f"Successfully parsed {len( data )} items" )
            
            # Save repaired
            with open( 'data/results.json', 'w', encoding='utf-8' ) as f:
                json.dump( data, f, ensure_ascii=False, indent=2 )
            print( f"Saved repaired file with {len( data )} items" )
        except Exception as e2:
            print( f"Still failed: {e2}" )
