<?php
/**
 * Gallery Data API Endpoint
 * 
 * Fetches image data for the main gallery view with filtering and sorting.
 * Supports searching by prompt or tag, whole word matching, and three sort modes.
 * 
 * Query Parameters:
 * - searchTerm: Text to search for (optional)
 * - searchBy: Search in 'prompt' or 'tag' (default: prompt)
 * - wholeWords: Whole word matching (true/false, default: false)
 * - searchLimit: Max results when searching (optional)
 * - limit: Results per page (default: 200)
 * - offset: Starting record (default: 0)
 * - sort: Sort mode - 'recent', 'style', or 'prompt' (default: recent)
 */

require_once __DIR__ . '/utils/db_utils.php';

try {
    $db = getDbConnection();
    
    // Get and validate query parameters
    $searchTerm = $_GET['searchTerm'] ?? '';
    $searchBy = $_GET['searchBy'] ?? 'prompt';
    $wholeWords = ( $_GET['wholeWords'] ?? 'false' ) === 'true';
    $searchLimit = isset( $_GET['searchLimit'] ) && $_GET['searchLimit'] !== '' ? intval( $_GET['searchLimit'] ) : null;
    $limit = intval( $_GET['limit'] ?? 200 );
    $offset = intval( $_GET['offset'] ?? 0 );
    $sortMode = $_GET['sort'] ?? 'recent';
    
    // Build base query - joins all related tables for image metadata
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
    
    // Add search filtering if search term provided
    if( $searchTerm !== '' ) {
        $searchEscaped = $db->real_escape_string( $searchTerm );
        
        if( $searchBy === 'tag' ) {
            // Tag search - uses EXISTS subquery to check image_tags junction table
            $sql .= " AND EXISTS (
                SELECT 1 FROM image_tags it
                JOIN tags tag ON it.tag_id = tag.id
                WHERE it.image_id = i.id";
            
            if( $wholeWords ) {
                // Whole word matching using MySQL REGEXP word boundaries
                $sql .= " AND tag.name REGEXP '[[:<:]]" . $searchEscaped . "[[:>:]]'";
            } else {
                // Substring matching using LIKE
                $sql .= " AND tag.name LIKE '%" . $searchEscaped . "%'";
            }
            
            $sql .= " )";
        } else {
            // Prompt search (default) - searches in positive prompt text
            if( $wholeWords ) {
                // Whole word matching using MySQL REGEXP word boundaries
                $sql .= " AND pp.prompt_text REGEXP '[[:<:]]" . $searchEscaped . "[[:>:]]'";
            } else {
                // Substring matching using LIKE
                $sql .= " AND pp.prompt_text LIKE '%" . $searchEscaped . "%'";
            }
        }
    }
    
    // Apply sorting and pagination based on sort mode
    if( $sortMode === 'style' ) {
        // Sort by art style name (NULL styles last)
        $sql .= " GROUP BY i.id";
        $sql .= " ORDER BY CASE WHEN a.name IS NULL THEN 1 ELSE 0 END, a.name ASC, i.id DESC";
        
        // Add pagination
        if( $searchTerm !== '' && $searchLimit !== null ) {
            // Searching with explicit limit
            $sql .= " LIMIT " . intval( $searchLimit );
        } else if( $searchTerm === '' ) {
            // Normal browsing pagination
            $sql .= " LIMIT " . intval( $limit ) . " OFFSET " . intval( $offset );
        }
        
    } else if( $sortMode === 'prompt' ) {
        // Sort by prompt text - groups images by prompt hash first to paginate groups
        // This prevents splitting images with the same prompt across pages
        
        // First, get distinct prompt hashes for this page
        $groupSql = "
            SELECT pp.hash
            FROM images i
            JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
            LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
            WHERE i.deleted = 0
        ";
        
        // Apply same search filters to group query
        if( $searchTerm !== '' ) {
            $searchEscaped = $db->real_escape_string( $searchTerm );
            
            if( $searchBy === 'tag' ) {
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
                if( $wholeWords ) {
                    $groupSql .= " AND pp.prompt_text REGEXP '[[:<:]]" . $searchEscaped . "[[:>:]]'";
                } else {
                    $groupSql .= " AND pp.prompt_text LIKE '%" . $searchEscaped . "%'";
                }
            }
        }
        
        $groupSql .= " GROUP BY pp.hash ORDER BY MIN(pp.prompt_text) ASC";
        
        // Paginate the groups
        if( $searchTerm !== '' && $searchLimit !== null ) {
            $groupSql .= " LIMIT " . intval( $searchLimit );
        } else if( $searchTerm === '' ) {
            $groupSql .= " LIMIT " . intval( $limit ) . " OFFSET " . intval( $offset );
        }
        
        $groupResult = $db->query( $groupSql );
        
        if( !$groupResult ) {
            $db->close();
            sendErrorResponse( 'Failed to group by prompts: ' . $db->error, 500 );
        }
        
        // Collect prompt hashes from paginated groups
        $promptHashes = [];
        while( $row = $groupResult->fetch_assoc() ) {
            $promptHashes[] = "'" . $db->real_escape_string( $row['hash'] ) . "'";
        }
        
        if( empty( $promptHashes ) ) {
            $db->close();
            sendJsonResponse( [] );
        }
        
        // Now fetch all images matching these prompt hashes
        $sql .= " AND pp.hash IN (" . implode( ',', $promptHashes ) . ")";
        $sql .= " GROUP BY i.id";
        $sql .= " ORDER BY pp.prompt_text ASC, i.id DESC";
        
        // No additional pagination - already limited by prompt groups
        
    } else {
        // Default: most recent first (by image ID descending)
        $sql .= " GROUP BY i.id";
        $sql .= " ORDER BY i.id DESC";
        
        // Add pagination
        if( $searchTerm !== '' && $searchLimit !== null ) {
            $sql .= " LIMIT " . intval( $searchLimit );
        } else if( $searchTerm === '' ) {
            $sql .= " LIMIT " . intval( $limit ) . " OFFSET " . intval( $offset );
        }
    }
    
    // Execute main query
    $result = $db->query( $sql );
    
    if( !$result ) {
        $db->close();
        sendErrorResponse( 'Failed to fetch gallery data: ' . $db->error, 500 );
    }
    
    // Process results
    $data = [];
    while( $row = $result->fetch_assoc() ) {
        // Convert comma-separated tags string to array
        if( !empty( $row['tags'] ) ) {
            $row['tags'] = explode( ',', $row['tags'] );
        } else {
            $row['tags'] = [];
        }
        
        // Remove internal image_id field (not needed in API response)
        unset( $row['image_id'] );
        
        $data[] = $row;
    }
    
    $db->close();
    sendJsonResponse( $data );
    
} catch( Exception $e ) {
    error_log( "Error fetching gallery data: " . $e->getMessage() );
    sendErrorResponse( 'Failed to fetch gallery data: ' . $e->getMessage(), 500 );
}
