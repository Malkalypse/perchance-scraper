<?php
/**
 * Database Utility Functions
 * 
 * Shared database operations and helpers to reduce code duplication
 * across API endpoints.
 */

/**
 * Create and return a database connection
 * 
 * @return mysqli Database connection object
 * @throws Exception if connection fails
 */
function getDbConnection() {
    $db = new mysqli( 'localhost', 'root', '', 'perchance_gallery' );
    
    if( $db->connect_error ) {
        throw new Exception( 'Database connection failed: ' . $db->connect_error );
    }
    
    $db->set_charset( 'utf8mb4' );
    return $db;
}

/**
 * Update the table counts cache using fast MAX(id) queries
 * 
 * This function is called after operations that modify table data
 * (deletions, tag updates, etc.) to keep the cached counts current.
 * 
 * @return bool True on success, false on failure
 */
function updateTableCountsCache() {
    $cacheFile = __DIR__ . '/../table_counts.json';
    
    try {
        $db = getDbConnection();
        $counts = [];
        
        // Use MAX(id) for instant counts (works because we have no gaps except in tags)
        $tables = [
            'art-styles' => 'art_styles',
            'positive-prompts' => 'positive_prompts',
            'negative-prompts' => 'negative_prompts',
            'tags' => 'tags',
            'tokens' => 'tokens'
        ];
        
        foreach( $tables as $key => $table ) {
            $result = $db->query( "SELECT MAX(id) as count FROM $table" );
            $counts[$key] = (int)($result->fetch_assoc()['count'] ?? 0);
        }
        
        $db->close();
        
        // Write to cache file with pretty formatting
        file_put_contents( $cacheFile, json_encode( $counts, JSON_PRETTY_PRINT ) );
        
        return true;
        
    } catch( Exception $e ) {
        error_log( "Failed to update table counts cache: " . $e->getMessage() );
        return false;
    }
}

/**
 * Get or create a tag by name
 * 
 * Checks if a tag exists first to avoid auto-increment gaps.
 * 
 * @param mysqli $db Database connection
 * @param string $tagName Name of the tag
 * @return int Tag ID
 */
function getOrCreateTag( $db, $tagName ) {
    // Check if tag exists first
    $stmt = $db->prepare( "SELECT id FROM tags WHERE name = ?" );
    $stmt->bind_param( 's', $tagName );
    $stmt->execute();
    $result = $stmt->get_result();
    $existingTag = $result->fetch_assoc();
    
    if( $existingTag ) {
        return $existingTag['id'];
    }
    
    // Create new tag
    $stmt = $db->prepare( "INSERT INTO tags (name) VALUES (?)" );
    $stmt->bind_param( 's', $tagName );
    $stmt->execute();
    return $db->insert_id;
}

/**
 * Send JSON response and exit
 * 
 * @param array $data Data to send as JSON
 * @param int $httpCode HTTP status code (default 200)
 */
function sendJsonResponse( $data, $httpCode = 200 ) {
    http_response_code( $httpCode );
    header( 'Content-Type: application/json' );
    echo json_encode( $data );
    exit;
}

/**
 * Send error response and exit
 * 
 * @param string $message Error message
 * @param int $httpCode HTTP status code (default 400)
 */
function sendErrorResponse( $message, $httpCode = 400 ) {
    sendJsonResponse( ['success' => false, 'error' => $message], $httpCode );
}
