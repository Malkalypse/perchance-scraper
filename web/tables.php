<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Database Tables - Perchance Gallery</title>
<link rel="stylesheet" href="style.css">
</head>

<body>

<!-- Fixed Toolbar -->
<div id="toolbar">
<div id="table_select_controls" class="controls">
<label for="tableSelect">Table:</label>
<select id="tableSelect">
<option value="art-styles">Art Styles</option>
<option value="positive-prompts">Positive Prompts</option>
<option value="negative-prompts">Negative Prompts</option>
<option value="tags">Tags</option>
<option value="tokens">Tokens</option>
</select>
</div>

<div id="nav_controls" class="controls">
<button id="prev">Back</button>
<input type="number" id="limit" value="200">
<button id="next">Next</button>
</div>

<div id="back_controls" class="controls">
<a href="index.php" style="color: var(--link-color); text-decoration: none;">← Back to Gallery</a>
</div>
</div>
<!-- End Fixed Toolbar -->

<div id="gallery">
<!-- Art Styles Table -->
<div id="art-styles-container" class="data-table-container active">
<h2>Art Styles</h2>
<div class="loading">Loading art styles...</div>
<table class="data-table" style="display: none;">
<thead>
<tr>
<th data-sort="id">ID <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="style_string">Style String <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="image_count">Image Count <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
</tr>
</thead>
<tbody id="art-styles-tbody">
</tbody>
</table>
</div>

<!-- Positive Prompts Table -->
<div id="positive-prompts-container" class="data-table-container">
<h2>Positive Prompts</h2>
<div class="loading">Loading positive prompts...</div>
<table class="data-table" style="display: none;">
<thead>
<tr>
<th data-sort="id">ID <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="prompt_text">Prompt Text <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="combinations_count">Combinations<span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="image_count">Image Count <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
</tr>
</thead>
<tbody id="positive-prompts-tbody">
</tbody>
</table>
</div>

<!-- Negative Prompts Table -->
<div id="negative-prompts-container" class="data-table-container">
<h2>Negative Prompts</h2>
<div class="loading">Loading negative prompts...</div>
<table class="data-table" style="display: none;">
<thead>
<tr>
<th data-sort="id">ID <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="prompt_text">Prompt Text <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="combinations_count">Combinations<span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="image_count">Image Count <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
</tr>
</thead>
<tbody id="negative-prompts-tbody">
</tbody>
</table>
</div>

<!-- Tags Table -->
<div id="tags-container" class="data-table-container">
<h2>Tags</h2>
<div class="loading">Loading tags...</div>
<table class="data-table" style="display: none;">
<thead>
<tr>
<th data-sort="id">ID <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="name">Tag Name <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="image_count">Image Count <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
</tr>
</thead>
<tbody id="tags-tbody">
</tbody>
</table>
</div>

<!-- Tokens Table -->
<div id="tokens-container" class="data-table-container">
<h2>Tokens</h2>
<div class="loading">Loading tokens...</div>
<table class="data-table" style="display: none;">
<thead>
<tr>
<th data-sort="id">ID <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="token">Token <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="positive_count">Positive Count <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
<th data-sort="negative_count">Negative Count <span class="sort-arrows"><span class="sort-arrow sort-asc" data-order="asc">▲</span><span class="sort-arrow sort-desc" data-order="desc">▼</span></span></th>
</tr>
</thead>
<tbody id="tokens-tbody">
</tbody>
</table>
</div>
</div>

<script src="js/tables.js"></script>
</body>
</html>
