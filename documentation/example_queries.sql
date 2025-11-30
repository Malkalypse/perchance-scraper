-- Example SQL Queries for Normalized Database
-- Use these in phpMyAdmin or PHP scripts
-- Updated for the current 9-table schema with prompt_combinations

-- ============================================================
-- BASIC QUERIES
-- ============================================================

-- Get all images with their prompts, styles, and tags
SELECT 
    i.filename,
    t.title_text as title,
    pp.prompt_text as prompt,
    np.prompt_text as negative_prompt,
    a.name as art_style,
    i.seed,
    i.date_downloaded,
    GROUP_CONCAT(DISTINCT tag.name ORDER BY tag.name ASC SEPARATOR ',') as tags
FROM images i
LEFT JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
LEFT JOIN negative_prompts np ON pc.negative_prompt_id = np.id
LEFT JOIN art_styles a ON i.art_style_id = a.id
LEFT JOIN titles t ON i.title_id = t.id
LEFT JOIN image_tags it ON i.id = it.image_id
LEFT JOIN tags tag ON it.tag_id = tag.id
WHERE i.deleted = 0
GROUP BY i.id
ORDER BY i.date_downloaded DESC
LIMIT 100;

-- ============================================================
-- FILTERING
-- ============================================================

-- Get all cinematic images
SELECT 
    i.filename,
    pp.prompt_text,
    i.date_downloaded
FROM images i
JOIN art_styles a ON i.art_style_id = a.id
JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
WHERE a.name = 'cinematic' 
  AND i.deleted = 0
ORDER BY i.date_downloaded DESC;

-- Get images from date range
SELECT 
    i.filename,
    pp.prompt_text,
    a.name as art_style
FROM images i
LEFT JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE i.date_downloaded BETWEEN '2025-11-01' AND '2025-11-30'
  AND i.deleted = 0
ORDER BY i.date_downloaded DESC;

-- Get images with specific seed
SELECT 
    i.filename,
    p.prompt_text,
    a.name as art_style,
    i.seed
FROM images i
LEFT JOIN prompts p ON i.prompt_id = p.id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE i.seed = '12345';

-- ============================================================
-- SEARCH
-- ============================================================

-- Full-text search prompts (fastest for text search)
SELECT 
    p.prompt_text,
    a.name as art_style,
    i.filename,
    MATCH(p.prompt_text) AGAINST('castle fantasy' IN NATURAL LANGUAGE MODE) as relevance
FROM prompts p
JOIN images i ON p.id = i.prompt_id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE MATCH(p.prompt_text) AGAINST('castle fantasy' IN NATURAL LANGUAGE MODE)
  AND i.deleted = 0
ORDER BY relevance DESC
LIMIT 50;

-- Boolean full-text search (AND/OR/NOT operators)
SELECT 
    p.prompt_text,
    a.name as art_style,
    i.filename
FROM prompts p
JOIN images i ON p.id = i.prompt_id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE MATCH(p.prompt_text) AGAINST('+anime +girl -chibi' IN BOOLEAN MODE)
  AND i.deleted = 0
LIMIT 50;

-- Search by title
SELECT 
    i.filename,
    i.title,
    p.prompt_text,
    a.name as art_style
FROM images i
LEFT JOIN prompts p ON i.prompt_id = p.id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE i.title LIKE '%castle%'
  AND i.deleted = 0;

-- ============================================================
-- STATISTICS
-- ============================================================

-- Count images per art style
SELECT 
    a.name as art_style,
    a.usage_count,
    COUNT(i.id) as actual_count
FROM art_styles a
LEFT JOIN images i ON a.id = i.art_style_id AND i.deleted = 0
GROUP BY a.id, a.name, a.usage_count
ORDER BY a.usage_count DESC;

-- Most popular prompts
SELECT 
    p.prompt_text,
    p.usage_count,
    COUNT(i.id) as image_count
