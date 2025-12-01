<?php
/**
 * Table Counts API Endpoint
 * 
 * Returns cached table row counts from JSON file.
 * The cache is updated by update_table_counts.py and by various API endpoints
 * after data modifications (using MAX(id) for instant queries).
 * 
 * Response format: {"art-styles": 80, "positive-prompts": 73151, ...}
 */

require_once __DIR__ . '/utils/db_utils.php';

$cacheFile = __DIR__ . '/table_counts.json';

// Check if cache file exists
if( !file_exists( $cacheFile ) ) {
    sendErrorResponse( 'Table counts cache not found. Run python/update_table_counts.py to generate it.', 404 );
}

// Read and return cached counts
$counts = file_get_contents( $cacheFile );
if( $counts === false ) {
    sendErrorResponse( 'Failed to read table counts cache', 500 );
}

// Return raw JSON (already formatted)
header( 'Content-Type: application/json' );
echo $counts;

