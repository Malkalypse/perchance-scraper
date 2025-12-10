<?php

/**
 * Collections List API Endpoint
 *
 * Returns list of all collections with their IDs and titles.
 */

require_once __DIR__ . '/utils/db_utils.php';

try {
  $db = getDbConnection();

  // Get all collections ordered by title
  $sql    = "SELECT id, title, created_at FROM collections ORDER BY title ASC";
  $result = $db->query( $sql );

  if ( !$result ) {
    sendErrorResponse( 'Failed to fetch collections: ' . $db->error, 500 );
  }

  $collections = [];
  while ( $row = $result->fetch_assoc() ) {
    $collections[] = $row;
  }

  $db->close();

  // Success response
  header( 'Content-Type: application/json' );
  echo json_encode( $collections );

} catch ( Exception $e ) {
  sendErrorResponse( 'Database error: ' . $e->getMessage(), 500 );
}
