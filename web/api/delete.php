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

echo json_encode( ['success' => true] );