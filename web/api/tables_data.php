<?php
/**
 * Tables Data API Endpoint
 * 
 * Fetches paginated and sorted data from database tables for display.
 * Supports art-styles, positive-prompts, negative-prompts, tags, and tokens tables.
 * 
 * Query Parameters:
 * - table: Table name to query (required)
 * - limit: Number of records per page (default: 200)
 * - offset: Starting record number (default: 0)
 * - sort: Column to sort by (default: image_count)
 * - order: Sort direction ASC or DESC (default: DESC)
 */

require_once __DIR__ . '/utils/db_utils.php';

// Get and validate query parameters
$table = $_GET['table'] ?? '';
$limit = intval( $_GET['limit'] ?? 200 );
$offset = intval( $_GET['offset'] ?? 0 );
$sort = $_GET['sort'] ?? 'image_count';
$order = strtoupper( $_GET['order'] ?? 'DESC' );

// Validate sort order
if( !in_array( $order, ['ASC', 'DESC'] ) ) {
    $order = 'DESC';
}

if( empty( $table ) ) {
    sendErrorResponse( 'No table specified' );
}

try {
    $db = getDbConnection();
    $data = [];
    
    // Map sort column names to actual SQL columns for each table type
    // This prevents SQL injection and ensures valid sorting
    $sortColumnMap = [
        'art-styles' => [
            'id' => 'ast.id',
            'style_string' => 'ast.style_string',
            'image_count' => 'image_count'
        ],
        'positive-prompts' => [
            'id' => 'pp.id',
            'prompt_text' => 'pp.prompt_text',
            'combinations_count' => 'combinations_count',
            'image_count' => 'image_count'
        ],
        'negative-prompts' => [
            'id' => 'np.id',
            'prompt_text' => 'np.prompt_text',
            'combinations_count' => 'combinations_count',
            'image_count' => 'image_count'
        ],
        'tags' => [
            'id' => 't.id',
            'name' => 't.name',
            'image_count' => 'image_count'
        ],
        'tokens' => [
            'id' => 't.id',
            'token' => 't.token',
            'positive_count' => 'positive_count',
            'negative_count' => 'negative_count'
        ]
    ];
    
    // Validate and get sort column
    $sortColumn = 'image_count'; // Default fallback
    if( isset( $sortColumnMap[$table][$sort] ) ) {
        $sortColumn = $sortColumnMap[$table][$sort];
    }
    
    // Query appropriate table based on selection
    switch( $table ) {
        case 'art-styles':
            // Art Styles: ID, Style String, Image Count (non-deleted images)
            $sql = "
                SELECT 
                    ast.id,
                    ast.style_string,
                    COUNT(DISTINCT i.id) as image_count
                FROM art_styles ast
                LEFT JOIN images i ON i.art_style_id = ast.id AND i.deleted = 0
                GROUP BY ast.id
                ORDER BY $sortColumn $order, ast.id ASC
                LIMIT ? OFFSET ?
            ";
            
            $stmt = $db->prepare( $sql );
            $stmt->bind_param( 'ii', $limit, $offset );
            $stmt->execute();
            $result = $stmt->get_result();
            
            while( $row = $result->fetch_assoc() ) {
                $data[] = [
                    'id' => $row['id'],
                    'style_string' => $row['style_string'],
                    'image_count' => intval( $row['image_count'] )
                ];
            }
            $stmt->close();
            break;

        case 'positive-prompts':
            // Positive Prompts: ID, Text, Combinations Count, Image Count
            $sql = "
                SELECT 
                    pp.id,
                    pp.prompt_text,
                    COUNT(DISTINCT pc.id) as combinations_count,
                    COUNT(DISTINCT i.id) as image_count
                FROM positive_prompts pp
                LEFT JOIN prompt_combinations pc ON pc.positive_prompt_id = pp.id
                LEFT JOIN images i ON i.prompt_combination_id = pc.id AND i.deleted = 0
                GROUP BY pp.id
                ORDER BY $sortColumn $order, pp.id ASC
                LIMIT ? OFFSET ?
            ";
            
            $stmt = $db->prepare( $sql );
            $stmt->bind_param( 'ii', $limit, $offset );
            $stmt->execute();
            $result = $stmt->get_result();
            
            while( $row = $result->fetch_assoc() ) {
                $data[] = [
                    'id' => $row['id'],
                    'prompt_text' => $row['prompt_text'],
                    'combinations_count' => intval( $row['combinations_count'] ),
                    'image_count' => intval( $row['image_count'] )
                ];
            }
            $stmt->close();
            break;

        case 'negative-prompts':
            // Negative Prompts: ID, Text, Combinations Count, Image Count
            $sql = "
                SELECT 
                    np.id,
                    np.prompt_text,
                    COUNT(DISTINCT pc.id) as combinations_count,
                    COUNT(DISTINCT i.id) as image_count
                FROM negative_prompts np
                LEFT JOIN prompt_combinations pc ON pc.negative_prompt_id = np.id
                LEFT JOIN images i ON i.prompt_combination_id = pc.id AND i.deleted = 0
                GROUP BY np.id
                ORDER BY $sortColumn $order, np.id ASC
                LIMIT ? OFFSET ?
            ";
            
            $stmt = $db->prepare( $sql );
            $stmt->bind_param( 'ii', $limit, $offset );
            $stmt->execute();
            $result = $stmt->get_result();
            
            while( $row = $result->fetch_assoc() ) {
                $data[] = [
                    'id' => $row['id'],
                    'prompt_text' => $row['prompt_text'],
                    'combinations_count' => intval( $row['combinations_count'] ),
                    'image_count' => intval( $row['image_count'] )
                ];
            }
            $stmt->close();
            break;

        case 'tags':
            // Tags: ID, Tag Name, Image Count (counts images via junction table)
            $sql = "
                SELECT 
                    t.id,
                    t.name,
                    COUNT(DISTINCT it.image_id) as image_count
                FROM tags t
                LEFT JOIN image_tags it ON it.tag_id = t.id
                LEFT JOIN images i ON i.id = it.image_id AND i.deleted = 0
                GROUP BY t.id
                ORDER BY $sortColumn $order, t.id ASC
                LIMIT ? OFFSET ?
            ";
            
            $stmt = $db->prepare( $sql );
            $stmt->bind_param( 'ii', $limit, $offset );
            $stmt->execute();
            $result = $stmt->get_result();
            
            while( $row = $result->fetch_assoc() ) {
                $data[] = [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'image_count' => intval( $row['image_count'] )
                ];
            }
            $stmt->close();
            break;

        case 'tokens':
            // Tokens: ID, Token Text, Positive Prompt Count, Negative Prompt Count
            // Only includes tokens that appear in at least one prompt
            $sql = "
                SELECT 
                    t.id,
                    t.token,
                    COUNT(DISTINCT ppt.positive_prompt_id) as positive_count,
                    COUNT(DISTINCT npt.negative_prompt_id) as negative_count
                FROM tokens t
                LEFT JOIN positive_prompt_tokens ppt ON ppt.token_id = t.id
                LEFT JOIN negative_prompt_tokens npt ON npt.token_id = t.id
                GROUP BY t.id
                HAVING positive_count > 0 OR negative_count > 0
                ORDER BY $sortColumn $order, t.id ASC
                LIMIT ? OFFSET ?
            ";
            
            $stmt = $db->prepare( $sql );
            $stmt->bind_param( 'ii', $limit, $offset );
            $stmt->execute();
            $result = $stmt->get_result();
            
            while( $row = $result->fetch_assoc() ) {
                $data[] = [
                    'id' => $row['id'],
                    'token' => $row['token'],
                    'positive_count' => intval( $row['positive_count'] ),
                    'negative_count' => intval( $row['negative_count'] )
                ];
            }
            $stmt->close();
            break;

        default:
            $db->close();
            sendErrorResponse( 'Invalid table specified', 400 );
    }
    
    $db->close();
    sendJsonResponse( $data );
    
} catch( Exception $e ) {
    error_log( "Error fetching table data: " . $e->getMessage() );
    sendErrorResponse( 'Failed to fetch table data: ' . $e->getMessage(), 500 );
}

