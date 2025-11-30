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

// Get prompts for images being deleted to update token counts
$placeholders = implode( ',', array_fill( 0, count( $filenames ), '?' ) );
$stmt = $db->prepare( "
    SELECT 
        i.filename,
        pp.prompt_text as prompt,
        np.prompt_text as negative_prompt,
        ast.style_string
    FROM images i
    LEFT JOIN prompt_combinations pc ON i.prompt_combination_id = pc.id
    LEFT JOIN positive_prompts pp ON pc.positive_prompt_id = pp.id
    LEFT JOIN negative_prompts np ON pc.negative_prompt_id = np.id
    LEFT JOIN art_styles ast ON i.art_style_id = ast.id
    WHERE i.filename IN ($placeholders) AND i.deleted = 0
" );

$types = str_repeat( 's', count( $filenames ) );
$stmt->bind_param( $types, ...$filenames );
$stmt->execute();
$result = $stmt->get_result();

$imagesToDelete = [];
while( $row = $result->fetch_assoc() ) {
    $imagesToDelete[] = $row;
}
$stmt->close();

$debugInfo = [
    'requested_filenames' => $filenames,
    'found_images_count' => count( $imagesToDelete ),
    'prompt_tokens_decremented' => 0,
    'negative_tokens_decremented' => 0
];

// Extract and count tokens to decrement
if( !empty( $imagesToDelete ) ) {
    $promptTokens = [];
    $negativeTokens = [];
    
    foreach( $imagesToDelete as $image ) {
        $prompt = $image['prompt'] ?? '';
        $negativePrompt = $image['negative_prompt'] ?? '';
        $styleString = $image['style_string'] ?? '';
        
        // Remove style string from prompt
        if( $styleString ) {
            $prompt = str_replace( $styleString, '', $prompt );
        }
        
        // Extract tokens using same delimiters as extract_tokens.py: comma, period, newline
        $allPromptTokens = preg_split( '/[,.\n]+/', $prompt, -1, PREG_SPLIT_NO_EMPTY );
        foreach( $allPromptTokens as $token ) {
            $token = strtolower( trim( $token ) );
            if( $token !== '' ) {
                $promptTokens[$token] = ( $promptTokens[$token] ?? 0 ) + 1;
            }
        }
        
        $allNegativeTokens = preg_split( '/[,.\n]+/', $negativePrompt, -1, PREG_SPLIT_NO_EMPTY );
        foreach( $allNegativeTokens as $token ) {
            $token = strtolower( trim( $token ) );
            if( $token !== '' ) {
                $negativeTokens[$token] = ( $negativeTokens[$token] ?? 0 ) + 1;
            }
        }
    }
    
    // Decrement token counts
    foreach( $promptTokens as $token => $count ) {
        $stmt = $db->prepare( "UPDATE tokens SET positive_prompt_count = GREATEST(0, positive_prompt_count - ?) WHERE token = ?" );
        $stmt->bind_param( 'is', $count, $token );
        $stmt->execute();
        $debugInfo['prompt_tokens_decremented'] += $stmt->affected_rows;
        $stmt->close();
    }
    
    foreach( $negativeTokens as $token => $count ) {
        $stmt = $db->prepare( "UPDATE tokens SET negative_prompt_count = GREATEST(0, negative_prompt_count - ?) WHERE token = ?" );
        $stmt->bind_param( 'is', $count, $token );
        $stmt->execute();
        $debugInfo['negative_tokens_decremented'] += $stmt->affected_rows;
        $stmt->close();
    }
}

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