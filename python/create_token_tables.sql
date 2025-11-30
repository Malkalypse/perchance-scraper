-- Drop old tokens table
DROP TABLE IF EXISTS tokens;

-- Create new tokens table (just id and text)
CREATE TABLE tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token TEXT NOT NULL,
    hash VARCHAR(64) NOT NULL UNIQUE,
    INDEX idx_hash (hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create positive_prompt_tokens junction table
CREATE TABLE positive_prompt_tokens (
    positive_prompt_id INT NOT NULL,
    token_id INT NOT NULL,
    PRIMARY KEY (positive_prompt_id, token_id),
    FOREIGN KEY (positive_prompt_id) REFERENCES positive_prompts(id) ON DELETE CASCADE,
    FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE,
    INDEX idx_prompt (positive_prompt_id),
    INDEX idx_token (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create negative_prompt_tokens junction table
CREATE TABLE negative_prompt_tokens (
    negative_prompt_id INT NOT NULL,
    token_id INT NOT NULL,
    PRIMARY KEY (negative_prompt_id, token_id),
    FOREIGN KEY (negative_prompt_id) REFERENCES negative_prompts(id) ON DELETE CASCADE,
    FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE,
    INDEX idx_prompt (negative_prompt_id),
    INDEX idx_token (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
