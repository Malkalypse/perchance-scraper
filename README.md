# Perchance Gallery Scraper

A web scraper and gallery viewer for Perchance AI-generated images with advanced filtering, sorting, and tagging capabilities.

## Features

- **Scraper** (`scraper.py`): Scrapes images from Perchance gallery with CloudScraper bypass
- **Gallery Viewer** (`index.php`): Web interface with multiple sorting modes, search, and drag-to-select
- **Style Analysis** (`style_prompt.py`): Extracts common prompt patterns by art style
- **Token Extraction** (`extract_tokens.py`): Tokenizes prompts for analysis
- **Prompt Grouping** (`group_prompts.py`): Groups images by identical prompts
- **Scheduler** (`scheduler.py`): Automated scraping with cleanup

## Requirements

- Python 3.7+
- PHP 7.4+ (for web interface)
- Apache/XAMPP (for local hosting)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd perchance-scraper
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Create required directories:
```bash
mkdir -p data images/medium
```

## Usage

### Scraping

Basic scraping:
```bash
python scraper.py
```

Continue scraping even when no new items found:
```bash
python scraper.py --continue-on-empty
```

### Web Interface

1. Start your Apache server (e.g., XAMPP)
2. Navigate to `http://localhost/perchance-scraper/`
3. Use the toolbar to:
   - Sort by style or prompt
   - Search with whole word matching
   - Select and delete images
   - Toggle images-only mode
   - Show/edit tags

### Analysis Tools

Extract tokens from prompts:
```bash
python extract_tokens.py
```

Group images by prompt:
```bash
python group_prompts.py --results data/results.json --images-dir images/medium --output data/grouped.json
```

Analyze style prompt patterns:
```bash
python style_prompt.py
```

## Project Structure

```
perchance-scraper/
├── scraper.py           # Main scraper script
├── index.php            # Gallery web interface
├── data.php             # API for gallery data
├── delete.php           # Image deletion endpoint
├── group_prompts.py     # Prompt grouping utility
├── style_prompt.py      # Style analysis tool
├── extract_tokens.py    # Token extraction tool
├── repair_json.py       # JSON repair utility
├── scheduler.py         # Automated scraping
├── requirements.txt     # Python dependencies
├── STYLE_GUIDE.md       # Code style guidelines
└── .gitignore          # Git ignore rules
```

## Configuration

### PHP Memory Limit

For large datasets (50K+ entries), you may need to increase PHP's memory limit in `php.ini`:
```ini
memory_limit = 1024M
```

### Scraper Settings

Edit `scraper.py` to modify:
- `BASE_URL`: Gallery URL
- `params`: Search parameters (sort, timeRange, contentFilter, etc.)

## Notes

- Images are compressed to 50% JPEG quality to save space
- The `data/` and `images/` directories are excluded from version control
- Server-side search is used to handle large datasets efficiently
- Delete operations clear metadata but preserve filenames for reference

## License

This project is for educational purposes only. Respect Perchance's terms of service and rate limits.
