// ============================================
// Initialize reusable classes
// ============================================

// State management with localStorage persistence
const state = new GalleryState( 'gallery', {
  limit: 200,
  offset: 0,
  searchString: '',
  searchBy: 'prompt',
  sortMode: 'recent',
  wholeWordsOnly: true,
  searchCap: null,
  imagesOnly: false,
  showTags: false,
  selectMode: false
} );

// API client for server communication
const api = new APIClient( 'api/' );

// Image selector for drag-to-select functionality
const selector = new ImageSelector( {
  selectedClass: 'selected',
  itemSelector: 'img',
  onChange: ( selectedIds ) => {
    updateDeleteButton();
    updateSelectAllButton();
  }
} );


// ============================================
// Initialize UI from saved state
// ============================================

// Extract state values to variables for convenience
let limit = state.get( 'limit' );
let offset = state.get( 'offset' );
let searchString = state.get( 'searchString' );
let searchBy = state.get( 'searchBy' );
let sortMode = state.get( 'sortMode' );
let wholeWordsOnly = state.get( 'wholeWordsOnly' );
let searchCap = state.get( 'searchCap' );

DOMHelper.query( '#limit' ).value = limit;
DOMHelper.query( '#search' ).value = searchString;
DOMHelper.query( '#search_by' ).value = searchBy;
if( searchCap ) DOMHelper.query( '#searchLimit' ).value = searchCap;
DOMHelper.query( '#wholeWords' ).checked = wholeWordsOnly;
DOMHelper.query( '#sort_by' ).value = sortMode;
DOMHelper.query( '#imagesOnly' ).checked = state.get( 'imagesOnly' );
DOMHelper.query( '#tag' ).checked = state.get( 'showTags' );
DOMHelper.query( '#selectMode' ).checked = state.get( 'selectMode' );

// Apply images-only class to body if set
if( state.get( 'imagesOnly' ) ) {
  document.body.classList.add( 'images-only' );
}

// Enable selector if selectMode is active
if( state.get( 'selectMode' ) ) {
  selector.enable( DOMHelper.query( '#gallery' ) );
}

/**
 * Updates tags for an image and all images with the same prompt combination.
 * Sends a POST request to the server and reloads the gallery on success.
 * @param {string} filename - The filename of the image to update
 * @param {string} tagsString - Comma-separated string of tags
 */
