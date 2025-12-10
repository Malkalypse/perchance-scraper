<?php

/**
* Add to Collection API Endpoint
*
* Adds images to a collection. Creates the collection if it doesn't exist.
* If no title provided, creates a collection named "Collection <id>".
*
* Expects JSON input:
* - filenames: array of image filenames
* - collectionTitle: string (optional) - name of collection
*/

require_once __DIR__ . '/utils/db_utils.php';

// Get and validate POST data
$data = json_decode( file_get_contents( 'php://input' ), true );
$filenames = $data['filenames'] ?? [];
$collectionTitle = trim( $data['collectionTitle'] ?? '' );

if ( empty( $filenames ) ) {
  sendErrorResponse( 'No filenames provided' );
}

try {
  $db = getDbConnection();

  // Start transaction
  $db->begin_transaction();

  // Determine or create collection
  $collectionId = null;

  if ( $collectionTitle !== '' ) {
    // Check if collection with this title exists
    $stmt = $db->prepare( "SELECT id FROM collections WHERE title = ?" );
    $stmt->bind_param( 's', $collectionTitle );
    $stmt->execute();
    $result = $stmt->get_result();

    if ( $result->num_rows > 0 ) {
      // Collection exists, use its ID
      $row = $result->fetch_assoc();
      $collectionId = $row['id'];
    } else {
      // Create new collection with provided title
      $stmt = $db->prepare( "INSERT INTO collections (title) VALUES (?)" );
      $stmt->bind_param( 's', $collectionTitle );
      $stmt->execute();
      $collectionId = $db->insert_id;
    }
    $stmt->close();
  } else {
    // No title provided - create collection with auto-generated name
    $db->query( "INSERT INTO collections (title) VALUES ('temp')" );
    $collectionId = $db->insert_id;
    $autoTitle    = "Collection $collectionId";

    // Update with proper title
    $stmt = $db->prepare( "UPDATE collections SET title = ? WHERE id = ?" );
    $stmt->bind_param( 'si', $autoTitle, $collectionId );
    $stmt->execute();
    $stmt->close();
  }

  // Get image IDs from filenames
  $placeholders = implode( ',', array_fill( 0, count( $filenames ), '?' ) );
  $stmt = $db->prepare( "SELECT id, filename FROM images WHERE filename IN ($placeholders)" );
  $types = str_repeat( 's', count( $filenames ) );
  $stmt->bind_param( $types, ...$filenames );
  $stmt->execute();
  $result = $stmt->get_result();

  $imageIds = [];
  while ( $row = $result->fetch_assoc() ) {
    $imageIds[] = $row['id'];
  }
  $stmt->close();

  if ( empty( $imageIds ) ) {
    $db->rollback();
    $db->close();
    sendErrorResponse( 'No valid images found' );
  }

  // Insert into image_collections (ignore duplicates)
  $addedCount = 0;
  $stmt       = $db->prepare( "INSERT IGNORE INTO image_collections (image_id, collection_id) VALUES (?, ?)" );

  foreach ( $imageIds as $imageId ) {
    $stmt->bind_param( 'ii', $imageId, $collectionId );
    $stmt->execute();
    $addedCount += $stmt->affected_rows;
  }

  $stmt->close();

  // Commit transaction
  $db->commit();
  $db->close();

  // Get collection title for response
  $finalTitle = $collectionTitle !== '' ? $collectionTitle : "Collection $collectionId";

  // Success response
  header( 'Content-Type: application/json' );
  echo json_encode( [
    'success' => true,
    'collectionId' => $collectionId,
    'collectionTitle' => $finalTitle,
    'imagesAdded' => $addedCount,
    'imageCount' => count( $imageIds )
  ] );
} catch ( Exception $e ) {
  if ( isset( $db ) ) {
    $db->rollback();
    $db->close();
  }
  sendErrorResponse( 'Database error: ' . $e->getMessage(), 500 );
}
