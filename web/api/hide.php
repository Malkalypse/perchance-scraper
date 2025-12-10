<?php

/**
* Hide/Unhide Images API Endpoint
*
* Toggles the hidden status of images in the database.
* Expects JSON input with 'filenames' array and 'hidden' boolean (true to hide, false to unhide).
*/

require_once __DIR__ . '/utils/db_utils.php';

// Get and validate POST data
$data = json_decode( file_get_contents( 'php://input' ), true );
$filenames = $data['filenames'] ?? [];
$hidden = $data['hidden'] ?? true;

if ( empty( $filenames ) ) {
  sendErrorResponse( 'No filenames provided' );
}

try {
  $db = getDbConnection();

  // Update hidden status for specified images
  $placeholders = implode( ',', array_fill( 0, count( $filenames ), '?' ) );
  $hiddenValue  = $hidden ? 1 : 0;
  $stmt = $db->prepare( "UPDATE images SET hidden = $hiddenValue WHERE filename IN ($placeholders)" );

  if ( !$stmt ) {
    $db->close();
    sendErrorResponse( 'Failed to prepare update statement: ' . $db->error, 500 );
  }

  // Bind parameters dynamically (all strings)
  $types = str_repeat( 's', count( $filenames ) );
  $stmt->bind_param( $types, ...$filenames );

  if ( !$stmt->execute() ) {
    $stmt->close();
    $db->close();
    sendErrorResponse( 'Failed to update hidden status: ' . $stmt->error, 500 );
  }

  $affectedRows = $stmt->affected_rows;
  $stmt->close();
  $db->close();

  // Success response
  header( 'Content-Type: application/json' );
  echo json_encode( [
    'success' => true,
    'count' => $affectedRows,
    'action' => $hidden ? 'hidden' : 'unhidden'
  ] );
} catch ( Exception $e ) {
  sendErrorResponse( 'Database error: ' . $e->getMessage(), 500 );
}
