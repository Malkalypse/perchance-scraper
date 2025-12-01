<?php
// table_counts.php - API endpoint for fetching table row counts
header('Content-Type: application/json');

// Database connection
$db = new mysqli('localhost', 'root', '', 'perchance_gallery');

if ($db->connect_error) {
    echo json_encode(['error' => 'Database connection failed: ' . $db->connect_error]);
    exit;
}

$db->set_charset('utf8mb4');

$counts = [];

// Art Styles count
$result = $db->query("SELECT COUNT(DISTINCT ast.id) as count FROM art_styles ast LEFT JOIN images i ON i.art_style_id = ast.id WHERE i.id IS NOT NULL");
if ($result) {
    $counts['art-styles'] = intval($result->fetch_assoc()['count']);
}

// Positive Prompts count
$result = $db->query("SELECT COUNT(DISTINCT pp.id) as count FROM positive_prompts pp LEFT JOIN prompt_combinations pc ON pc.positive_prompt_id = pp.id LEFT JOIN images i ON i.prompt_combination_id = pc.id WHERE i.id IS NOT NULL");
if ($result) {
    $counts['positive-prompts'] = intval($result->fetch_assoc()['count']);
}

// Negative Prompts count
$result = $db->query("SELECT COUNT(DISTINCT np.id) as count FROM negative_prompts np LEFT JOIN prompt_combinations pc ON pc.negative_prompt_id = np.id LEFT JOIN images i ON i.prompt_combination_id = pc.id WHERE i.id IS NOT NULL");
if ($result) {
    $counts['negative-prompts'] = intval($result->fetch_assoc()['count']);
}

// Tags count
$result = $db->query("SELECT COUNT(DISTINCT t.id) as count FROM tags t LEFT JOIN image_tags it ON it.tag_id = t.id WHERE it.image_id IS NOT NULL");
if ($result) {
    $counts['tags'] = intval($result->fetch_assoc()['count']);
}

// Tokens count - only tokens that appear in at least one prompt
$result = $db->query("SELECT COUNT(DISTINCT t.id) as count FROM tokens t LEFT JOIN positive_prompt_tokens ppt ON ppt.token_id = t.id LEFT JOIN negative_prompt_tokens npt ON npt.token_id = t.id WHERE ppt.positive_prompt_id IS NOT NULL OR npt.negative_prompt_id IS NOT NULL");
if ($result) {
    $counts['tokens'] = intval($result->fetch_assoc()['count']);
}

$db->close();

echo json_encode($counts);
