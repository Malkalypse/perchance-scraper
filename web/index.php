<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">
  <title>JSON CMS Viewer</title>
  <link rel="stylesheet" href="style.css">
</head>

<body>

  <!-- Fixed Toolbar -->
  <div id="toolbar">

    <div id="nav_controls" class="controls">      
      <label for="sort_by">Sort by:</label>
      <select id="sort_by">
        <option value="recent">Recent</option>
        <option value="style">Style</option>
        <option value="prompt">Prompt</option>
      </select>
      <button id="prev">Back</button>
      <div id="limitBox">
        <input type="number" id="limit" value="200">
        <span id="navInfo"></span>
      </div>
      <button id="next">Next</button>
      <label for="page">Page:</label>
      <input type="number" id="page" min="1" value="1">
    </div>

    <div id="search_controls" class="controls">
      <label for="search_by">Search by:</label>
      <select id="search_by">
        <option value="prompt">Prompt</option>
        <option value="tag">Tag</option>
      </select>
      <div id="searchBox">
        <input type="text" id="search" placeholder="Search">
        <span id="pageInfo"></span>
      </div>
      <label for="wholeWords">
        <input type="checkbox" id="wholeWords" checked>Whole words
      </label>
      <button id="clearSearch">Clear</button>
    </div>

    <div id="selection_controls" class="controls">
      <button id="selectAll"><span>Select All</span></button>
      <button id="addToCollection" disabled>Add to Collection</button>
      <button id="hideSelected" disabled>Hide</button>
      <button id="deleteSelected" disabled>Delete</button>
      <span id="selectionInfo"></span>
    </div>

    <div id="display_controls" class="controls">
      <label for="tag"><input type="checkbox" id="tag">Tags</label>      
      <label for="imagesOnly"><input type="checkbox" id="imagesOnly">Images only</label>
      <label for="collections"><input type="checkbox" id="collections">Collections</label>
      <label for="showHidden"><input type="checkbox" id="showHidden">Show hidden</label>
    </div>

    <div id="tables_link_controls" class="controls">
      <a href="tables.php" style="color: var(--link-color); text-decoration: none;">Tables →</a>
    </div>

  </div>
  <!-- End Fixed Toolbar -->

  <!-- Collections Sidebar -->
  <div id="collectionsSidebar" style="display: none;">
    <h3>Collections</h3>
    <div id="collectionsList"></div>
  </div>

  <div id="gallery"></div>

  <!-- Collection Popup Modal -->
  <div id="collectionModal" class="modal" style="display: none;">
    <div class="modal-content">
      <h3>Add to Collection</h3>
      <input type="text" id="collectionInput" placeholder="Enter collection name (optional)">
      <div class="modal-buttons">
        <button id="confirmCollection">Add to new collection</button>
        <button id="cancelCollection">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Load reusable classes -->
  <script src="js/GalleryState.js"></script>
  <script src="js/APIClient.js"></script>
  <script src="js/DOMHelper.js"></script>
  <script src="js/ImageSelector.js"></script>

  <!-- Load application script -->
  <script src="js/script.js"></script>
</body>
</html>