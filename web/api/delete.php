<?php
/**
 * Delete Images API Endpoint
 * 
 * Marks images as deleted in the database and removes physical files.
 * Expects JSON input with 'filenames' array.
 * Token relationships are automatically cleaned up via CASCADE foreign keys.
 */

require_once __DIR__ . '/utils/db_utils.php';

// Get and validate POST data
$data = json_decode( file_get_contents( 'php://input' ), true );
$filenames = $data['filenames'] ?? [];

if( empty( $filenames ) ) {
    sendErrorResponse( 'No filenames provided' );
}

try {
    $db = getDbConnection();
    
    // Delete physical image files from filesystem
    foreach( $filenames as $filename ) {
        $imagePath = __DIR__ . '/../../images/medium/' . basename( $filename );
        if( file_exists( $imagePath ) ) {
            unlink( $imagePath );
        }
    }
    
    // Mark images as deleted and nullify all metadata columns in database
    // This preserves the record while removing all associated data
    $placeholders = implode( ',', array_fill( 0, count( $filenames ), '?' ) );
    $stmt = $db->prepare( "UPDATE images SET deleted = 1, prompt_combination_id = NULL, art_style_id = NULL, title_id = NULL, seed = NULL, date_downloaded = NULL, tags = NULL WHERE filename IN ($placeholders)" );
    
    if( !$stmt ) {
        $db->close();
        sendErrorResponse( 'Failed to prepare delete statement: ' . $db->error, 500 );
    }
    
    // Bind parameters dynamically (all strings)
    $types = str_repeat( 's', count( $filenames ) );
    $stmt->bind_param( $types, ...$filenames );
    
    if( !$stmt->execute() ) {
        $stmt->close();
        $db->close();
        sendErrorResponse( 'Failed to mark images as deleted: ' . $stmt->error, 500 );
    }
    
    $stmt->close();
    $db->close();
    
    // Update cache asynchronously (fast MAX queries)
    updateTableCountsCache();
    
    sendJsonResponse( [
        'success' => true,
        'deleted_count' => count( $filenames )
    ] );
    
} catch( Exception $e ) {
    error_log( "Error deleting images: " . $e->getMessage() );
    sendErrorResponse( 'Failed to delete images: ' . $e->getMessage(), 500 );
}