FROM prompts p
LEFT JOIN images i ON p.id = i.prompt_id AND i.deleted = 0
GROUP BY p.id
ORDER BY p.usage_count DESC
LIMIT 20;

-- Images per date
SELECT 
    DATE(i.date_downloaded) as date,
    COUNT(*) as image_count
FROM images i
WHERE i.deleted = 0
  AND i.date_downloaded IS NOT NULL
GROUP BY DATE(i.date_downloaded)
ORDER BY date DESC;

-- Style usage over time
SELECT 
    a.name as art_style,
    DATE_FORMAT(i.date_downloaded, '%Y-%m') as month,
    COUNT(*) as count
FROM images i
JOIN art_styles a ON i.art_style_id = a.id
WHERE i.deleted = 0
  AND i.date_downloaded IS NOT NULL
GROUP BY a.name, month
ORDER BY month DESC, count DESC;

-- ============================================================
-- GROUPS
-- ============================================================

-- Get all groups with image counts
SELECT 
    pg.id,
    p.prompt_text,
    a.name as art_style,
    pg.image_count,
    COUNT(gi.image_id) as actual_count
FROM prompt_groups pg
JOIN prompts p ON pg.prompt_id = p.id
LEFT JOIN art_styles a ON pg.art_style_id = a.id
LEFT JOIN group_images gi ON pg.id = gi.group_id
GROUP BY pg.id
ORDER BY pg.image_count DESC
LIMIT 100;

-- Get images in a specific group
SELECT 
    i.filename,
    p.prompt_text,
    a.name as art_style
FROM group_images gi
JOIN images i ON gi.image_id = i.id
LEFT JOIN prompts p ON i.prompt_id = p.id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE gi.group_id = 1
ORDER BY i.filename;

-- Find groups with similar prompts
SELECT 
    pg.id,
    p.prompt_text,
    pg.image_count
FROM prompt_groups pg
JOIN prompts p ON pg.prompt_id = p.id
WHERE p.prompt_text LIKE '%fantasy%'
ORDER BY pg.image_count DESC
LIMIT 20;

-- ============================================================
-- TOKENS
-- ============================================================

-- Top 100 most common tokens
SELECT 
    token,
    total_count,
    prompt_count,
    negative_prompt_count
FROM tokens
ORDER BY total_count DESC
LIMIT 100;

-- Tokens used mostly in negative prompts
SELECT 
    token,
    negative_prompt_count,
    prompt_count,
    total_count
FROM tokens
WHERE negative_prompt_count > prompt_count
ORDER BY negative_prompt_count DESC
LIMIT 50;

-- Tokens appearing in both prompts and negative prompts
SELECT 
    token,
    prompt_count,
    negative_prompt_count,
    total_count
FROM tokens
WHERE prompt_count > 0 
  AND negative_prompt_count > 0
ORDER BY total_count DESC
LIMIT 50;

-- ============================================================
-- RELATED IMAGES
-- ============================================================

-- Find all images with the same prompt (variations)
SELECT 
    i.filename,
    i.seed,
    a.name as art_style,
    i.date_downloaded
FROM images i
JOIN prompts p ON i.prompt_id = p.id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE p.id = (
    SELECT prompt_id 
    FROM images 
    WHERE filename = 'abc123.jpg'
)
AND i.deleted = 0
ORDER BY i.date_downloaded;

-- Find images with similar style but different prompts
SELECT 
    i.filename,
    p.prompt_text,
    i.seed
FROM images i
JOIN art_styles a ON i.art_style_id = a.id
JOIN prompts p ON i.prompt_id = p.id
WHERE a.id = (
    SELECT art_style_id 
    FROM images 
    WHERE filename = 'abc123.jpg'
)
AND i.deleted = 0
ORDER BY RAND()
LIMIT 20;

-- ============================================================
-- UPDATES
-- ============================================================

-- Update a prompt (affects all images using it)
UPDATE prompts 
SET prompt_text = 'New improved prompt text'
WHERE id = 1;

-- Update art style name
UPDATE art_styles 
SET name = 'cinematic_photo'
WHERE name = 'cinematic';

