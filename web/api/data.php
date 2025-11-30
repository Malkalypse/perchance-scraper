<?php
// data.php
header( 'Content-Type: application/json' );

// Database connection
$db = new mysqli( 'localhost', 'root', '', 'perchance_gallery' );

if( $db->connect_error ) {
    echo json_encode( ['error' => 'Database connection failed: ' . $db->connect_error] );
    exit;
}

$db->set_charset( 'utf8mb4' );

// Get parameters
$searchTerm = isset( $_GET['searchTerm'] ) ? $_GET['searchTerm'] : '';
$searchBy = isset( $_GET['searchBy'] ) ? $_GET['searchBy'] : 'prompt';
$wholeWords = isset( $_GET['wholeWords'] ) ? $_GET['wholeWords'] === 'true' : false;
$searchLimit = isset( $_GET['searchLimit'] ) && $_GET['searchLimit'] !== '' ? intval( $_GET['searchLimit'] ) : null;
$limit = isset( $_GET['limit'] ) ? intval( $_GET['limit'] ) : 200;
$offset = isset( $_GET['offset'] ) ? intval( $_GET['offset'] ) : 0;
$sortMode = isset( $_GET['sort'] ) ? $_GET['sort'] : 'recent';

// Build query
$sql = "
    SELECT 
        i.id as image_id,
        i.filename,
        pp.prompt_text as prompt,
        np.prompt_text as negative_prompt,
        a.name as art_style,
        t.title_text as title,
        i.seed,
        i.date_downloaded,
        (SELECT GROUP_CONCAT(DISTINCT t2.name ORDER BY t2.name ASC SEPARATOR ',')
         FROM image_tags it2
         JOIN tags t2 ON it2.tag_id = t2.id
         WHERE it2.image_id = i.id) as tags
    FROM images i
    LEFT JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
    LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
    LEFT JOIN negative_prompts np ON pc.negative_prompt_id = np.id
    LEFT JOIN art_styles a ON i.art_style_id = a.id
    LEFT JOIN titles t ON i.title_id = t.id
    WHERE i.deleted = 0
";

// Add search condition if provided
if( $searchTerm !== '' ) {
    $searchEscaped = $db->real_escape_string( $searchTerm );
    
    if( $searchBy === 'tag' ) {
        // Tag search - check if image has a tag matching the search
        $sql .= " AND EXISTS (
            SELECT 1 FROM image_tags it
            JOIN tags tag ON it.tag_id = tag.id
            WHERE it.image_id = i.id";
        
        if( $wholeWords ) {
            // Whole word search on tag names using REGEXP
            $sql .= " AND tag.name REGEXP '[[:<:]]" . $searchEscaped . "[[:>:]]'";
        } else {
            // Substring search on tag names using LIKE
            $sql .= " AND tag.name LIKE '%" . $searchEscaped . "%'";
        }
        
        $sql .= " )";
    } else {
        // Prompt search (default)
        if( $wholeWords ) {
            // Whole word search using REGEXP
            $sql .= " AND pp.prompt_text REGEXP '[[:<:]]" . $searchEscaped . "[[:>:]]'";
        } else {
            // Substring search using LIKE
            $sql .= " AND pp.prompt_text LIKE '%" . $searchEscaped . "%'";
        }
    }
}

