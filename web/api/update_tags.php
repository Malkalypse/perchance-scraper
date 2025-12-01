<?php
header( 'Content-Type: application/json' );

// Get POST data
$input = json_decode( file_get_contents( 'php://input' ), true );

if( !isset( $input['filename'] ) || !isset( $input['tags'] ) ) {
    echo json_encode( ['success' => false, 'error' => 'Missing filename or tags'] );
    exit;
}

$filename = $input['filename'];
$tagsString = trim( $input['tags'] );

// Parse tags (comma-separated)
$tagNames = [];
if( !empty( $tagsString ) ) {
    $tagNames = array_map( 'trim', explode( ',', $tagsString ) );
    $tagNames = array_filter( $tagNames ); // Remove empty strings
    $tagNames = array_unique( $tagNames ); // Remove duplicates
}

// Connect to database
$db = new mysqli( 'localhost', 'root', '', 'perchance_gallery' );
if( $db->connect_error ) {
    echo json_encode( ['success' => false, 'error' => 'Database connection failed'] );
    exit;
}

$db->set_charset( 'utf8mb4' );

// Get image and its prompt_combination_id
$stmt = $db->prepare( "SELECT id, prompt_combination_id FROM images WHERE filename = ?" );
$stmt->bind_param( 's', $filename );
$stmt->execute();
$result = $stmt->get_result();
$image = $result->fetch_assoc();

if( !$image ) {
    echo json_encode( ['success' => false, 'error' => 'Image not found'] );
    exit;
}

$imageId = $image['id'];
$promptCombinationId = $image['prompt_combination_id'];

// Get all image IDs with the same prompt_combination_id
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

// Start transaction
$db->begin_transaction();

try {
    // Delete existing tags for all images with same prompt_combination_id
    $placeholders = implode( ',', array_fill( 0, count( $imageIds ), '?' ) );
    $stmt = $db->prepare( "DELETE FROM image_tags WHERE image_id IN ($placeholders)" );
    $stmt->bind_param( str_repeat( 'i', count( $imageIds ) ), ...$imageIds );
    $stmt->execute();
    
    // Insert new tags for all images with same prompt_combination_id
    $tagIds = [];
    foreach( $tagNames as $tagName ) {
        // Check if tag exists first
        $stmt = $db->prepare( "SELECT id FROM tags WHERE name = ?" );
        $stmt->bind_param( 's', $tagName );
        $stmt->execute();
        $result = $stmt->get_result();
        $existingTag = $result->fetch_assoc();
        
        if( $existingTag ) {
            // Use existing tag
            $tagId = $existingTag['id'];
        } else {
            // Create new tag
            $stmt = $db->prepare( "INSERT INTO tags (name) VALUES (?)" );
            $stmt->bind_param( 's', $tagName );
            $stmt->execute();
            $tagId = $db->insert_id;
        }
        $tagIds[] = $tagId;
        
        // Link tag to all images with same prompt_combination_id
        foreach( $imageIds as $imgId ) {
            $stmt = $db->prepare( "INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)" );
            $stmt->bind_param( 'ii', $imgId, $tagId );
            $stmt->execute();
        }
    }
    
    $db->commit();
    
    // Update table counts cache (fast MAX queries)
    updateTableCountsCache();
    
    echo json_encode( ['success' => true, 'tag_count' => count( $tagIds ), 'images_affected' => count( $imageIds )] );
    
} catch( Exception $e ) {
    $db->rollback();
    echo json_encode( ['success' => false, 'error' => $e->getMessage()] );
}

$db->close();

/**
 * Update the table counts cache using fast MAX(id) queries
 */
function updateTableCountsCache() {
    $cacheFile = __DIR__ . '/table_counts.json';
    
    try {
        $db = new mysqli( 'localhost', 'root', '', 'perchance_gallery' );
        if( $db->connect_error ) {
            error_log( "Failed to update table counts cache: " . $db->connect_error );
            return;
        }
        
        $db->set_charset( 'utf8mb4' );
        $counts = [];
        
        // Use MAX(id) for instant counts
        $result = $db->query( "SELECT MAX(id) as count FROM art_styles" );
        $counts['art-styles'] = (int)($result->fetch_assoc()['count'] ?? 0);
        
        $result = $db->query( "SELECT MAX(id) as count FROM positive_prompts" );
        $counts['positive-prompts'] = (int)($result->fetch_assoc()['count'] ?? 0);
        
        $result = $db->query( "SELECT MAX(id) as count FROM negative_prompts" );
        $counts['negative-prompts'] = (int)($result->fetch_assoc()['count'] ?? 0);
        
        $result = $db->query( "SELECT MAX(id) as count FROM tags" );
        $counts['tags'] = (int)($result->fetch_assoc()['count'] ?? 0);
        
        $result = $db->query( "SELECT MAX(id) as count FROM tokens" );
        $counts['tokens'] = (int)($result->fetch_assoc()['count'] ?? 0);
        
        $db->close();
        
        file_put_contents( $cacheFile, json_encode( $counts, JSON_PRETTY_PRINT ) );
        
    } catch( Exception $e ) {
        error_log( "Failed to update table counts cache: " . $e->getMessage() );
    }
}
?>
