<?php
// delete.php
ini_set( 'memory_limit', '1024M' ); // Increase memory limit for this script
header( 'Content-Type: application/json' );

$data = json_decode( file_get_contents( 'php://input' ), true );
$filenames = $data['filenames'] ?? [];

if( empty( $filenames ) ) {
    echo json_encode( ['success' => false, 'error' => 'No filenames provided'] );
    exit;
}

// Delete image files
foreach( $filenames as $filename ) {
    $imagePath = __DIR__ . '/images/medium/' . basename( $filename );
    if( file_exists( $imagePath ) ) {
        unlink( $imagePath );
    }
}

// Update JSON file
$jsonPath = __DIR__ . '/data/results.json';
$results = json_decode( file_get_contents( $jsonPath ), true );

if( $results === null ) {
    echo json_encode( ['success' => false, 'error' => 'Failed to read JSON file'] );
    exit;
}

foreach( $results as &$item ) {
    if( isset( $item['filename'] ) && in_array( $item['filename'], $filenames ) ) {
        // Clear metadata but keep filename
        $item = ["filename" => $item['filename']];
    }
}
unset( $item );

file_put_contents( $jsonPath, json_encode( $results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ) );

echo json_encode( ['success' => true] );