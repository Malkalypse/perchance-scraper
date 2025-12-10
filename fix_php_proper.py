import os
import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    fixed = []
    level = 0
    in_multiline_string = False
    string_start_level = 0
    
    for line in lines:
        stripped = line.strip()
        
        # Empty lines
        if not stripped:
            fixed.append('\n')
            continue
        
        # Track multiline strings (SQL queries)
        if not in_multiline_string:
            if re.match(r'\$\w+\s*(=|\.=)\s*"', stripped) and not stripped.endswith('";'):
                in_multiline_string = True
                string_start_level = level
        
        # If in multiline string, preserve as-is
        if in_multiline_string:
            fixed.append(line)
            if stripped.endswith('";'):
                in_multiline_string = False
            continue
        
        # Determine indent for this line
        line_level = level
        
        # Decrease level for closing braces BEFORE applying indent
        if stripped.startswith('}'):
            level -= 1
            line_level = level
        elif stripped.startswith(']);'):
            level -= 1
            line_level = level
        
        # Apply indent
        fixed.append('  ' * line_level + stripped + '\n')
        
        # Increase level AFTER lines that open blocks
        if stripped.endswith('{') and not '}' in stripped:
            level += 1
        elif stripped == 'try {':
            level += 1
        elif re.match(r'}\s*catch', stripped):
            # } catch - level already decreased, now increase
            level += 1
        elif re.match(r'}\s*else\s*(if.*)?\s*{', stripped):
            # } else { or } else if { - level already decreased, now increase
            level += 1
        elif stripped.endswith('(') or (stripped.endswith('[') and not stripped.endswith('];')):
            level += 1
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(fixed)
    print(f'Fixed: {filepath}')

# Fix all PHP files
for root, dirs, files in os.walk('web'):
    for file in files:
        if file.endswith('.php'):
            fix_file(os.path.join(root, file))
