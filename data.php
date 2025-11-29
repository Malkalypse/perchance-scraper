<?php
// data.php
header( 'Content-Type: application/json' );

$jsonFile = __DIR__ . '/data/results.json';

if( !file_exists( $jsonFile ) ) {
    echo json_encode( ['error' => 'File not found'] );
    exit;
}

// Get parameters
$searchTerm = isset( $_GET['searchTerm'] ) ? $_GET['searchTerm'] : '';
$wholeWords = isset( $_GET['wholeWords'] ) ? $_GET['wholeWords'] === 'true' : false;
$searchLimit = isset( $_GET['searchLimit'] ) && $_GET['searchLimit'] !== '' ? intval( $_GET['searchLimit'] ) : null;
$limit = isset( $_GET['limit'] ) ? intval( $_GET['limit'] ) : 200;
$offset = isset( $_GET['offset'] ) ? intval( $_GET['offset'] ) : 0;

// Read and decode JSON
$json = file_get_contents( $jsonFile );
$data = json_decode( $json, true );

if( $data === null ) {
    echo json_encode( ['error' => 'JSON decode failed'] );
    exit;
}

// Apply search filter if search term provided
if( $searchTerm !== '' ) {
    $filtered = [];
    $count = 0;
    
    foreach( $data as $item ) {
        if( !isset( $item['prompt'] ) || $item['prompt'] === '' ) {
            continue;
        }
        
        $prompt = strtolower( $item['prompt'] );
        $search = strtolower( $searchTerm );
        
        $matches = false;
        if( $wholeWords ) {
            // Whole word search using word boundaries
            $matches = preg_match( '/\b' . preg_quote( $search, '/' ) . '\b/', $prompt );
        } else {
            // Substring search
            $matches = strpos( $prompt, $search ) !== false;
        }
        
        if( $matches ) {
            $filtered[] = $item;
            $count++;
            
            // Apply search limit if specified
            if( $searchLimit !== null && $count >= $searchLimit ) {
                break;
            }
        }
    }
    
    echo json_encode( $filtered );
} else {
    // No search - just paginate
    $subset = array_slice( $data, $offset, $limit );
    echo json_encode( $subset );
}