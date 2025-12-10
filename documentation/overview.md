# Perchance Gallery Scraper

A web scraper and gallery viewer for Perchance AI-generated images with advanced filtering, sorting, and tagging capabilities, backed by a normalized MySQL database.

## Project Structure

```
perchance-scraper/
├── web/                    # Web application files
│   ├── api/               # PHP API endpoints
│   │   ├── data.php       # Image data API
│   │   ├── update_tags.php # Tag update API
│   │   └── delete.php     # Image deletion API
│   ├── index.php          # Main gallery viewer interface
│   ├── script.js          # Frontend JavaScript
│   └── style.css          # Frontend styles
├── python/                 # Python scripts
│   ├── scraper.py         # Image scraper
│   ├── migrate_to_db.py   # Database migration tool
│   ├── scheduler.py       # Automated scraping scheduler
│   ├── style_prompt.py    # Style analysis tool
│   ├── extract_tokens.py  # Prompt tokenization tool
│   ├── group_prompts.py   # Prompt grouping utility
│   ├── repair_json.py     # JSON repair utility
│   └── requirements.txt   # Python dependencies
├── data/                   # Data files
│   ├── results.json       # Backup JSON data
│   ├── style_prompts.json # Style analysis results
│   └── tokens.json        # Token analysis results
├── images/                 # Image storage
│   └── medium/            # Medium-sized images (300px)
└── documentation/          # Documentation files
    ├── README.md
    └── DATABASE_SCHEMA.md
```

## Features

- **Scraper** (`python/scraper.py`): Scrapes images from Perchance gallery with CloudScraper bypass, stores directly to database
- **Database Migration** (`python/migrate_to_db.py`): Migrates JSON data to optimized MySQL database with deduplication
- **Gallery Viewer** (`web/index.php`): Modern web interface with sorting, search, drag-to-select, and tag management
- **Tag Management**: Many-to-many tagging system with per-prompt-combination tag updates
- **Search System**: Search by prompt or tag with whole word/substring matching, Enter key or blur to execute
- **Style Analysis** (`python/style_prompt.py`): Extracts common prompt patterns by art style
- **Token Extraction** (`python/extract_tokens.py`): Tokenizes prompts for analysis
- **Scheduler** (`python/scheduler.py`): Automated scraping with cleanup

## Requirements

- Python 3.7+
- PHP 7.4+ (for web interface)
- Apache/XAMPP with MySQL/MariaDB (for local hosting)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd perchance-scraper
```

2. Install Python dependencies:
```bash
cd python
pip install -r requirements.txt
cd ..
```

3. Create required directories (if not already present):
```bash
mkdir -p data images/medium
```

4. Set up the database:
```bash
cd python
python migrate_to_db.py
cd ..
```

This creates a normalized database schema with:
- Deduplicated prompts (positive and negative)
- Prompt combinations with hash-based lookups
- Separate tables for titles, art styles, and tags
- Many-to-many relationships for image tags
- Optimized indexes for fast queries

## Usage

### Database Migration

Migrate existing JSON data to MySQL:
```bash
cd python
python migrate_to_db.py
cd ..
```

The script creates 9 optimized tables:
- `positive_prompts`: Unique positive prompts with FULLTEXT search and hash-based deduplication
- `negative_prompts`: Unique negative prompts with FULLTEXT search and hash-based deduplication
- `prompt_combinations`: Links positive/negative prompts with deduplication hashes
- `titles`: Deduplicated image titles
- `art_styles`: Available art styles with cleaned style strings
- `images`: Core image data with foreign keys to related tables and soft delete support
- `tags`: Tag names for many-to-many tagging
- `image_tags`: Junction table linking images to tags with cascading deletes

### Scraping

Basic scraping (writes to database):
```bash
cd python
python scraper.py
cd ..
```

Continue scraping even when no new items found:
```bash
cd python
python scraper.py --continue-on-empty
cd ..
```

### Web Interface

1. Start your Apache and MySQL servers (e.g., XAMPP)
2. Navigate to `http://localhost/perchance-scraper/web/`
3. Use the toolbar to:
   - **Sort** by recent, style, or prompt
   - **Search** by prompt or tag (whole word or substring matching)
     - Press Enter or click away from search box to execute search
     - Searches return unlimited results by default (use Max field to limit)
   - **Navigate** with pagination controls (Back/Next/Page number)
   - **Select** and delete images (enable Select Mode, drag to multi-select, Delete key or button)
   - **Toggle** images-only mode for compact grid viewing
   - **Edit tags** (show tags checkbox, type comma-separated tags, press Enter to save)
   - **Persist** all UI state (sort, filters, pagination) across page reloads via localStorage

