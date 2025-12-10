#!/usr/bin/env python3
"""Fix PHP file indentation to use 2-space indents with proper nesting."""

import os
import re

def fix_php_indentation(filepath):
    """Fix indentation in a PHP file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    fixed_lines = []
    indent_level = 0
    in_sql_string = False
    sql_indent = 0
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Preserve empty lines
        if not stripped:
            fixed_lines.append('\n')
            continue
        
        # Track multi-line SQL strings
        if re.search(r'\$\w+\s*=\s*"', stripped) or re.search(r'\$\w+\s*\.=\s*"', stripped):
            if not stripped.endswith('";'):
                in_sql_string = True
                sql_indent = indent_level
        
        if in_sql_string:
            # Keep SQL string indentation as-is but preserve structure
            fixed_lines.append(line)
            if stripped.endswith('";'):
                in_sql_string = False
            continue
        
        # Calculate indent changes BEFORE applying to current line
        indent_before = indent_level
        
        # Decrease indent for closing braces/brackets
        if stripped.startswith('}') or stripped.startswith('])') or stripped == ');':
            indent_level = max(0, indent_level - 1)
            indent_before = indent_level
        
        # Apply indentation
        fixed_lines.append('  ' * indent_before + stripped + '\n')
        
        # Increase indent after opening braces
        if stripped.endswith('{'):
            indent_level += 1
        # Handle try/catch blocks
        elif stripped.startswith('try {') or stripped.startswith('catch'):
            if '{' in stripped:
                indent_level += 1
        # Handle array definitions
        elif stripped.endswith('(') or (stripped.endswith('[') and 'array' in stripped.lower()):
            indent_level += 1
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)
    
    print(f'Fixed {filepath}')

def main():
    """Fix indentation in all PHP files in web directory."""
    web_dir = 'web'
    
    for root, dirs, files in os.walk(web_dir):
        for file in files:
            if file.endswith('.php'):
                filepath = os.path.join(root, file)
                fix_php_indentation(filepath)

if __name__ == '__main__':
    main()
