// Load saved state from localStorage
let limit = parseInt( localStorage.getItem( 'limit' ) ) || 200;
let offset = parseInt( localStorage.getItem( 'offset' ) ) || 0;
let selectedFiles = new Set();
let searchString = localStorage.getItem( 'searchString' ) || '';
let searchBy = localStorage.getItem( 'searchBy' ) || 'prompt';
let searchCap = localStorage.getItem( 'searchCap' ) ? parseInt( localStorage.getItem( 'searchCap' ) ) : null;
let wholeWordsOnly = localStorage.getItem( 'wholeWordsOnly' ) === 'false' ? false : true;
let sortMode = localStorage.getItem( 'sortMode' ) || 'recent';
let isDragging = false;
let dragSelecting = true; // true = selecting, false = deselecting

// Initialize UI from saved state
document.getElementById( 'limit' ).value = limit;
document.getElementById( 'search' ).value = searchString;
document.getElementById( 'search_by' ).value = searchBy;
if( searchCap ) document.getElementById( 'searchLimit' ).value = searchCap;
document.getElementById( 'wholeWords' ).checked = wholeWordsOnly;
document.getElementById( 'sort_by' ).value = sortMode;
document.getElementById( 'imagesOnly' ).checked = localStorage.getItem( 'imagesOnly' ) === 'true';
document.getElementById( 'tag' ).checked = localStorage.getItem( 'showTags' ) === 'true';
document.getElementById( 'selectMode' ).checked = localStorage.getItem( 'selectMode' ) === 'true';

// Apply images-only class to body if set
if( document.getElementById( 'imagesOnly' ).checked ) {
  document.body.classList.add( 'images-only' );
}

/**
 * Updates tags for an image and all images with the same prompt combination.
 * Sends a POST request to the server and reloads the gallery on success.
 * @param {string} filename - The filename of the image to update
 * @param {string} tagsString - Comma-separated string of tags
 */
async function updateTags( filename, tagsString ) {
  try {
    const response = await fetch( 'api/update_tags.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify( { filename, tags: tagsString } )
    } );
    const result = await response.json();
    if( result.success ) {
      loadData(); // Reload to show updated tags
    } else {
      console.error( 'Error updating tags:', result.error );
    }
  } catch( error ) {
    console.error( 'Error updating tags:', error.message );
  }
}

/**
 * Creates a tag input container with an input field and Enter key handler.
 * @param {Object} item - The image item containing tags array
 * @param {Object} containerStyles - Optional CSS styles to apply to the container
 * @returns {HTMLElement} The tags container div element
 */
function createTagInput( item, containerStyles = {} ) {
  const tagsContainer = document.createElement( 'div' );
  tagsContainer.className = 'tags-container';

  // Apply any custom styles
  Object.assign( tagsContainer.style, containerStyles );

  const tagsInput = document.createElement( 'input' );
  tagsInput.type = 'text';
  tagsInput.placeholder = 'Enter tags (comma-separated)...';
  // Convert tags array to comma-separated string
  tagsInput.value = Array.isArray( item.tags ) ? item.tags.join( ', ' ) : '';

  // Add Enter key handler
  tagsInput.addEventListener( 'keypress', ( e ) => {
    if( e.key === 'Enter' ) {
      e.preventDefault();
      updateTags( item.filename, tagsInput.value );
    }
  } );

  tagsContainer.appendChild( tagsInput );
  return tagsContainer;
}

/**
 * Creates an image element with click selection handler and selected state.
 * Handles both single-click selection and select mode (drag selection).
 * @param {Object} item - The image item containing filename and metadata
 * @returns {HTMLElement} The img element with event handlers attached
 */
function createImageElement( item ) {
  const img = document.createElement( 'img' );
  img.src = `../images/medium/${item.filename}`;
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

  return img;
}