-- Soft delete an image
UPDATE images 
SET deleted = 1
WHERE filename = 'abc123.jpg';

-- Restore deleted image
UPDATE images 
SET deleted = 0
WHERE filename = 'abc123.jpg';

-- Update image tags
UPDATE images 
SET tags = 'favorite, portfolio, featured'
WHERE filename = 'abc123.jpg';

-- ============================================================
-- DELETES (use with caution!)
-- ============================================================

-- Hard delete image (CASCADE removes from groups automatically)
DELETE FROM images 
WHERE filename = 'abc123.jpg';

-- Delete all images with a specific prompt
DELETE FROM images 
WHERE prompt_id = (
    SELECT id FROM prompts 
    WHERE prompt_text LIKE '%unwanted content%'
);

-- Delete unused prompts (no images reference them)
DELETE FROM prompts 
WHERE usage_count = 0;

-- Delete unused art styles
DELETE FROM art_styles 
WHERE usage_count = 0 
  AND id NOT IN (SELECT DISTINCT art_style_id FROM images WHERE art_style_id IS NOT NULL);

-- ============================================================
-- MAINTENANCE
-- ============================================================

-- Update usage counts (run periodically)
UPDATE prompts p 
SET usage_count = (
    SELECT COUNT(*) 
    FROM images i 
    WHERE i.prompt_id = p.id
);

UPDATE art_styles a 
SET usage_count = (
    SELECT COUNT(*) 
    FROM images i 
    WHERE i.art_style_id = a.id
);

-- Find orphaned images (missing prompts/styles)
SELECT 
    i.filename,
    i.prompt_id,
    i.art_style_id
FROM images i
WHERE (i.prompt_id IS NOT NULL AND i.prompt_id NOT IN (SELECT id FROM prompts))
   OR (i.art_style_id IS NOT NULL AND i.art_style_id NOT IN (SELECT id FROM art_styles));

-- Fix image counts in prompt_groups
UPDATE prompt_groups pg
SET image_count = (
    SELECT COUNT(*) 
    FROM group_images gi 
    WHERE gi.group_id = pg.id
);

-- ============================================================
-- ADVANCED QUERIES
-- ============================================================

-- Find duplicate images (same prompt + seed + style)
SELECT 
    p.prompt_text,
    a.name as art_style,
    i.seed,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(i.filename SEPARATOR ', ') as files
FROM images i
LEFT JOIN prompts p ON i.prompt_id = p.id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE i.deleted = 0
GROUP BY i.prompt_id, i.art_style_id, i.seed
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Images per style with percentage
SELECT 
    a.name as art_style,
    COUNT(i.id) as count,
    ROUND(COUNT(i.id) * 100.0 / (SELECT COUNT(*) FROM images WHERE deleted = 0), 2) as percentage
FROM art_styles a
LEFT JOIN images i ON a.id = i.art_style_id AND i.deleted = 0
GROUP BY a.id, a.name
ORDER BY count DESC;

-- Prompt length distribution
SELECT 
    CASE 
        WHEN LENGTH(prompt_text) < 100 THEN 'Short (<100)'
        WHEN LENGTH(prompt_text) < 500 THEN 'Medium (100-500)'
        WHEN LENGTH(prompt_text) < 1000 THEN 'Long (500-1000)'
        ELSE 'Very Long (1000+)'
    END as length_category,
    COUNT(*) as count,
    AVG(usage_count) as avg_usage
FROM prompts
GROUP BY length_category
ORDER BY avg_usage DESC;

-- Find images not in any group
SELECT 
    i.filename,
    p.prompt_text,
    a.name as art_style
FROM images i
LEFT JOIN group_images gi ON i.id = gi.image_id
LEFT JOIN prompts p ON i.prompt_id = p.id
LEFT JOIN art_styles a ON i.art_style_id = a.id
WHERE gi.id IS NULL
  AND i.deleted = 0
LIMIT 100;
