# Database Schema Documentation

## Overview

The `migrate_to_db.py` script creates a **fully normalized relational database** that eliminates redundancy through deduplication and uses optimized many-to-many relationships.

## Key Features

### ✅ **Deduplication**
- **45% reduction on prompt combinations**: 110K images reference only 60K unique combinations
- **47.6% reduction on titles**: Shared titles stored once and referenced by ID
- **87.8% reduction on negative prompts**: Most images share common negative prompts
- Hash-based duplicate detection for O(1) lookups

### ✅ **Relational Integrity**
- Foreign key constraints ensure data consistency
- Cascade deletes prevent orphaned records
- Many-to-many tag system through junction tables
- Atomic tag updates per prompt combination

### ✅ **Query Performance**
- SHA256 hashes on TEXT columns enable fast deduplication
- FULLTEXT indexes on prompts for efficient search
- Indexed foreign keys for fast JOINs
- GROUP_CONCAT for efficient tag retrieval
- Total migration time: ~3 minutes for 110K images

### ✅ **Tag Management**
- Many-to-many relationship between images and tags
- Tags apply to all images sharing the same prompt combination
- Automatic tag propagation across related images
- Reusable tag names across the dataset

## Database Schema

### Tables

#### 1. `positive_prompts`
Deduplicated positive prompts with hash-based lookups.

```sql
CREATE TABLE positive_prompts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prompt_hash VARCHAR(64) UNIQUE NOT NULL,
    prompt_text TEXT NOT NULL,
    INDEX idx_prompt_hash (prompt_hash),
    FULLTEXT idx_prompt_text (prompt_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Storage**: 67.64 MB for 60,030 unique prompts

---

#### 2. `negative_prompts`
Deduplicated negative prompts with hash-based lookups.

```sql
CREATE TABLE negative_prompts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prompt_hash VARCHAR(64) UNIQUE NOT NULL,
    prompt_text TEXT NOT NULL,
    INDEX idx_prompt_hash (prompt_hash),
    FULLTEXT idx_prompt_text (prompt_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Storage**: 3.16 MB for 5,948 unique prompts (87.8% deduplication rate)

---

#### 3. `prompt_combinations`
Links positive and negative prompts with deduplication.

```sql
CREATE TABLE prompt_combinations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    positive_prompt_id INT NOT NULL,
    negative_prompt_id INT,
    combination_hash VARCHAR(64) UNIQUE NOT NULL,
    FOREIGN KEY (positive_prompt_id) REFERENCES positive_prompts(id) ON DELETE CASCADE,
    FOREIGN KEY (negative_prompt_id) REFERENCES negative_prompts(id) ON DELETE CASCADE,
    INDEX idx_positive_prompt_id (positive_prompt_id),
    INDEX idx_negative_prompt_id (negative_prompt_id),
    INDEX idx_combination_hash (combination_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Storage**: 18.09 MB for 60,467 combinations

---

#### 4. `titles`
Deduplicated image titles.

```sql
CREATE TABLE titles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title_hash VARCHAR(64) UNIQUE NOT NULL,
    title_text TEXT NOT NULL,
    INDEX idx_title_hash (title_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Storage**: 32.09 MB for 54,112 unique titles (47.6% deduplication)

---

#### 5. `art_styles`
Registry of art styles with their style strings.

```sql
CREATE TABLE art_styles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    style_string TEXT,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Storage**: 0.09 MB for 84 unique styles

---

#### 6. `images`
Core table with image metadata and foreign key references.

```sql
CREATE TABLE images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    prompt_combination_id INT,
    art_style_id INT,
    title_id INT,
    seed VARCHAR(50),
    date_downloaded DATE,
    deleted TINYINT(1) DEFAULT 0,
    tags TEXT,
    FOREIGN KEY (prompt_combination_id) REFERENCES prompt_combinations(id) ON DELETE SET NULL,
    FOREIGN KEY (art_style_id) REFERENCES art_styles(id) ON DELETE SET NULL,
    FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE SET NULL,
    INDEX idx_filename (filename),
    INDEX idx_deleted (deleted),
    INDEX idx_date_downloaded (date_downloaded),
    INDEX idx_prompt_combination_id (prompt_combination_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Storage**: 54.25 MB for 109,998 images

---

#### 7. `tags`
Tag names for the many-to-many tagging system.

```sql
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### 8. `image_tags` (Junction Table)
Many-to-many relationship between images and tags.

```sql
CREATE TABLE image_tags (
    image_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (image_id, tag_id),
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    INDEX idx_tag_id (tag_id),
    INDEX idx_image_id (image_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Behavior**: Tags automatically apply to all images with same prompt_combination_id

---

#### 9. `tokens`
Word frequency analysis for prompts.

```sql
CREATE TABLE tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    positive_prompt_count INT DEFAULT 0,
    negative_prompt_count INT DEFAULT 0,
    INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Storage**: 54.19 MB for 186,499 unique tokens

---

## Storage Summary

**Total database size: 228.51 MB**

| Table                 | Size     | Rows    |
|-----------------------|----------|---------|
| positive_prompts      | 67.64 MB | 60,030  |
| images                | 54.25 MB | 109,998 |
| tokens                | 54.19 MB | 186,499 |
| titles                | 32.09 MB | 54,112  |
| prompt_combinations   | 18.09 MB | 60,467  |
| negative_prompts      | 3.16 MB  | 5,948   |
| art_styles            | 0.09 MB  | 84      |

## Usage

```bash
python migrate_to_db.py
```

The script automatically:
- Connects to localhost MySQL as root
- Creates database 'perchance_gallery'
- Migrates from data/results.json, data/style_prompts.json, data/tokens.json
- Takes ~3 minutes for 110K images