/**
 * Renders metadata key-value pairs as paragraph elements.
 * Filters out specified keys and empty negative_prompt values.
 * @param {Object} item - The image item containing metadata
 * @param {Array} skipKeys - Array of key names to exclude from rendering
 * @returns {DocumentFragment} Fragment containing paragraph elements
 */
function renderMetadata( item, skipKeys = [] ) {
  const fragment = document.createDocumentFragment();

  for( const [key, value] of Object.entries( item ) ) {
    if( skipKeys.includes( key ) ) continue;
    if( key === 'negative_prompt' && !value ) continue;

    const p = document.createElement( 'p' );
    p.innerHTML = `<strong>${key}:</strong> ${value}`;
    fragment.appendChild( p );
  }

  return fragment;
}

/**
 * Renders gallery in prompt grouping mode.
 * Groups images by prompt and displays them horizontally with shared metadata.
 * Shows individual seeds when multiple images share the same prompt.
 * @param {Array} filtered - Array of image items to render
 * @param {HTMLElement} gallery - The gallery container element
 */
function renderPromptMode( filtered, gallery ) {
  const promptGroups = new Map();
  filtered.forEach( item => {
    if( !item.prompt ) return;
    const prompt = item.prompt;
    if( !promptGroups.has( prompt ) ) {
      promptGroups.set( prompt, [] );
    }
    promptGroups.get( prompt ).push( item );
  } );

  const imagesOnlyActive = document.getElementById( 'imagesOnly' )?.checked;
  const showTags = document.getElementById( 'tag' )?.checked;

  promptGroups.forEach( ( groupItems, prompt ) => {
    const card = document.createElement( 'div' );
    card.className = 'card';
    card.style.flexDirection = 'column';
    if( groupItems[0].art_style ) {
      card.setAttribute( 'art_style', groupItems[0].art_style );
    }

    // Top: metadata (skip if images-only mode active)
    if( !imagesOnlyActive ) {
      const cardTop = document.createElement( 'div' );
      cardTop.className = 'card-right';

      const item = groupItems[0];
      const skipKeys = ['filename', 'date_downloaded', 'title', 'tags'];
      if( groupItems.length > 1 ) skipKeys.push( 'seed' );

      cardTop.appendChild( renderMetadata( item, skipKeys ) );
      card.appendChild( cardTop );
    }

    // Bottom: all images for this prompt in a horizontal row
    const cardBottom = document.createElement( 'div' );
    cardBottom.style.display = 'flex';
    cardBottom.style.gap = '1em';
    cardBottom.style.flexWrap = 'wrap';

    groupItems.forEach( item => {
      const imgWrapper = document.createElement( 'div' );
      imgWrapper.style.display = 'flex';
      imgWrapper.style.flexDirection = 'column';
      imgWrapper.style.alignItems = 'center';

      imgWrapper.appendChild( createImageElement( item ) );

      // Show seed below image only if there are multiple images AND not in images-only mode
      if( item.seed && groupItems.length > 1 && !imagesOnlyActive ) {
        const seedText = document.createElement( 'div' );
        seedText.textContent = `Seed: ${item.seed}`;
        seedText.style.fontSize = '0.85em';
        seedText.style.marginTop = '0.75em';
        imgWrapper.appendChild( seedText );
      }

      // Add tags below image if images-only mode is active and show tags is checked
      if( imagesOnlyActive && showTags ) {
        const tagsInput = createTagInput( item, { width: '300px', marginTop: '0.5em' } );
        imgWrapper.appendChild( tagsInput );
      }

      cardBottom.appendChild( imgWrapper );
    } );

    card.appendChild( cardBottom );

    // Add tags section after images if Show tags is checked and not in images-only mode
    if( showTags && !imagesOnlyActive ) {
      const item = groupItems[0];
      const tagsInput = createTagInput( item, {
        marginTop: '-0.25em',
        marginBottom: '0.5em'
      } );
      card.appendChild( tagsInput );
    }

    gallery.appendChild( card );
  } );
}