async function updateTags( filename, tagsString ) {
  try {
    const result = await api.post( 'update_tags.php', {
      filename,
      tags: tagsString
    } );
    
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
  return DOMHelper.div( {
    class: 'tags-container',
    styles: containerStyles,
    children: [
      DOMHelper.input( 'text', {
        attrs: {
          placeholder: 'Enter tags (comma-separated)...',
          value: Array.isArray( item.tags ) ? item.tags.join( ', ' ) : ''
        },
        events: {
          keypress: ( e ) => {
            if( e.key === 'Enter' ) {
              e.preventDefault();
              updateTags( item.filename, e.target.value );
            }
          }
        }
      } )
    ]
  } );
}

/**
 * Creates an image element with click selection handler and selected state.
 * Handles both single-click selection and select mode (drag selection).
 * @param {Object} item - The image item containing filename and metadata
 * @returns {HTMLElement} The img element with event handlers attached
 */
function createImageElement( item ) {
  return DOMHelper.img( `../images/medium/${item.filename}`, {
    class: selector.isSelected( item.filename ) ? 'selected' : '',
    data: { filename: item.filename },
    styles: { maxWidth: '300px', cursor: 'pointer' },
    events: {
      click: function() {
        // Skip if selectMode is active (handled by drag selection)
        if( state.get( 'selectMode' ) ) return;
        
        selector.toggle( item.filename, this );
      }
    }
  } );
}

/**
 * Renders metadata key-value pairs as paragraph elements.
 * Filters out specified keys and empty negative_prompt values.
 * @param {Object} item - The image item containing metadata
 * @param {Array} skipKeys - Array of key names to exclude from rendering
 * @returns {DocumentFragment} Fragment containing paragraph elements
 */
function renderMetadata( item, skipKeys = [] ) {
  const paragraphs = [];
  
  for( const [key, value] of Object.entries( item ) ) {
    if( skipKeys.includes( key ) ) continue;
    if( key === 'negative_prompt' && !value ) continue;

    paragraphs.push(
      DOMHelper.p( '', {
        html: `<strong>${key}:</strong> ${value}`
      } )
    );
  }
  
  return DOMHelper.fragment( paragraphs );
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

  const imagesOnlyActive = state.get( 'imagesOnly' );
  const showTags = state.get( 'showTags' );

  promptGroups.forEach( ( groupItems, prompt ) => {
    const card = DOMHelper.div( {
      class: 'card',
      styles: { flexDirection: 'column' },
      attrs: groupItems[0].art_style ? { art_style: groupItems[0].art_style } : {}
    } );

    // Top: metadata (skip if images-only mode active)
    if( !imagesOnlyActive ) {
      const item = groupItems[0];
      const skipKeys = ['filename', 'date_downloaded', 'title', 'tags'];
      if( groupItems.length > 1 ) skipKeys.push( 'seed' );

      const cardTop = DOMHelper.div( {
        class: 'card-right',
        children: renderMetadata( item, skipKeys )
      } );
      
      card.appendChild( cardTop );
    }

    // Bottom: all images for this prompt in a horizontal row
    const imageWrappers = groupItems.map( item => {
      const wrapper = DOMHelper.div( {
        styles: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        },
        children: [createImageElement( item )]
      } );

      // Show seed below image only if there are multiple images AND not in images-only mode
      if( item.seed && groupItems.length > 1 && !imagesOnlyActive ) {
        wrapper.appendChild(
          DOMHelper.div( {
            text: `Seed: ${item.seed}`,
            styles: { fontSize: '0.85em', marginTop: '0.75em' }
          } )
        );
      }

      // Add tags below image if images-only mode is active and show tags is checked
      if( imagesOnlyActive && showTags ) {
        wrapper.appendChild(
          createTagInput( item, { width: '300px', marginTop: '0.5em' } )
        );
      }

      return wrapper;
    } );

    const cardBottom = DOMHelper.div( {
      styles: {
        display: 'flex',
        gap: '1em',
        flexWrap: 'wrap'
      },
      children: imageWrappers
    } );

    card.appendChild( cardBottom );

    // Add tags section after images if Show tags is checked and not in images-only mode
    if( showTags && !imagesOnlyActive ) {
      card.appendChild(
        createTagInput( groupItems[0], {
          marginTop: '-0.25em',
          marginBottom: '0.5em'
        } )
      );
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
  const imagesOnlyActive = state.get( 'imagesOnly' );
  const showTags = state.get( 'showTags' );

  filtered.forEach( item => {
    if( !item.prompt ) return; // skip stubs

    const card = DOMHelper.div( {
      class: 'card',
      attrs: item.art_style ? { art_style: item.art_style } : {}
    } );

    // Left side: image
    const cardLeftChildren = [createImageElement( item )];

    // Add tags below image if images-only mode is active and show tags is checked
    if( imagesOnlyActive && showTags ) {
      cardLeftChildren.push(
        createTagInput( item, { width: '300px', marginTop: '0.5em' } )
      );
    }

    const cardLeft = DOMHelper.div( {
      class: 'card-left',
      children: cardLeftChildren
    } );

    card.appendChild( cardLeft );

    // Right side: metadata (skip if images-only mode active)
    if( !imagesOnlyActive ) {
      const skipKeys = ['filename', 'date_downloaded', 'title', 'tags'];
      const cardRightChildren = renderMetadata( item, skipKeys );

      // Add tags section if Show tags is checked
      if( showTags ) {
        cardRightChildren.push( createTagInput( item ) );
      }

      const cardRight = DOMHelper.div( {
        class: 'card-right',
        children: cardRightChildren
      } );

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
  const params = {};

  if( searchString ) {
    // Server-side search
    params.searchTerm = searchString;
    params.searchBy = searchBy;
    params.wholeWords = wholeWordsOnly;
    params.sort = sortMode;

    if( searchCap ) {
      params.searchLimit = searchCap;
    }
  } else {
    // Normal pagination with sorting
    params.limit = limit;
    params.offset = offset;
    params.sort = sortMode;
  }

  const items = await api.get( 'api/data.php', params );

  // Safeguard: ensure items is always an array
  if( !Array.isArray( items ) ) {
    console.error( 'items is not an array:', items );
    return;
  }

  const gallery = DOMHelper.query( '#gallery' );
  gallery.innerHTML = '';

  // Render gallery based on sort mode
  if( sortMode === 'prompt' ) {
    renderPromptMode( items, gallery );
  } else {
    renderNormalMode( items, gallery );
  }

  // Update pagination controls
  const currentPage = Math.floor( offset / limit ) + 1;
  DOMHelper.query( '#pageInfo' ).textContent =
    searchString
      ? `Search results: ${items.length} items`
      : '';

  DOMHelper.query( '#page' ).value = currentPage;
  DOMHelper.query( '#prev' ).disabled = ( offset === 0 );
  DOMHelper.query( '#next' ).disabled = ( !searchString && items.length < limit );

  updateSelectAllButton();
}

/**
 * Updates the delete button's disabled state based on selection count.
 */
function updateDeleteButton() {
  DOMHelper.query( '#deleteSelected' ).disabled = selector.getSelected().size === 0;
}

/**
 * Updates the select all button text based on current selection state.
 * Shows "Unselect All" when all images are selected, "Select All" otherwise.
 */
function updateSelectAllButton() {
  const images = DOMHelper.queryAll( '#gallery img' );
  const allSelected = images.length > 0 && Array.from( images ).every( img => img.classList.contains( 'selected' ) );
  const selectAllBtn = DOMHelper.query( '#selectAll' );
  selectAllBtn.querySelector( 'span' ).textContent = allSelected ? 'Unselect All' : 'Select All';
}

/**
 * Deletes selected images after user confirmation.
 * Sends DELETE request to server, clears selection, and reloads gallery.
 */
async function performDelete() {
  const selected = selector.getSelected();
  if( selected.size === 0 ) return;
  if( !confirm( `Delete ${selected.size} selected image(s)? Metadata will remain.` ) ) return;

  try {
    const result = await api.post( 'api/delete.php', { filenames: Array.from( selected ) } );

    if( !result.success ) {
      alert( 'Failed to delete images' );
      return;
    }
  } catch( error ) {
    console.error( 'Delete error:', error );
    alert( 'Error deleting images: ' + error.message );
    return;
  }

  selector.deselectAll();
  updateDeleteButton();
  loadData(); // silently refresh gallery
}

// Delete selected handler
DOMHelper.query( '#deleteSelected' ).addEventListener( 'click', performDelete );

// Delete key handler
document.addEventListener( 'keydown', ( e ) => {
  if( e.key === 'Delete' ) {
    performDelete();
  }
} );

// Search listeners
const searchInput = DOMHelper.query( '#search' );

// Update search string as user types (but don't reload data yet)
searchInput.addEventListener( 'input', e => {
  searchString = e.target.value.trim();
  state.set( 'searchString', searchString );
} );

// Reload data when Enter is pressed
searchInput.addEventListener( 'keypress', e => {
  if( e.key === 'Enter' ) {
    offset = 0;
    state.set( 'offset', offset );
    loadData();
  }
} );

// Reload data when search box loses focus (blur)
searchInput.addEventListener( 'blur', () => {
  offset = 0;
  state.set( 'offset', offset );
  loadData();
} );

DOMHelper.query( '#searchLimit' ).addEventListener( 'input', e => {
  const val = parseInt( e.target.value, 10 );
  searchCap = isNaN( val ) ? null : val;
  if( searchCap ) {
    state.set( 'searchCap', searchCap );
  } else {
    state.remove( 'searchCap' );
  }
  loadData();
} );

DOMHelper.query( '#wholeWords' ).addEventListener( 'change', e => {
  wholeWordsOnly = e.target.checked;
  state.set( 'wholeWordsOnly', wholeWordsOnly );
  loadData();
} );

DOMHelper.query( '#search_by' ).addEventListener( 'change', e => {
  searchBy = e.target.value;
  state.set( 'searchBy', searchBy );
  offset = 0;
  state.set( 'offset', offset );
  loadData();
} );

DOMHelper.query( '#clearSearch' ).addEventListener( 'click', () => {
  searchString = '';
  searchCap = null;
  DOMHelper.query( '#search' ).value = '';
  DOMHelper.query( '#searchLimit' ).value = '';
  DOMHelper.query( '#wholeWords' ).checked = true;
  wholeWordsOnly = true;
  offset = 0;
  loadData();
} );

// Select All handler
DOMHelper.query( '#selectAll' ).addEventListener( 'click', () => {
  const images = DOMHelper.queryAll( '#gallery img' );
  const allSelected = images.length > 0 && Array.from( images ).every( img => selector.isSelected( img.dataset.filename ) );

  if( allSelected ) {
    selector.deselectAll();
  } else {
    selector.selectAll( Array.from( images ).map( img => img.dataset.filename ) );
  }

  updateDeleteButton();
  updateSelectAllButton();
} );

// Images-only toggle
DOMHelper.query( '#imagesOnly' ).addEventListener( 'change', () => {
  const isOn = DOMHelper.query( '#imagesOnly' ).checked;
  document.body.classList.toggle( 'images-only', isOn );
  state.set( 'imagesOnly', isOn );
  // Reload cards to avoid generating hidden metadata for performance
  loadData();
} );

// Show tags toggle
DOMHelper.query( '#tag' ).addEventListener( 'change', () => {
  state.set( 'showTags', DOMHelper.query( '#tag' ).checked );
  loadData();
} );

// Select mode toggle
DOMHelper.query( '#selectMode' ).addEventListener( 'change', () => {
  const selectModeOn = DOMHelper.query( '#selectMode' ).checked;
  state.set( 'selectMode', selectModeOn );
  
  if( selectModeOn ) {
    selector.enable( DOMHelper.query( '#gallery' ) );
  } else {
    selector.disable();
  }
} );

// Sort mode listener
DOMHelper.query( '#sort_by' ).addEventListener( 'change', e => {
  sortMode = e.target.value;
  state.set( 'sortMode', sortMode );
  offset = 0;
  state.set( 'offset', offset );
  loadData();
} );

// Pagination controls
DOMHelper.query( '#limit' ).addEventListener( 'change', e => {
  limit = parseInt( e.target.value, 10 );
  state.set( 'limit', limit );
  offset = 0;
  state.set( 'offset', offset );
  loadData();
} );
DOMHelper.query( '#next' ).addEventListener( 'click', () => {
  offset += limit;
  state.set( 'offset', offset );
  loadData();
} );
DOMHelper.query( '#prev' ).addEventListener( 'click', () => {
  offset = Math.max( 0, offset - limit );
  state.set( 'offset', offset );
  loadData();
} );
DOMHelper.query( '#go' ).addEventListener( 'click', () => {
  const pageInput = parseInt( DOMHelper.query( '#page' ).value, 10 );
  if( !isNaN( pageInput ) && pageInput > 0 ) {
    offset = ( pageInput - 1 ) * limit;
    state.set( 'offset', offset );
    loadData();
  }
} );

/**
 * Adjusts the gallery's top margin to match the toolbar height.
 * Ensures toolbar doesn't overlap gallery content when it wraps to multiple lines.
 */
function adjustGalleryMargin() {
  const toolbar = DOMHelper.query( '#toolbar' );
  const gallery = DOMHelper.query( '#gallery' );
  const toolbarHeight = toolbar.offsetHeight;
  gallery.style.marginTop = toolbarHeight + 'px';
}

// Initial load
loadData();

// Adjust margin on load and resize
adjustGalleryMargin();
window.addEventListener( 'resize', adjustGalleryMargin );

// Enable drag selection if select mode is active
if( state.get( 'selectMode' ) ) {
  selector.enable( DOMHelper.query( '#gallery' ) );
}
