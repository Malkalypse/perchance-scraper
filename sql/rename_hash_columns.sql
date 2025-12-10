-- Migration script to rename hash columns from descriptive names to simply 'hash'
-- Run this script to update existing database tables

USE perchance_gallery;

-- Rename prompt_hash to hash in positive_prompts
ALTER TABLE positive_prompts CHANGE prompt_hash hash VARCHAR(64) UNIQUE NOT NULL;

-- Rename prompt_hash to hash in negative_prompts
ALTER TABLE negative_prompts CHANGE prompt_hash hash VARCHAR(64) UNIQUE NOT NULL;

-- Rename combination_hash to hash in prompt_combinations
ALTER TABLE prompt_combinations CHANGE combination_hash hash VARCHAR(64) UNIQUE NOT NULL;

-- Rename title_hash to hash in titles
ALTER TABLE titles CHANGE title_hash hash VARCHAR(64) UNIQUE NOT NULL;

-- Rename token_hash to hash in tokens
ALTER TABLE tokens CHANGE token_hash hash VARCHAR(64) NOT NULL UNIQUE;
