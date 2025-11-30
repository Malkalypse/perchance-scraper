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

    <div id="sort_controls" class="controls">
      <label for="sort_by">Sort by:</label>
      <select id="sort_by">
        <option value="recent">Recent</option>
        <option value="style">Style</option>
        <option value="prompt">Prompt</option>
      </select>
    </div>

    <div id="nav_controls" class="controls">
      <button id="prev">Back</button>
      <input type="number" id="limit" value="200">
      <button id="next">Next</button>
    </div>

    <div id="page_controls" class="controls">
      <label for="page">Page:</label>
      <input type="number" id="page" min="1" value="1">
      <button id="go">Go</button>
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
      <input type="number" id="searchLimit" placeholder="Max">
      <label for="wholeWords">
        <input type="checkbox" id="wholeWords" checked>Whole words
      </label>
      <button id="clearSearch">Clear</button>
    </div>

    <div id="selection_controls" class="controls">
      <label for="selectMode">
        <input type="checkbox" id="selectMode">Select Mode
      </label> 
      <button id="selectAll"><span>Select All</span></button>
      <button id="deleteSelected" disabled>Delete Selected</button>
    </div>

    <div id="display_controls" class="controls">
      <label for="imagesOnly"><input type="checkbox" id="imagesOnly">Images only</label>
    </div>

    <div id="tag_controls" class="controls">
      <label for="tag"><input type="checkbox" id="tag">Show tags</label>
    </div>
  </div>
  <!-- End Fixed Toolbar -->

  <div id="gallery"></div>

  <script src="script.js"></script>
</body>
</html>