/**
 * Renders gallery in normal mode (card layout with image on left, metadata on right).
 * Used for 'recent' and 'style' sort modes.
 * @param {Array} filtered - Array of image items to render
 * @param {HTMLElement} gallery - The gallery container element
 */
function renderNormalMode( filtered, gallery ) {
  const imagesOnlyActive = document.getElementById( 'imagesOnly' )?.checked;
  const showTags = document.getElementById( 'tag' )?.checked;

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

    cardLeft.appendChild( createImageElement( item ) );

    // Add tags below image if images-only mode is active and show tags is checked
    if( imagesOnlyActive && showTags ) {
      const tagsInput = createTagInput( item, { width: '300px', marginTop: '0.5em' } );
      cardLeft.appendChild( tagsInput );
    }

    card.appendChild( cardLeft );

    // Right side: metadata (skip if images-only mode active)
    if( !imagesOnlyActive ) {
      const cardRight = document.createElement( 'div' );
      cardRight.className = 'card-right';

      const skipKeys = ['filename', 'date_downloaded', 'title', 'tags'];
      cardRight.appendChild( renderMetadata( item, skipKeys ) );

      // Add tags section if Show tags is checked
      if( showTags ) {
        const tagsInput = createTagInput( item );
        cardRight.appendChild( tagsInput );
      }

      card.appendChild( cardRight );
    }

    gallery.appendChild( card );
  } );
}

/**
 * Fetches and renders gallery data from the server.
 * Handles both search queries and paginated results.
 * Determines which render mode to use based on sortMode.
 * Updates pagination controls and page info after rendering.
 */
