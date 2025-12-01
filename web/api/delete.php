<?php
// delete.php
header( 'Content-Type: application/json' );

$data = json_decode( file_get_contents( 'php://input' ), true );
$filenames = $data['filenames'] ?? [];

if( empty( $filenames ) ) {
    echo json_encode( ['success' => false, 'error' => 'No filenames provided'] );
    exit;
}

// Database connection
$db = new mysqli( 'localhost', 'root', '', 'perchance_gallery' );

if( $db->connect_error ) {
    echo json_encode( ['success' => false, 'error' => 'Database connection failed: ' . $db->connect_error] );
    exit;
}

$db->set_charset( 'utf8mb4' );

// Note: Token relationships are automatically cleaned up via CASCADE foreign keys
// when images are deleted (images -> prompt_combinations -> token relationships)

// Delete image files
foreach( $filenames as $filename ) {
    $imagePath = __DIR__ . '/../../images/medium/' . basename( $filename );
    if( file_exists( $imagePath ) ) {
        unlink( $imagePath );
    }
}

// Mark images as deleted and nullify all metadata columns
$placeholders = implode( ',', array_fill( 0, count( $filenames ), '?' ) );
$stmt = $db->prepare( "UPDATE images SET deleted = 1, prompt_combination_id = NULL, art_style_id = NULL, title_id = NULL, seed = NULL, date_downloaded = NULL, tags = NULL WHERE filename IN ($placeholders)" );

if( !$stmt ) {
    echo json_encode( ['success' => false, 'error' => 'Prepare failed: ' . $db->error] );
    exit;
}

// Bind parameters dynamically
$types = str_repeat( 's', count( $filenames ) );
$stmt->bind_param( $types, ...$filenames );

if( !$stmt->execute() ) {
    echo json_encode( ['success' => false, 'error' => 'Execute failed: ' . $stmt->error] );
    exit;
}

$stmt->close();
$db->close();

// Update table counts cache
updateTableCountsCache();

echo json_encode( ['success' => true] );

/**
 * Update the table counts cache after images are deleted
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
        
        // Art Styles count
        $result = $db->query( "SELECT COUNT(DISTINCT ast.id) as count FROM art_styles ast LEFT JOIN images i ON i.art_style_id = ast.id WHERE i.id IS NOT NULL" );
        $counts['art-styles'] = (int)$result->fetch_assoc()['count'];
        
        // Positive Prompts count
        $result = $db->query( "SELECT COUNT(DISTINCT pp.id) as count FROM positive_prompts pp LEFT JOIN prompt_combinations pc ON pc.positive_prompt_id = pp.id LEFT JOIN images i ON i.prompt_combination_id = pc.id WHERE i.id IS NOT NULL" );
        $counts['positive-prompts'] = (int)$result->fetch_assoc()['count'];
        
        // Negative Prompts count
        $result = $db->query( "SELECT COUNT(DISTINCT np.id) as count FROM negative_prompts np LEFT JOIN prompt_combinations pc ON pc.negative_prompt_id = np.id LEFT JOIN images i ON i.prompt_combination_id = pc.id WHERE i.id IS NOT NULL" );
        $counts['negative-prompts'] = (int)$result->fetch_assoc()['count'];
        
        // Tags count
        $result = $db->query( "SELECT COUNT(DISTINCT t.id) as count FROM tags t LEFT JOIN image_tags it ON it.tag_id = t.id WHERE it.image_id IS NOT NULL" );
        $counts['tags'] = (int)$result->fetch_assoc()['count'];
        
        // Tokens count
        $result = $db->query( "SELECT COUNT(DISTINCT t.id) as count FROM tokens t LEFT JOIN positive_prompt_tokens ppt ON ppt.token_id = t.id LEFT JOIN negative_prompt_tokens npt ON npt.token_id = t.id WHERE ppt.positive_prompt_id IS NOT NULL OR npt.negative_prompt_id IS NOT NULL" );
        $counts['tokens'] = (int)$result->fetch_assoc()['count'];
        
        $db->close();
        
        // Write to cache file
        file_put_contents( $cacheFile, json_encode( $counts, JSON_PRETTY_PRINT ) );
        
    } catch( Exception $e ) {
        error_log( "Failed to update table counts cache: " . $e->getMessage() );
    }
}
