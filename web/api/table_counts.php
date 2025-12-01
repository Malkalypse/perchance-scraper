<?php
// table_counts.php - API endpoint for fetching table row counts from cache
header('Content-Type: application/json');

$cache_file = __DIR__ . '/table_counts.json';

// Check if cache file exists
if (!file_exists($cache_file)) {
    echo json_encode(['error' => 'Table counts cache not found. Run python/update_table_counts.py to generate it.']);
    exit;
}

// Read and return cached counts
$counts = file_get_contents($cache_file);
if ($counts === false) {
    echo json_encode(['error' => 'Failed to read table counts cache']);
    exit;
}

echo $counts;
