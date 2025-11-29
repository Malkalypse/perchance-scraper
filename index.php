<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>JSON CMS Viewer</title>
  <style>
    
    body {
      margin: 0;
      font-family: sans-serif;
      font-size: 0.9em;
      color: rgb(216, 212, 207);
      background-color: rgb(19, 21, 22);
    }
    #toolbar {
      overflow: visible;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      /*min-height: 50px;*/
      min-height: fit-content;
      background: #f7f7f7;
      color: black;
      border-bottom: 1px solid #ccc;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      /*justify-content: space-between;*/
      padding: 0.1em;
      z-index: 1000;
      /*gap: 0.2em;*/
    }
    #sort_controls, #nav_controls, #page_controls, #search_controls, #selection_controls, #display_controls, #tag_controls {
      display: flex;
      gap: 0.5em;
      align-items: center;
      padding: 0.9em;
      margin: 0.1em;
      background-color: #fff;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    #searchBox {
      position: relative;
      display: inline-block;
    }
    #searchBox #pageInfo {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 1px;
      font-size: 0.7em;
      color: #666;
      white-space: nowrap;
      pointer-events: none;
    }
    #limit, #page, #searchLimit {
      width:8ch
    }
    label[for="wholeWords"] {
      flex: 0 0 auto;
      white-space: nowrap;
      font-size: 0.8em;
    }
    #selectAll {
      position: relative;
    }
    #selectAll::before {
      content: "Unselect All"; /* reserves width */
      visibility: hidden;
      display: inline-block;
      white-space: nowrap;
    }
    #selectAll > span {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
    }
    /* Images-only mode styles */
    label[for="imagesOnly"] {
      flex: 0 0 auto;
      white-space: nowrap;
      font-size: 0.8em;
      cursor: pointer;
    }
    .images-only .card-right {
      display: none !important;
    }
    .images-only #gallery {
      display: flex;
      flex-wrap: wrap;
      gap: 1em;
    }
    .images-only .card {
      margin: 0;
      padding: 0;
      border: none;
      width: auto;
    }
    .images-only .card-left {
      gap: 0;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .card {
      border: 1px solid #ccc;
      margin: 1em;
      padding: 0.5em;
      /*max-width: 800px;*/
      margin-bottom: 0;
      display: flex;
      gap: 1em;
      align-items: flex-start;
    }
    .card-left {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0.5em;
    }
    .card-left input[type="checkbox"] {
      align-self: center;
    }
    .card-left img {
      max-width: 300px;
      display: block;
      cursor: pointer;
      
    }
    img.selected {
      outline: 4px solid white;
      outline-offset: -4px;
    }
    .tags-container {
      display: flex;
      gap: 0.5em;
      margin-top: 1em;
      width: 100%;
    }
    .tags-container button {
      flex: 0 0 auto;
      padding: 0.5em 1em;
    }
    .tags-container input {
      flex: 1;
      padding: 0.5em;
      font-family: inherit;
      font-size: inherit;
    }
    .card-right {
      flex: 1;
      overflow-wrap: break-word;
    }
    .card-right p {
      margin: 0.5em 0;
    }
    
  </style>
</head>
<body>
  <!-- Fixed toolbar -->
  <div id="toolbar">

    <div id="sort_controls">
      <label for="sort">Sort by:</label>
      <select id="sort">
        <option value="recent">Recent</option>
        <option value="style">Style</option>
        <option value="prompt">Prompt</option>
      </select>
    </div>

    <div id="nav_controls">
      <button id="prev">Back</button>
      <input type="number" id="limit" value="200">
      <button id="next">Next</button>
    </div>

    <div id="page_controls">
      <label for="page">Page:</label>
      <input type="number" id="page" min="1" value="1">
      <button id="go">Go</button>
    </div>

    <div id="search_controls">
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

    <div id="selection_controls">
      <label for="selectMode">
        <input type="checkbox" id="selectMode">Select Mode
      </label> 
      <button id="selectAll"><span>Select All</span></button>
      <button id="deleteSelected" disabled>Delete Selected</button>
    </div>

    <div id="display_controls">
      <label for="imagesOnly"><input type="checkbox" id="imagesOnly">Images only</label>
    </div>

    <div id="tag_controls">
      <label for="tag"><input type="checkbox" id="tag">Show tags</label>
    </div>
  </div>

  <div id="gallery"></div>

  <script>
    let limit = 200;
    let offset = 0;
    let selectedFiles = new Set();
    let searchTerm = '';
    let searchCap = null;
    let wholeWordsOnly = true;
    let sortMode = 'recent';
    let isDragging = false;
    let dragSelecting = true; // true = selecting, false = deselecting

    async function loadData() {
      let url;
      if( searchTerm ) {
        // Server-side search
        url = `data.php?searchTerm=${encodeURIComponent( searchTerm )}&wholeWords=${wholeWordsOnly}`;
        if( searchCap ) {
          url += `&searchLimit=${searchCap}`;
        }
      } else if( sortMode === 'style' || sortMode === 'prompt' ) {
        // For sorting, we still need full dataset
        url = `data.php?limit=999999&offset=0`;
      } else {
        // Normal pagination
        url = `data.php?limit=${limit}&offset=${offset}`;
      }
      const res = await fetch( url );
      const text = await res.text();
      
      // Debug: check if response is empty
      if( !text || text.trim() === '' ) {
        console.error( 'Empty response from server' );
        return;
      }
      
      let items;
      try {
        items = JSON.parse( text );
      } catch( e ) {
        console.error( 'JSON parse error:', e );
        console.error( 'Response text:', text.substring( 0, 500 ) );
        return;
      }

      // Sort by style if needed
      if( sortMode === 'style' && !searchTerm ) {
        items.sort( ( a, b ) => {
          const styleA = a.art_style || '';
          const styleB = b.art_style || '';
          // Empty styles go last
          if( !styleA && styleB ) return 1;
          if( styleA && !styleB ) return -1;
          if( styleA !== styleB ) {
            return styleA.localeCompare( styleB );
          }
          return 0; // maintain original order within same style
        } );
        // Apply pagination after sorting
        items = items.slice( offset, offset + limit );
      }

      // Group by prompt if needed
      if( sortMode === 'prompt' && !searchTerm ) {
        // Group items by prompt
        const promptGroups = new Map();
        items.forEach( item => {
          const prompt = item.prompt || '';
          if( !promptGroups.has( prompt ) ) {
            promptGroups.set( prompt, [] );
          }
          promptGroups.get( prompt ).push( item );
        } );

        // Sort groups by prompt, empty prompts last
        const sortedGroups = Array.from( promptGroups.entries() ).sort( ( a, b ) => {
          const promptA = a[0];
          const promptB = b[0];
          if( !promptA && promptB ) return 1;
          if( promptA && !promptB ) return -1;
          // Strip leading non-alphanumeric characters for sorting
          const cleanA = promptA.replace( /^[^a-zA-Z0-9]+/, '' );
          const cleanB = promptB.replace( /^[^a-zA-Z0-9]+/, '' );
          return cleanA.localeCompare( cleanB );
        } );

        // Apply pagination to groups
        const paginatedGroups = sortedGroups.slice( offset, offset + limit );
        
        // Flatten back to items for rendering
        items = paginatedGroups.flatMap( group => group[1] );
      } else if( sortMode === 'prompt' && searchTerm ) {
        // Group items by prompt for search results
        const promptGroups = new Map();
        items.forEach( item => {
          const prompt = item.prompt || '';
          if( !promptGroups.has( prompt ) ) {
            promptGroups.set( prompt, [] );
          }
          promptGroups.get( prompt ).push( item );
        } );
        
        // Keep grouped structure for rendering
        items.promptGrouped = promptGroups;
      }

      const gallery = document.getElementById( 'gallery' );
      gallery.innerHTML = '';

      // Server-side search already filtered the results
      let filtered = items;
      
      // Safeguard: ensure filtered is always an array
      if( !Array.isArray( filtered ) ) {
        console.error( 'filtered is not an array:', filtered );
        filtered = [];
      }

      // Group by prompt for rendering if in prompt mode
      if( sortMode === 'prompt' ) {
        const promptGroups = new Map();
        filtered.forEach( item => {
          if( !item.prompt ) return;
          const prompt = item.prompt;
          if( !promptGroups.has( prompt ) ) {
            promptGroups.set( prompt, [] );
          }
          promptGroups.get( prompt ).push( item );
        } );

        promptGroups.forEach( ( groupItems, prompt ) => {
          const card = document.createElement( 'div' );
          card.className = 'card';
          card.style.flexDirection = 'column';
          if( groupItems[0].art_style ) {
            card.setAttribute( 'art_style', groupItems[0].art_style );
          }

          // Top: metadata (skip if images-only mode active)
          const imagesOnlyActive = document.getElementById( 'imagesOnly' )?.checked;
          if( !imagesOnlyActive ) {
            const cardTop = document.createElement( 'div' );
            cardTop.className = 'card-right';

            // Use first item for metadata
            const item = groupItems[0];
            for( const [key, value] of Object.entries( item ) ) {
              if( key === 'filename' || key === 'date_downloaded' || key === 'title' ) continue;
              // Skip seed only if multiple images
              if( key === 'seed' && groupItems.length > 1 ) continue;
              if( key === 'negative_prompt' && !value ) continue;
              const p = document.createElement( 'p' );
              p.innerHTML = `<strong>${key}:</strong> ${value}`;
              cardTop.appendChild( p );
            }

            // Add tags section if Show tags is checked
            const showTags = document.getElementById( 'tag' )?.checked;
            if( showTags ) {
              const tagsContainer = document.createElement( 'div' );
              tagsContainer.className = 'tags-container';
              
              const updateBtn = document.createElement( 'button' );
              updateBtn.textContent = 'Update';
              
              const tagsInput = document.createElement( 'input' );
              tagsInput.type = 'text';
              tagsInput.placeholder = 'Enter tags...';
              tagsInput.value = item.tags || '';
              
              tagsContainer.appendChild( updateBtn );
              tagsContainer.appendChild( tagsInput );
              cardTop.appendChild( tagsContainer );
            }

            card.appendChild( cardTop );
          }

          // Bottom: all images for this prompt in a horizontal row
          const cardBottom = document.createElement( 'div' );
          cardBottom.style.display = 'flex';
          cardBottom.style.gap = '0.5em';
          cardBottom.style.flexWrap = 'wrap';

          groupItems.forEach( item => {
            const imgWrapper = document.createElement( 'div' );
            imgWrapper.style.display = 'flex';
            imgWrapper.style.flexDirection = 'column';
            imgWrapper.style.alignItems = 'center';
            
            const img = document.createElement( 'img' );
            img.src = `images/medium/${item.filename}`;
            img.dataset.filename = item.filename;
            img.style.maxWidth = '300px';
            img.style.cursor = 'pointer';
            
            // Apply selected class if already selected
            if( selectedFiles.has( item.filename ) ) {
              img.classList.add( 'selected' );
            }
            
            img.onclick = () => {
              // Skip if selectMode is active (handled by drag selection)
              const selectMode = document.getElementById( 'selectMode' ).checked;
              if( selectMode ) return;
              
              if( selectedFiles.has( item.filename ) ) {
                selectedFiles.delete( item.filename );
                img.classList.remove( 'selected' );
              } else {
                selectedFiles.add( item.filename );
                img.classList.add( 'selected' );
              }
              updateDeleteButton();
              updateSelectAllButton();
            };
            imgWrapper.appendChild( img );
            
            // Show seed below image only if there are multiple images
            if( item.seed && groupItems.length > 1 ) {
              const seedText = document.createElement( 'div' );
              seedText.textContent = `Seed: ${item.seed}`;
              seedText.style.fontSize = '0.85em';
              seedText.style.marginTop = '0.25em';
              imgWrapper.appendChild( seedText );
            }
            
            // Add tags below image if images-only mode is active and show tags is checked
            const imagesOnlyActive = document.getElementById( 'imagesOnly' )?.checked;
            const showTags = document.getElementById( 'tag' )?.checked;
            if( imagesOnlyActive && showTags ) {
              const tagsContainer = document.createElement( 'div' );
              tagsContainer.className = 'tags-container';
              tagsContainer.style.width = '300px';
              tagsContainer.style.marginTop = '0.5em';
              
              const updateBtn = document.createElement( 'button' );
              updateBtn.textContent = 'Update';
              
              const tagsInput = document.createElement( 'input' );
              tagsInput.type = 'text';
              tagsInput.placeholder = 'Enter tags...';
              tagsInput.value = item.tags || '';
              
              tagsContainer.appendChild( updateBtn );
              tagsContainer.appendChild( tagsInput );
              imgWrapper.appendChild( tagsContainer );
            }
            
            cardBottom.appendChild( imgWrapper );
          } );

          card.appendChild( cardBottom );
          gallery.appendChild( card );
        } );
      } else {
        // Normal rendering for non-prompt modes
        filtered.forEach( item => {
          if( !item.prompt ) return; // skip stubs

          const card = document.createElement( 'div' );
          card.className = 'card';
          if( item.art_style ) {
            card.setAttribute( 'art_style', item.art_style );
          }

          // Left side: image
          const cardLeft = document.createElement( 'div' );
          cardLeft.className = 'card-left';

          const img = document.createElement( 'img' );
          img.src = `images/medium/${item.filename}`;
          img.dataset.filename = item.filename;
          img.onclick = () => {
            // Skip if selectMode is active (handled by drag selection)
            const selectMode = document.getElementById( 'selectMode' ).checked;
            if( selectMode ) return;
            
            if( selectedFiles.has( item.filename ) ) {
              selectedFiles.delete( item.filename );
              img.classList.remove( 'selected' );
            } else {
              selectedFiles.add( item.filename );
              img.classList.add( 'selected' );
            }
            updateDeleteButton();
            updateSelectAllButton();
          };
          cardLeft.appendChild( img );

          // Add tags below image if images-only mode is active and show tags is checked
          const imagesOnlyActive = document.getElementById( 'imagesOnly' )?.checked;
          const showTags = document.getElementById( 'tag' )?.checked;
          if( imagesOnlyActive && showTags ) {
            const tagsContainer = document.createElement( 'div' );
            tagsContainer.className = 'tags-container';
            tagsContainer.style.width = '300px';
            tagsContainer.style.marginTop = '0.5em';
            
            const updateBtn = document.createElement( 'button' );
            updateBtn.textContent = 'Update';
            
            const tagsInput = document.createElement( 'input' );
            tagsInput.type = 'text';
            tagsInput.placeholder = 'Enter tags...';
            tagsInput.value = item.tags || '';
            
            tagsContainer.appendChild( updateBtn );
            tagsContainer.appendChild( tagsInput );
            cardLeft.appendChild( tagsContainer );
          }

          card.appendChild( cardLeft );

          // Right side: metadata (skip if images-only mode active)
          const imagesOnlyActive2 = document.getElementById( 'imagesOnly' )?.checked;
          if( !imagesOnlyActive2 ) {
            const cardRight = document.createElement( 'div' );
            cardRight.className = 'card-right';

            for( const [key, value] of Object.entries( item ) ) {
              if( key === 'filename' || key === 'date_downloaded' || key === 'title' ) continue;
              if( key === 'negative_prompt' && !value ) continue;
              const p = document.createElement( 'p' );
              p.innerHTML = `<strong>${key}:</strong> ${value}`;
              cardRight.appendChild( p );
            }

            // Add tags section if Show tags is checked
            const showTags = document.getElementById( 'tag' )?.checked;
            if( showTags ) {
              const tagsContainer = document.createElement( 'div' );
              tagsContainer.className = 'tags-container';
              
              const updateBtn = document.createElement( 'button' );
              updateBtn.textContent = 'Update';
              
              const tagsInput = document.createElement( 'input' );
              tagsInput.type = 'text';
              tagsInput.placeholder = 'Enter tags...';
              tagsInput.value = item.tags || '';
              
              tagsContainer.appendChild( updateBtn );
              tagsContainer.appendChild( tagsInput );
              cardRight.appendChild( tagsContainer );
            }

            card.appendChild( cardRight );
          }

          gallery.appendChild( card );
        } );
      }

      const currentPage = Math.floor( offset / limit ) + 1;
      document.getElementById( 'pageInfo' ).textContent =
        searchTerm
          ? `Search results: ${filtered.length} items`
          : ''//`Page ${currentPage}, showing ${items.length} items (offset ${offset})`;

      document.getElementById( 'page' ).value = currentPage;
      document.getElementById( 'prev' ).disabled = ( offset === 0 );
      document.getElementById( 'next' ).disabled = ( !searchTerm && items.length < limit );


      updateSelectAllButton();
    }

    function updateDeleteButton() {
      const btn = document.getElementById( 'deleteSelected' );
      btn.disabled = selectedFiles.size === 0;
    }

    function updateSelectAllButton() {
      const images = document.querySelectorAll( '#gallery img' );
      const allSelected = images.length > 0 && Array.from( images ).every( img => img.classList.contains( 'selected' ) );
      const selectAllBtn = document.getElementById( 'selectAll' );
      selectAllBtn.querySelector( 'span' ).textContent = allSelected ? 'Unselect All' : 'Select All';
    }

    async function performDelete() {
      if( selectedFiles.size === 0 ) return;
      if( !confirm( `Delete ${selectedFiles.size} selected image(s)? Metadata will remain.` ) ) return;

      try {
        const response = await fetch( 'delete.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify( { filenames: Array.from( selectedFiles ) } )
        } );
        
        const text = await response.text();
        console.log( 'Delete response text:', text );
        
        const result = JSON.parse( text );
        console.log( 'Delete response:', result );
        
        if( !result.success ) {
          alert( 'Failed to delete images' );
          return;
        }
      } catch( error ) {
        console.error( 'Delete error:', error );
        alert( 'Error deleting images: ' + error.message );
        return;
      }

      selectedFiles.clear();
      updateDeleteButton();
      loadData(); // silently refresh gallery
    }

    // Delete selected handler
    document.getElementById( 'deleteSelected' ).addEventListener( 'click', performDelete );

    // Delete key handler
    document.addEventListener( 'keydown', ( e ) => {
      if( e.key === 'Delete' ) {
        performDelete();
      }
    } );

    // Search listeners
    document.getElementById( 'search' ).addEventListener( 'input', e => {
      searchTerm = e.target.value.trim();
      offset = 0;
      loadData();
    } );

    document.getElementById( 'searchLimit' ).addEventListener( 'input', e => {
      const val = parseInt( e.target.value, 10 );
      searchCap = isNaN( val ) ? null : val;
      loadData();
    } );

    document.getElementById( 'wholeWords' ).addEventListener( 'change', e => {
      wholeWordsOnly = e.target.checked;
      loadData();
    } );

    document.getElementById( 'clearSearch' ).addEventListener( 'click', () => {
      searchTerm = '';
      searchCap = null;
      document.getElementById( 'search' ).value = '';
      document.getElementById( 'searchLimit' ).value = '';
      document.getElementById( 'wholeWords' ).checked = true;
      wholeWordsOnly = true;
      offset = 0;
      loadData();
    } );

    // Select All handler
    document.getElementById( 'selectAll' ).addEventListener( 'click', () => {
      const images = document.querySelectorAll( '#gallery img' );
      const allSelected = images.length > 0 && Array.from( images ).every( img => img.classList.contains( 'selected' ) );

      if( allSelected ) {
        // Unselect all
        images.forEach( img => {
          img.classList.remove( 'selected' );
          selectedFiles.delete( img.dataset.filename );
        } );
      } else {
        // Select all
        images.forEach( img => {
          img.classList.add( 'selected' );
          selectedFiles.add( img.dataset.filename );
        } );
      }

      updateDeleteButton();
      updateSelectAllButton();
    } );

    // Images-only toggle
    document.getElementById( 'imagesOnly' ).addEventListener( 'change', () => {
      const body = document.body;
      const isOn = document.getElementById( 'imagesOnly' ).checked;
      body.classList.toggle( 'images-only', isOn );
      // Reload cards to avoid generating hidden metadata for performance
      loadData();
    } );

    // Show tags toggle
    document.getElementById( 'tag' ).addEventListener( 'change', () => {
      loadData();
    } );

    // Sort mode listener
    document.getElementById( 'sort' ).addEventListener( 'change', e => {
      sortMode = e.target.value;
      offset = 0;
      loadData();
    } );

    // Pagination controls
    document.getElementById( 'limit' ).addEventListener( 'change', e => {
      limit = parseInt( e.target.value, 10 );
      offset = 0;
      loadData();
    } );
    document.getElementById( 'next' ).addEventListener( 'click', () => {
      offset += limit;
      loadData();
    } );
    document.getElementById( 'prev' ).addEventListener( 'click', () => {
      offset = Math.max( 0, offset - limit );
      loadData();
    } );
    document.getElementById( 'go' ).addEventListener( 'click', () => {
      const pageInput = parseInt( document.getElementById( 'page' ).value, 10 );
      if( !isNaN( pageInput ) && pageInput > 0 ) {
        offset = ( pageInput - 1 ) * limit;
        loadData();
      }
    } );

    // Adjust gallery top margin based on toolbar height
    function adjustGalleryMargin() {
      const toolbar = document.getElementById( 'toolbar' );
      const gallery = document.getElementById( 'gallery' );
      const toolbarHeight = toolbar.offsetHeight;
      gallery.style.marginTop = toolbarHeight + 'px';
    }

    // Initial load
    loadData();
    
    // Adjust margin on load and resize
    adjustGalleryMargin();
    window.addEventListener( 'resize', adjustGalleryMargin );

    // Drag selection functionality
    document.addEventListener( 'mousedown', ( e ) => {
      const selectMode = document.getElementById( 'selectMode' ).checked;
      if( !selectMode ) return;
      
      // Prevent text selection when in select mode
      if( e.target.closest( '#gallery' ) ) {
        e.preventDefault();
        isDragging = true; // Start dragging even if not on an image
      }
      
      const img = e.target.closest( 'img' );
      if( img && img.dataset.filename ) {
        // Determine if we're selecting or deselecting based on first image
        dragSelecting = !selectedFiles.has( img.dataset.filename );
        
        // Apply selection to the first image immediately
        if( dragSelecting ) {
          selectedFiles.add( img.dataset.filename );
          img.classList.add( 'selected' );
        } else {
          selectedFiles.delete( img.dataset.filename );
          img.classList.remove( 'selected' );
        }
        updateDeleteButton();
        updateSelectAllButton();
      } else if( e.target.closest( '#gallery' ) ) {
        // If clicked in gallery but not on image, default to selecting mode
        dragSelecting = true;
      }
    } );

    document.addEventListener( 'mouseover', ( e ) => {
      if( !isDragging ) return;
      
      const img = e.target.closest( 'img' );
      if( img && img.dataset.filename ) {
        if( dragSelecting ) {
          selectedFiles.add( img.dataset.filename );
          img.classList.add( 'selected' );
        } else {
          selectedFiles.delete( img.dataset.filename );
          img.classList.remove( 'selected' );
        }
        updateDeleteButton();
        updateSelectAllButton();
      }
    } );

    document.addEventListener( 'mouseup', () => {
      isDragging = false;
    } );
  </script>
</body>
</html>