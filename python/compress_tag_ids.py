#!/usr/bin/env python3
"""
Compress tag IDs to remove gaps, renumbering sequentially from 1.
Updates all foreign key references in image_tags table.
"""

import mysql.connector
from mysql.connector import Error

def compress_tag_ids():
    """Renumber tags sequentially starting from 1."""
    try:
        # Connect to database
        db = mysql.connector.connect(
            host='localhost',
            user='root',
            password='',
            database='perchance_gallery'
        )
        cursor = db.cursor(dictionary=True)
        
        print("Fetching all tags ordered by ID...")
        cursor.execute("SELECT id, name FROM tags ORDER BY id ASC")
        tags = cursor.fetchall()
        
        if not tags:
            print("No tags found.")
            return
        
        print(f"Found {len(tags)} tags. Current ID range: {tags[0]['id']} to {tags[-1]['id']}")
        
        # Create mapping of old ID to new ID
        id_mapping = {}
        for new_id, tag in enumerate(tags, start=1):
            old_id = tag['id']
            id_mapping[old_id] = new_id
        
        # Calculate how many IDs will be saved
        gaps_removed = tags[-1]['id'] - len(tags)
        print(f"Removing {gaps_removed} gaps in tag IDs.")
        
        if gaps_removed == 0:
            print("No gaps found - tags are already sequential!")
            return
        
        # Confirm before proceeding
        response = input("\nProceed with renumbering? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled.")
            return
        
        print("\nStarting transaction...")
        
        # Ensure no transaction is already active
        try:
            db.rollback()
        except:
            pass
        
        # Disable foreign key checks temporarily
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        
        db.start_transaction()
        
        try:
            # Create temporary table with new structure
            print("Creating temporary tags table...")
            cursor.execute("""
                CREATE TEMPORARY TABLE tags_temp (
                    id INT PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Insert tags with new IDs
            print("Inserting tags with new sequential IDs...")
            for old_id, new_id in id_mapping.items():
                cursor.execute("""
                    INSERT INTO tags_temp (id, name, created_at)
                    SELECT %s, name, created_at FROM tags WHERE id = %s
                """, (new_id, old_id))
            
            # Update image_tags foreign keys
            print("Updating image_tags references...")
            for old_id, new_id in id_mapping.items():
                cursor.execute("""
                    UPDATE image_tags SET tag_id = %s WHERE tag_id = %s
                """, (new_id + 100000, old_id))  # Temporary offset to avoid conflicts
            
            # Now shift back to actual new IDs
            print("Finalizing image_tags references...")
            for old_id, new_id in id_mapping.items():
                cursor.execute("""
                    UPDATE image_tags SET tag_id = %s WHERE tag_id = %s
                """, (new_id, new_id + 100000))
            
            # Clear and repopulate tags table
            print("Replacing tags table...")
            cursor.execute("DELETE FROM tags")
            cursor.execute("INSERT INTO tags SELECT * FROM tags_temp")
            
            # Reset auto-increment to next available ID
            next_id = len(tags) + 1
            cursor.execute(f"ALTER TABLE tags AUTO_INCREMENT = {next_id}")
            
            # Re-enable foreign key checks
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            
            db.commit()
            print(f"\n✓ Success! Tags renumbered from 1 to {len(tags)}")
            print(f"  Next tag ID will be: {next_id}")
            
            # Verify
            cursor.execute("SELECT COUNT(*) as count FROM tags")
            count = cursor.fetchone()['count']
            cursor.execute("SELECT MAX(id) as max_id FROM tags")
            max_id = cursor.fetchone()['max_id']
            print(f"  Verification: {count} tags, MAX(id) = {max_id}")
            
        except Exception as e:
            db.rollback()
            # Re-enable foreign key checks even on error
            try:
                cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            except:
                pass
            print(f"\n✗ Error during renumbering: {e}")
            print("Transaction rolled back - no changes made.")
            raise
        
        cursor.close()
        db.close()
        
    except Error as e:
        print(f"Database error: {e}")
        raise

if __name__ == '__main__':
    try:
        compress_tag_ids()
    except Exception as e:
        print(f"\nFailed to compress tag IDs: {e}")
        exit(1)
