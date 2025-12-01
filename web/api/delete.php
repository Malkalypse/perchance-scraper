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

// Update table counts cache (fast MAX queries)
updateTableCountsCache();

echo json_encode( ['success' => true] );

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
