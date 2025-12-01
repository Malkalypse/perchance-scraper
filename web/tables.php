<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Tables - Perchance Gallery</title>
    <link rel="stylesheet" href="style.css">
    <style>
        body {
          padding-top: 60px;
        }

        .data-table-container {
          display: none;
          margin: 20px 0;
          overflow-x: auto;
        }

        .data-table-container.active {
          display: block;
        }

        .data-table {
          width: 800px;
          max-width: 800px;
          margin: 0 auto;
          table-layout: fixed;
          border-collapse: collapse;
          background: var(--bg-secondary);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border: 2px solid white;            
        }

        .data-table thead {
          background: var(--bg-tertiary);
        }

        .data-table th,
        .data-table td {
          padding: 0.8em;
          text-align: left;
          border-bottom: 1px solid white; /*var(--border-color);*/
        }

        /* First column (ID) - shrink to fit */
        .data-table th:first-child,
        .data-table td:first-child {
          width: 8%;
          white-space: nowrap;
        }

        /* Second column - expand to fill space */
        .data-table th:nth-child(2),
        .data-table td:nth-child(2) {
          width: auto;
        }

        /* Third and fourth columns - shrink to fit */
        .data-table th:nth-child(n+3),
        .data-table td:nth-child(n+3) {
          width: 15%;
          white-space: nowrap;
        }

        /* Allow wrapping for prompt text in specific tables */
        #positive-prompts-tbody td:nth-child(2),
        #negative-prompts-tbody td:nth-child(2) {
          white-space: normal;
          word-wrap: break-word;
        }

        .data-table th {
            font-weight: bold;
            position: sticky;
            top: 60px;
            background: var(--bg-tertiary);
            z-index: 10;
            user-select: none;
            white-space: nowrap;
            font-size: 0.8em;
        }

        .data-table th:hover {
            background: var(--bg-hover);
        }

        .data-table th .sort-arrows {
            display: inline-flex;
            font-size: 10px;
            margin-left: 0.2em;
        }

        .data-table th .sort-arrow {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 1.5em;
            height: 2em;
            cursor: pointer;
            opacity: 0.3;
            transition: opacity 0.2s;
        }

        .data-table th .sort-arrow:hover {
            opacity: 0.6;
        }

        .data-table th .sort-arrow.active {
            opacity: 1;
            cursor: default;
        }

        .data-table th .sort-arrow.active:hover {
            opacity: 1;
        }

        .data-table tbody tr:hover {
          background: var(--bg-hover);
        }

        .loading {
          text-align: center;
          padding: 20px;
          font-size: 18px;
          color: var(--text-secondary);
          min-height: 60px;
          visibility: hidden;
        }

        .loading.active {
          visibility: visible;
        }

        .error {
          text-align: center;
          padding: 40px;
          color: #e74c3c;
        }

        h1 {
          margin-bottom: 10px;
        }

        #gallery {
          padding: 20px;
        }
    </style>
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

    <script>
        // State management
        let currentTable = 'art-styles';
        let currentOffset = 0;
        let currentLimit = 200;
        let currentSortColumn = 'image_count'; // Default for art-styles, positive-prompts, negative-prompts, tags
        let currentSortOrder = 'desc'; // Default sort order
        
        // Cache for preloaded table data
        const tableCache = {
            'art-styles': null,
            'positive-prompts': null,
            'negative-prompts': null,
            'tags': null,
            'tokens': null
        };

        // Handle table selection
        const tableSelect = document.getElementById('tableSelect');
        const containers = document.querySelectorAll('.data-table-container');
        const limitInput = document.getElementById('limit');
        const prevBtn = document.getElementById('prev');
        const nextBtn = document.getElementById('next');
        
        tableSelect.addEventListener('change', function() {
            currentTable = this.value;
            currentOffset = 0;
            
            // Set appropriate default sort column for each table
            if (currentTable === 'tokens') {
                currentSortColumn = 'positive_count';
            } else {
                currentSortColumn = 'image_count';
            }
            currentSortOrder = 'desc';
            
            // Hide all containers
            containers.forEach(container => {
                container.classList.remove('active');
            });
            
            // Show selected container
            const selectedContainer = document.getElementById(currentTable + '-container');
            if (selectedContainer) {
                selectedContainer.classList.add('active');
                updateSortIndicators();
                
                // If cached, render immediately; otherwise load
                if (tableCache[currentTable]) {
                    renderTableData(tableCache[currentTable]);
                } else {
                    loadTableData();
                }
            }
        });

        // Navigation controls
        prevBtn.addEventListener('click', function() {
            if (currentOffset > 0) {
                currentOffset = Math.max(0, currentOffset - currentLimit);
                loadTableData();
            }
        });

        nextBtn.addEventListener('click', function() {
            currentOffset += currentLimit;
            loadTableData();
        });

        limitInput.addEventListener('change', function() {
            currentLimit = parseInt(this.value) || 200;
            currentOffset = 0;
            loadTableData();
        });

        // Handle column sorting
        function setupSortHandlers() {
            containers.forEach(container => {
                const arrows = container.querySelectorAll('.sort-arrow');
                arrows.forEach(arrow => {
                    arrow.addEventListener('click', function(e) {
                        e.stopPropagation(); // Prevent header click
                        
                        // Don't allow clicking active arrow
                        if (this.classList.contains('active')) {
                            return;
                        }
                        
                        const header = this.closest('th[data-sort]');
                        const sortColumn = header.getAttribute('data-sort');
                        const sortOrder = this.getAttribute('data-order');
                        
                        currentSortColumn = sortColumn;
                        currentSortOrder = sortOrder;
                        currentOffset = 0; // Reset to first page when sorting
                        
                        updateSortIndicators();
                        loadTableData();
                    });
                });
            });
        }

        // Update sort indicators in headers
        function updateSortIndicators() {
            const container = document.getElementById(currentTable + '-container');
            const headers = container.querySelectorAll('th[data-sort]');
            
            headers.forEach(header => {
                const sortColumn = header.getAttribute('data-sort');
                const ascArrow = header.querySelector('.sort-asc');
                const descArrow = header.querySelector('.sort-desc');
                
                // Remove active class from all arrows
                ascArrow.classList.remove('active');
                descArrow.classList.remove('active');
                
                // Update for current sort column
                if (sortColumn === currentSortColumn) {
                    if (currentSortOrder === 'asc') {
                        ascArrow.classList.add('active');
                    } else {
                        descArrow.classList.add('active');
                    }
                }
            });
        }

        // Load data for current table
        async function loadTableData() {
            const container = document.getElementById(currentTable + '-container');
            const loading = container.querySelector('.loading');
            const table = container.querySelector('.data-table');
            
            try {
                loading.classList.add('active');
                loading.innerHTML = `Loading ${currentTable.replace('-', ' ')}...<br><small style="font-size: 14px; color: var(--text-secondary);">(Please wait, this may take a moment)</small>`;
                
                const response = await fetch(`api/tables_data.php?table=${currentTable}&limit=${currentLimit}&offset=${currentOffset}&sort=${currentSortColumn}&order=${currentSortOrder}`);
                
                if (!response.ok) throw new Error('Network response was not ok');
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Cache the data for this table
                tableCache[currentTable] = data;
                
                renderTableData(data);
                
            } catch (error) {
                loading.classList.add('active');
                loading.innerHTML = `<div class="error">Error loading data: ${error.message}</div>`;
            }
        }
        
        // Render table data from cache or fresh load
        function renderTableData(data) {
            const container = document.getElementById(currentTable + '-container');
            const loading = container.querySelector('.loading');
            const table = container.querySelector('.data-table');
            const tbody = container.querySelector('tbody');
            
            // Populate table
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px;">No data found</td></tr>';
            } else {
                data.forEach(row => {
                    const tr = document.createElement('tr');
                    
                    switch (currentTable) {
                        case 'art-styles':
                            tr.innerHTML = `
                                <td>${row.id}</td>
                                <td>${escapeHtml(row.style_string)}</td>
                                <td>${row.image_count}</td>
                            `;
                            break;
                        case 'positive-prompts':
                        case 'negative-prompts':
                            tr.innerHTML = `
                                <td>${row.id}</td>
                                <td>${escapeHtml(row.prompt_text)}</td>
                                <td>${row.combinations_count}</td>
                                <td>${row.image_count}</td>
                            `;
                            break;
                        case 'tags':
                            tr.innerHTML = `
                                <td>${row.id}</td>
                                <td>${escapeHtml(row.name)}</td>
                                <td>${row.image_count}</td>
                            `;
                            break;
                        case 'tokens':
                            tr.innerHTML = `
                                <td>${row.id}</td>
                                <td>${escapeHtml(row.token)}</td>
                                <td>${row.positive_count}</td>
                                <td>${row.negative_count}</td>
                            `;
                            break;
                    }
                    
                    tbody.appendChild(tr);
                });
            }
            
            loading.classList.remove('active');
            table.style.display = 'table';
            
            // Update button states
            prevBtn.disabled = currentOffset === 0;
            nextBtn.disabled = data.length < currentLimit;
        }
        
        // Preload all tables on page load
        async function preloadAllTables() {
            const tables = ['art-styles', 'positive-prompts', 'negative-prompts', 'tags', 'tokens'];
            const sortDefaults = {
                'art-styles': 'image_count',
                'positive-prompts': 'image_count',
                'negative-prompts': 'image_count',
                'tags': 'image_count',
                'tokens': 'positive_count'
            };
            
            for (const tableName of tables) {
                try {
                    const sortColumn = sortDefaults[tableName];
                    const response = await fetch(`api/tables_data.php?table=${tableName}&limit=${currentLimit}&offset=0&sort=${sortColumn}&order=desc`);
                    if (response.ok) {
                        const data = await response.json();
                        if (!data.error) {
                            tableCache[tableName] = data;
                        }
                    }
                } catch (error) {
                    console.error(`Failed to preload ${tableName}:`, error);
                }
            }
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Load initial table
        window.addEventListener('DOMContentLoaded', async function() {
            currentLimit = parseInt(limitInput.value) || 200;
            setupSortHandlers();
            updateSortIndicators();
            
            // Start preloading all tables in the background
            preloadAllTables();
            
            // Load the initial table immediately
            loadTableData();
        });
    </script>
</body>
</html>
