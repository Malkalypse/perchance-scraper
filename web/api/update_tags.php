<?php
/**
 * Update Tags API Endpoint
 * 
 * Updates tags for an image and all images sharing the same prompt combination.
 * Expects JSON input with 'filename' and 'tags' (comma-separated string).
 */

require_once __DIR__ . '/utils/db_utils.php';

// Get and validate POST data
$input = json_decode( file_get_contents( 'php://input' ), true );

if( !isset( $input['filename'] ) || !isset( $input['tags'] ) ) {
    sendErrorResponse( 'Missing filename or tags' );
}

$filename = $input['filename'];
$tagsString = trim( $input['tags'] );

// Parse and normalize tags (comma-separated)
$tagNames = [];
if( !empty( $tagsString ) ) {
    $tagNames = array_map( 'trim', explode( ',', $tagsString ) );
    $tagNames = array_filter( $tagNames ); // Remove empty strings
    $tagNames = array_unique( $tagNames ); // Remove duplicates
}

try {
    $db = getDbConnection();
    
    // Get image and its prompt_combination_id
    $stmt = $db->prepare( "SELECT id, prompt_combination_id FROM images WHERE filename = ?" );
    $stmt->bind_param( 's', $filename );
    $stmt->execute();
    $result = $stmt->get_result();
    $image = $result->fetch_assoc();
    
    if( !$image ) {
        $db->close();
        sendErrorResponse( 'Image not found', 404 );
    }
    
    $imageId = $image['id'];
    $promptCombinationId = $image['prompt_combination_id'];
    
    // Get all image IDs with the same prompt_combination_id
    // This allows updating tags for all images generated with the same prompts
    $imageIds = [];
    if( $promptCombinationId !== null ) {
        $stmt = $db->prepare( "SELECT id FROM images WHERE prompt_combination_id = ? AND deleted = 0" );
        $stmt->bind_param( 'i', $promptCombinationId );
        $stmt->execute();
        $result = $stmt->get_result();
        while( $row = $result->fetch_assoc() ) {
            $imageIds[] = $row['id'];
        }
    } else {
        // If no prompt_combination_id, only update this single image
        $imageIds[] = $imageId;
    }
    
    // Start transaction for atomic update
    $db->begin_transaction();
    
    // Delete existing tags for all affected images
    $placeholders = implode( ',', array_fill( 0, count( $imageIds ), '?' ) );
    $stmt = $db->prepare( "DELETE FROM image_tags WHERE image_id IN ($placeholders)" );
    $stmt->bind_param( str_repeat( 'i', count( $imageIds ) ), ...$imageIds );
    $stmt->execute();
    
    // Insert new tags
    $tagIds = [];
    foreach( $tagNames as $tagName ) {
        $tagId = getOrCreateTag( $db, $tagName );
        $tagIds[] = $tagId;
        
        // Link tag to all affected images
        foreach( $imageIds as $imgId ) {
            $stmt = $db->prepare( "INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)" );
            $stmt->bind_param( 'ii', $imgId, $tagId );
            $stmt->execute();
        }
    }
    
    $db->commit();
    $db->close();
    
    // Update cache asynchronously (fast MAX queries)
    updateTableCountsCache();
    
    sendJsonResponse( [
        'success' => true,
        'tag_count' => count( $tagIds ),
        'images_affected' => count( $imageIds )
    ] );
    
} catch( Exception $e ) {
    if( isset( $db ) ) {
        $db->rollback();
        $db->close();
    }
    error_log( "Error updating tags: " . $e->getMessage() );
    sendErrorResponse( 'Failed to update tags: ' . $e->getMessage(), 500 );
}