async function loadData() {

  let url;

  if( searchString ) {

    // Server-side search
    url = `api/data.php?searchTerm=${encodeURIComponent( searchString )
      }&searchBy=${searchBy
      }&wholeWords=${wholeWordsOnly
      }&sort=${sortMode
      }`;

    if( searchCap ) {
      url += `&searchLimit=${searchCap}`;
    }

  } else {

    // Normal pagination with sorting
    url = `api/data.php?limit=${limit
      }&offset=${offset
      }&sort=${sortMode
      }`;
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

  const gallery = document.getElementById( 'gallery' );
  gallery.innerHTML = '';

  // Safeguard: ensure items is always an array
  if( !Array.isArray( items ) ) {
    console.error( 'items is not an array:', items );
    items = [];
  }

  // Render gallery based on sort mode
  if( sortMode === 'prompt' ) {
    renderPromptMode( items, gallery );
  } else {
    renderNormalMode( items, gallery );
  }

  // Update pagination controls
  const currentPage = Math.floor( offset / limit ) + 1;
  document.getElementById( 'pageInfo' ).textContent =
    searchString
      ? `Search results: ${items.length} items`
      : '';

  document.getElementById( 'page' ).value = currentPage;
  document.getElementById( 'prev' ).disabled = ( offset === 0 );
  document.getElementById( 'next' ).disabled = ( !searchString && items.length < limit );

  updateSelectAllButton();
}

/**
 * Updates the delete button's disabled state based on selection count.
 */
function updateDeleteButton() {
  const btn = document.getElementById( 'deleteSelected' );
  btn.disabled = selectedFiles.size === 0;
}

/**
 * Updates the select all button text based on current selection state.
 * Shows "Unselect All" when all images are selected, "Select All" otherwise.
 */
function updateSelectAllButton() {
  const images = document.querySelectorAll( '#gallery img' );
  const allSelected = images.length > 0 && Array.from( images ).every( img => img.classList.contains( 'selected' ) );
  const selectAllBtn = document.getElementById( 'selectAll' );
  selectAllBtn.querySelector( 'span' ).textContent = allSelected ? 'Unselect All' : 'Select All';
}

/**
 * Deletes selected images after user confirmation.
 * Sends DELETE request to server, clears selection, and reloads gallery.
 */
async function performDelete() {
  if( selectedFiles.size === 0 ) return;
  if( !confirm( `Delete ${selectedFiles.size} selected image(s)? Metadata will remain.` ) ) return;

  try {
    const response = await fetch( 'api/delete.php', {
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
const searchInput = document.getElementById( 'search' );

// Update search string as user types (but don't reload data yet)
searchInput.addEventListener( 'input', e => {
  searchString = e.target.value.trim();
  localStorage.setItem( 'searchString', searchString );
} );

// Reload data when Enter is pressed
searchInput.addEventListener( 'keypress', e => {
  if( e.key === 'Enter' ) {
    offset = 0;
    localStorage.setItem( 'offset', offset );
    loadData();
  }
} );

// Reload data when search box loses focus (blur)
searchInput.addEventListener( 'blur', () => {
  offset = 0;
  localStorage.setItem( 'offset', offset );
  loadData();
} );

document.getElementById( 'searchLimit' ).addEventListener( 'input', e => {
  const val = parseInt( e.target.value, 10 );
  searchCap = isNaN( val ) ? null : val;
  if( searchCap ) {
    localStorage.setItem( 'searchCap', searchCap );
  } else {
    localStorage.removeItem( 'searchCap' );
  }
  loadData();
} );

document.getElementById( 'wholeWords' ).addEventListener( 'change', e => {
  wholeWordsOnly = e.target.checked;
  localStorage.setItem( 'wholeWordsOnly', wholeWordsOnly );
  loadData();
} );

document.getElementById( 'search_by' ).addEventListener( 'change', e => {
  searchBy = e.target.value;
  localStorage.setItem( 'searchBy', searchBy );
  offset = 0;
  localStorage.setItem( 'offset', offset );
  loadData();
} );

document.getElementById( 'clearSearch' ).addEventListener( 'click', () => {
  searchString = '';
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
  localStorage.setItem( 'imagesOnly', isOn );
  // Reload cards to avoid generating hidden metadata for performance
  loadData();
} );

// Show tags toggle
document.getElementById( 'tag' ).addEventListener( 'change', () => {
  localStorage.setItem( 'showTags', document.getElementById( 'tag' ).checked );
  loadData();
} );

// Select mode toggle
document.getElementById( 'selectMode' ).addEventListener( 'change', () => {
  localStorage.setItem( 'selectMode', document.getElementById( 'selectMode' ).checked );
} );

// Sort mode listener
document.getElementById( 'sort_by' ).addEventListener( 'change', e => {
  sortMode = e.target.value;
  localStorage.setItem( 'sortMode', sortMode );
  offset = 0;
  localStorage.setItem( 'offset', offset );
  loadData();
} );

// Pagination controls
document.getElementById( 'limit' ).addEventListener( 'change', e => {
  limit = parseInt( e.target.value, 10 );
  localStorage.setItem( 'limit', limit );
  offset = 0;
  localStorage.setItem( 'offset', offset );
  loadData();
} );
document.getElementById( 'next' ).addEventListener( 'click', () => {
  offset += limit;
  localStorage.setItem( 'offset', offset );
  loadData();
} );
document.getElementById( 'prev' ).addEventListener( 'click', () => {
  offset = Math.max( 0, offset - limit );
  localStorage.setItem( 'offset', offset );
  loadData();
} );
document.getElementById( 'go' ).addEventListener( 'click', () => {
  const pageInput = parseInt( document.getElementById( 'page' ).value, 10 );
  if( !isNaN( pageInput ) && pageInput > 0 ) {
    offset = ( pageInput - 1 ) * limit;
    localStorage.setItem( 'offset', offset );
    loadData();
  }
} );

/**
 * Adjusts the gallery's top margin to match the toolbar height.
 * Ensures toolbar doesn't overlap gallery content when it wraps to multiple lines.
 */
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