### Tag Management

- Tags are applied per **prompt combination** - updating tags for one image automatically updates all images with the same prompt
- Tags support searching - use the "Search by: Tag" dropdown to find images by tag name
- Enter key saves tags (no Update button needed)
- Tags display below images in images-only mode, or in metadata section otherwise

### Analysis Tools

Extract tokens from prompts:
```bash
cd python
python extract_tokens.py
cd ..
```

Analyze style prompt patterns:
```bash
cd python
python style_prompt.py
cd ..
```

Group prompts by similarity:
```bash
cd python
python group_prompts.py --results ../data/results.json --images-dir ../images/medium --output ../data/grouped.json
cd ..
```

## Architecture

### Backend (PHP)
- **`web/api/data.php`**: Main API endpoint for querying images with filters, sorting, search, and pagination
- **`web/api/update_tags.php`**: Handles tag updates for all images in a prompt combination
- **`web/api/delete.php`**: Soft-deletes images (sets deleted flag, nullifies metadata, removes file)

### Frontend (JavaScript)
- **`web/script.js`**: Single-page application logic with localStorage state persistence
- **`web/style.css`**: Responsive styling with dark theme and compact grid mode
- **`web/index.php`**: HTML structure and toolbar controls

### Python Scripts
- **`python/scraper.py`**: CloudScraper-based web scraper with direct database writes
- **`python/migrate_to_db.py`**: Bulk JSON-to-MySQL migration with deduplication
- **`python/scheduler.py`**: Automated scraping scheduler with cleanup
- **Analysis tools**: Token extraction, style analysis, prompt grouping utilities

## Database Schema

The system uses a normalized MySQL schema optimized for performance and deduplication:

- **Deduplication**: Prompts, titles, and prompt combinations stored once and referenced by ID
- **Hash-based lookups**: SHA256 hashes on TEXT columns enable O(1) duplicate detection
- **Many-to-many tags**: Flexible tagging with automatic propagation per prompt combination
- **FULLTEXT search**: Fast text search on prompts with whole word (REGEXP) and substring (LIKE) support
- **Soft deletes**: Images marked as deleted, metadata nullified, but records preserved
- **Cascading deletes**: Removing image_tags relationships handled automatically

See `documentation/DATABASE_SCHEMA.md` for detailed schema information.

Total storage: ~228 MB for 110K images with full metadata.

## Configuration

### PHP Memory Limit

For large datasets (50K+ entries), you may need to increase PHP's memory limit in `php.ini`:
```ini
memory_limit = 1024M
```

### MySQL Configuration

Ensure InnoDB is enabled and utf8mb4 charset is supported:
```ini
default-storage-engine = InnoDB
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

### Scraper Settings

Edit `scraper.py` to modify:
- `BASE_URL`: Gallery URL
- `params`: Search parameters (sort, timeRange, contentFilter, etc.)

## Notes

- Images are compressed to 50% JPEG quality (300px max dimension) to save space
- The `data/` and `images/` directories are excluded from version control
- Server-side sorting and pagination handle large datasets efficiently
- Search returns unlimited results by default (use Max field to limit)
- Delete operations mark images as deleted and nullify metadata (soft delete)
- UI state (sort mode, filters, search terms, etc.) persists in localStorage
- Tags update all images sharing the same prompt_combination_id
- Art style strings are cleaned (trimmed spaces, commas, leading periods)
- Search executes on Enter key or blur (not on every keystroke) for performance

## Recent Updates

- **Folder reorganization**: Separated web files (`web/`) and Python scripts (`python/`)
- **API subfolder**: PHP endpoints moved to `web/api/` for better organization
- **Search improvements**: Added tag search, Enter/blur execution, unlimited results by default
- **Tag system**: Many-to-many relationships with automatic prompt-combination propagation
- **UI enhancements**: Images-only mode, drag-to-select, localStorage state persistence
- **Double outline**: Black + white box-shadow for selected images (visible on any background)
- **Cleanup**: Removed obsolete migration scripts, comparison docs, and backup files

## License

This project is for educational purposes only. Respect Perchance's terms of service and rate limits.