// Order by sort mode
if( $sortMode === 'style' ) {
    $sql .= " GROUP BY i.id";
    $sql .= " ORDER BY CASE WHEN a.name IS NULL THEN 1 ELSE 0 END, a.name ASC, i.id DESC";
    
    // Add pagination
    if( $searchTerm !== '' ) {
        // When searching, only apply limit if searchLimit is explicitly set
        if( $searchLimit !== null ) {
            $sql .= " LIMIT " . intval( $searchLimit );
        }
    } else {
        // Normal browsing uses limit and offset
        $sql .= " LIMIT " . intval( $limit ) . " OFFSET " . intval( $offset );
    }
} else if( $sortMode === 'prompt' ) {
    // For prompt sorting, group by hash to handle duplicates properly
    
    // First, get the distinct hashes for this page
    $groupSql = "
        SELECT pp.hash
        FROM images i
        JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
        LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
        WHERE i.deleted = 0
    ";
    
    if( $searchTerm !== '' ) {
        $searchEscaped = $db->real_escape_string( $searchTerm );
        
        if( $searchBy === 'tag' ) {
            // Tag search - check if image has a tag matching the search
            $groupSql .= " AND EXISTS (
                SELECT 1 FROM image_tags it
                JOIN tags tag ON it.tag_id = tag.id
                WHERE it.image_id = i.id";
            
            if( $wholeWords ) {
                $groupSql .= " AND tag.name REGEXP '[[:<:]]" . $searchEscaped . "[[:>:]]'";
            } else {
                $groupSql .= " AND tag.name LIKE '%" . $searchEscaped . "%'";
            }
            
            $groupSql .= " )";
        } else {
            // Prompt search
            if( $wholeWords ) {
                $groupSql .= " AND pp.prompt_text REGEXP '[[:<:]]" . $searchEscaped . "[[:>:]]'";
            } else {
                $groupSql .= " AND pp.prompt_text LIKE '%" . $searchEscaped . "%'";
            }
        }
    }
    
    $groupSql .= " GROUP BY pp.hash ORDER BY MIN(pp.prompt_text) ASC";
    
    if( $searchTerm !== '' ) {
        // When searching, only apply limit if searchLimit is explicitly set
        if( $searchLimit !== null ) {
            $groupSql .= " LIMIT " . intval( $searchLimit );
        }
    } else {
        // Normal browsing uses limit and offset
        $groupSql .= " LIMIT " . intval( $limit ) . " OFFSET " . intval( $offset );
    }
    
    $groupResult = $db->query( $groupSql );
    
    if( !$groupResult ) {
        echo json_encode( ['error' => 'Group query failed: ' . $db->error] );
        exit;
    }
    
    $promptHashes = [];
    while( $row = $groupResult->fetch_assoc() ) {
        $promptHashes[] = "'" . $db->real_escape_string( $row['hash'] ) . "'";
    }
    
    if( empty( $promptHashes ) ) {
        echo json_encode( [] );
        exit;
    }
    
    // Now get all images with these hashes
    $sql .= " AND pp.hash IN (" . implode( ',', $promptHashes ) . ")";
    $sql .= " GROUP BY i.id";
    $sql .= " ORDER BY pp.prompt_text ASC, i.id DESC";
    
    // No pagination here - we already paginated the groups
} else {
    // Default: most recent first
    $sql .= " GROUP BY i.id";
    $sql .= " ORDER BY i.id DESC";
    
    // Add pagination
    if( $searchTerm !== '' ) {
        // When searching, only apply limit if searchLimit is explicitly set
        if( $searchLimit !== null ) {
            $sql .= " LIMIT " . intval( $searchLimit );
        }
    } else {
        // Normal browsing uses limit and offset
        $sql .= " LIMIT " . intval( $limit ) . " OFFSET " . intval( $offset );
    }
}

// Execute main query
if( $sortMode !== 'prompt' ) {
    // For non-prompt sorts, execute the query as built above
    $result = $db->query( $sql );
} else {
    // For prompt sort, we already have the filtered query
    $result = $db->query( $sql );
}

if( !$result ) {
    echo json_encode( ['error' => 'Query failed: ' . $db->error] );
    exit;
}

$data = [];
while( $row = $result->fetch_assoc() ) {
    // Convert comma-separated tags to array
    if( !empty( $row['tags'] ) ) {
        $row['tags'] = explode( ',', $row['tags'] );
    } else {
        $row['tags'] = [];
    }
    
    // Remove image_id from output (only needed internally)
    unset( $row['image_id'] );
    
    $data[] = $row;
}

$db->close();
echo json_encode( $data );