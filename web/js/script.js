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
  imagesOnly: false,
  showTags: false,
  showHidden: false
} );

// API client for server communication
const api = new APIClient();

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

DOMHelper.query( '#limit' ).value = limit;
DOMHelper.query( '#search' ).value = searchString;
DOMHelper.query( '#search_by' ).value = searchBy;
DOMHelper.query( '#wholeWords' ).checked = wholeWordsOnly;
DOMHelper.query( '#sort_by' ).value = sortMode;
DOMHelper.query( '#imagesOnly' ).checked = state.get( 'imagesOnly' );
DOMHelper.query( '#tag' ).checked = state.get( 'showTags' );
DOMHelper.query( '#showHidden' ).checked = state.get( 'showHidden' );

// Reset offset when search is active to avoid showing no results
if( searchString ) {
  offset = 0;
  state.set( 'offset', 0 );
}

// Apply images-only class to body if set
if( state.get( 'imagesOnly' ) ) {
  document.body.classList.add( 'images-only' );
}

// Apply show-tags class to body if set
if( state.get( 'showTags' ) ) {
  document.body.classList.add( 'show-tags' );
}

// Always enable selector
selector.enable( DOMHelper.query( '#gallery' ) );

/**
 * Updates tags for an image and all images with the same prompt combination.
 * Sends a POST request to the server and reloads the gallery on success.
 * @param {string} filename - The filename of the image to update
 * @param {string} tagsString - Comma-separated string of tags
 */
async function updateTags( filename, tagsString ) {
  console.log( 'updateTags called:', filename, tagsString );
  try {
    const result = await api.post( 'api/update_tags.php', {
      filename,
      tags: tagsString
    } );

    console.log( 'updateTags result:', result );

    if( result.success ) {
      console.log( 'Tags updated successfully, reloading data...' );
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
 * Creates an image element with selected state.
 * Selection is handled by ImageSelector (click and drag).
 * @param {Object} item - The image item containing filename and metadata
 * @returns {HTMLElement} The img element
 */
function createImageElement( item ) {
  return DOMHelper.img( `../images/medium/${item.filename}`, {
    class: selector.isSelected( item.filename ) ? 'selected' : '',
    data: { filename: item.filename },
    styles: { maxWidth: '300px', cursor: 'pointer' }
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

      // Add tags below image (always show in prompt mode, or in images-only mode)
      if( !imagesOnlyActive || imagesOnlyActive ) {
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

  filtered.forEach( item => {
    if( !item.prompt ) return; // skip stubs

    const card = DOMHelper.div( {
      class: 'card',
      attrs: item.art_style ? { art_style: item.art_style } : {}
    } );

    // Left side: image
    const cardLeftChildren = [createImageElement( item )];

    // Add tags below image if images-only mode is active
    if( imagesOnlyActive ) {
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

      const cardRight = DOMHelper.div( {
        class: 'card-right'
      } );

      cardRight.appendChild( renderMetadata( item, skipKeys ) );

      // Always add tags section (CSS controls visibility)
      cardRight.appendChild( createTagInput( item ) );

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
  const showHidden = state.get( 'showHidden' );

  const params = {
    limit: limit,
    offset: offset,
    sort: sortMode,
    showHidden: showHidden
  };

  if( searchString ) {
    // Server-side search with pagination
    params.searchTerm = searchString;
    params.searchBy = searchBy;
    params.wholeWords = wholeWordsOnly;
  }

  const response = await api.get( 'api/data.php', params );

  // Handle both array response (no search) and object response (with search count)
  let items;
  let totalCount = null;

  if( Array.isArray( response ) ) {
    items = response;
  } else if( response && typeof response === 'object' ) {
    items = response.items || [];
    totalCount = response.totalCount || null;
  } else {
    console.error( 'Unexpected response format:', response );
    return;
  }

  //console.log( 'Loaded items sample (first item):', items[0] );

  const gallery = DOMHelper.query( '#gallery' );
  gallery.innerHTML = '';

  // Render gallery based on sort mode
  let promptGroupCount = 0;
  if( sortMode === 'prompt' ) {
    renderPromptMode( items, gallery );
    // Count unique prompts for navigation info
    const uniquePrompts = new Set();
    items.forEach( item => {
      if( item.prompt ) uniquePrompts.add( item.prompt );
    } );
    promptGroupCount = uniquePrompts.size;
  } else {
    renderNormalMode( items, gallery );
  }

  // Update pagination controls
  const currentPage = Math.floor( offset / limit ) + 1;
  DOMHelper.query( '#pageInfo' ).textContent =
    searchString && totalCount !== null
      ? `Search results: ${totalCount.toLocaleString()} total (showing ${items.length})`
      : '';

  DOMHelper.query( '#page' ).value = currentPage;
  DOMHelper.query( '#prev' ).disabled = ( offset === 0 );

  // Disable Next button if we received fewer items than the limit (no more results)
  // OR if we're searching and have reached the end based on total count
  const hasMoreResults = searchString && totalCount !== null
    ? ( offset + items.length ) < totalCount
    : items.length >= limit;
  DOMHelper.query( '#next' ).disabled = !hasMoreResults;

  // Update navigation info showing current range
  if( sortMode === 'prompt' && promptGroupCount > 0 ) {
    // In prompt mode, show prompt group numbers
    const startPrompt = offset + 1;
    const endPrompt = offset + promptGroupCount;
    DOMHelper.query( '#navInfo' ).textContent = `${startPrompt} to ${endPrompt}`;
  } else if( items.length > 0 ) {
    // In other modes, show image numbers
    const startIndex = offset + 1;
    const endIndex = offset + items.length;
    DOMHelper.query( '#navInfo' ).textContent = `${startIndex} to ${endIndex}`;
  } else {
    DOMHelper.query( '#navInfo' ).textContent = '';
  }

  updateSelectAllButton();
}

/**
 * Updates the delete button's disabled state based on selection count.
 */
function updateDeleteButton() {
  const selectedCount = selector.getSelected().length;
  const hasSelection = selectedCount > 0;
  const showHidden = state.get( 'showHidden' );

  DOMHelper.query( '#deleteSelected' ).disabled = !hasSelection;
  DOMHelper.query( '#addToCollection' ).disabled = !hasSelection;

  // Update hide/unhide button
  const hideButton = DOMHelper.query( '#hideSelected' );
  hideButton.disabled = !hasSelection;
  hideButton.textContent = showHidden ? 'Unhide' : 'Hide';

  // Update selection info text
  const selectionInfo = DOMHelper.query( '#selectionInfo' );
  if( hasSelection ) {
    selectionInfo.textContent = `${selectedCount} image${selectedCount === 1 ? '' : 's'} selected`;
  } else {
    selectionInfo.textContent = '';
  }
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
 * Hides or unhides selected images based on current view mode.
 * Sends request to server, clears selection, and reloads gallery.
 */
async function performHide() {
  const selected = selector.getSelected();
  if( selected.length === 0 ) return;

  const showHidden = state.get( 'showHidden' );
  const action = showHidden ? 'unhide' : 'hide';
  const actionCapitalized = showHidden ? 'Unhide' : 'Hide';

  if( !confirm( `${actionCapitalized} ${selected.length} selected image(s)?` ) ) return;

  try {
    const result = await api.post( 'api/hide.php', {
      filenames: Array.from( selected ),
      hidden: !showHidden
    } );

    if( !result.success ) {
      alert( 'Failed to hide images' );
      return;
    }
  } catch( error ) {
    console.error( 'Hide error:', error );
    alert( 'Error hiding images: ' + error.message );
    return;
  }

  selector.deselectAll();
  updateDeleteButton();
  loadData(); // silently refresh gallery
}

/**
 * Deletes selected images after user confirmation.
 * Sends DELETE request to server, clears selection, and reloads gallery.
 */
async function performDelete() {
  const selected = selector.getSelected();
  if( selected.length === 0 ) return;
  if( !confirm( `Delete ${selected.length} selected image(s)?` ) ) return;

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

/**
 * Shows the collection modal popup.
 */
function showCollectionModal() {
  const selected = selector.getSelected();
  if( selected.length === 0 ) return;

  const modal = DOMHelper.query( '#collectionModal' );
  const input = DOMHelper.query( '#collectionInput' );
  const confirmBtn = DOMHelper.query( '#confirmCollection' );

  input.value = '';
  confirmBtn.textContent = 'Add to new collection';
  modal.style.display = 'flex';
  input.focus();
}

/**
 * Hides the collection modal popup.
 */
function hideCollectionModal() {
  DOMHelper.query( '#collectionModal' ).style.display = 'none';
}

/**
 * Adds selected images to a collection.
 */
async function performAddToCollection() {
  const selected = selector.getSelected();
  if( selected.length === 0 ) return;

  const collectionTitle = DOMHelper.query( '#collectionInput' ).value.trim();

  try {
    const result = await api.post( 'api/add_to_collection.php', {
      filenames: Array.from( selected ),
      collectionTitle: collectionTitle
    } );

    if( !result.success ) {
      alert( 'Failed to add images to collection' );
      return;
    }

    hideCollectionModal();
    alert( `Added ${result.imagesAdded} image(s) to "${result.collectionTitle}"` );
    selector.deselectAll();
    updateDeleteButton();
  } catch( error ) {
    console.error( 'Add to collection error:', error );
    alert( 'Error adding to collection: ' + error.message );
  }
}


// Hide selected handler
DOMHelper.query( '#hideSelected' ).addEventListener( 'click', performHide );

// Delete selected handler
DOMHelper.query( '#deleteSelected' ).addEventListener( 'click', performDelete );

// Add to collection handler
DOMHelper.query( '#addToCollection' ).addEventListener( 'click', showCollectionModal );

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
  state.set( 'searchString', '' );
  DOMHelper.query( '#search' ).value = '';
  DOMHelper.query( '#wholeWords' ).checked = true;
  wholeWordsOnly = true;
  state.set( 'wholeWordsOnly', true );
  offset = 0;
  state.set( 'offset', offset );
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

// Show hidden toggle
DOMHelper.query( '#showHidden' ).addEventListener( 'change', () => {
  const isChecked = DOMHelper.query( '#showHidden' ).checked;
  state.set( 'showHidden', isChecked );
  offset = 0;
  state.set( 'offset', offset );
  updateDeleteButton(); // Update hide/unhide button text
  loadData();
} );

// Show tags toggle
DOMHelper.query( '#tag' ).addEventListener( 'change', () => {
  const isChecked = DOMHelper.query( '#tag' ).checked;
  state.set( 'showTags', isChecked );
  document.body.classList.toggle( 'show-tags', isChecked );
} );

// Collections sidebar toggle
DOMHelper.query( '#collections' ).addEventListener( 'change', async () => {
  const isChecked = DOMHelper.query( '#collections' ).checked;
  const sidebar = document.getElementById( 'collectionsSidebar' );

  if( !sidebar ) {
    console.error( 'Collections sidebar element not found' );
    return;
  }

  if( isChecked ) {
    sidebar.style.display = 'block';
    document.body.classList.add( 'collections-visible' );
    await loadCollections();
  } else {
    sidebar.style.display = 'none';
    document.body.classList.remove( 'collections-visible' );
  }
} );

/**
 * Loads and displays the list of collections in the sidebar.
 */
async function loadCollections() {
  try {
    const collections = await api.get( 'api/collections.php' );
    const collectionsList = DOMHelper.query( '#collectionsList' );
    collectionsList.innerHTML = '';

    if( collections.length === 0 ) {
      collectionsList.innerHTML = '<p style="color: #666; font-size: 0.9em;">No collections yet</p>';
      return;
    }

    collections.forEach( collection => {
      const item = DOMHelper.div( {
        class: 'collection-item',
        attrs: { 'data-collection-id': collection.id },
        children: [collection.title]
      } );

      collectionsList.appendChild( item );
    } );
  } catch( error ) {
    console.error( 'Error loading collections:', error );
    DOMHelper.query( '#collectionsList' ).innerHTML = '<p style="color: #e74c3c;">Failed to load collections</p>';
  }
}

// Collection modal listeners
DOMHelper.query( '#collectionInput' ).addEventListener( 'input', ( e ) => {
  const confirmBtn = DOMHelper.query( '#confirmCollection' );
  confirmBtn.textContent = e.target.value.trim() ? 'Add to collection' : 'Add to new collection';
} );

DOMHelper.query( '#confirmCollection' ).addEventListener( 'click', performAddToCollection );
DOMHelper.query( '#cancelCollection' ).addEventListener( 'click', hideCollectionModal );

// Close modal on Escape key
document.addEventListener( 'keydown', ( e ) => {
  if( e.key === 'Escape' ) {
    const modal = DOMHelper.query( '#collectionModal' );
    if( modal.style.display === 'flex' ) {
      hideCollectionModal();
    }
  }
} );

// Close modal when clicking outside
DOMHelper.query( '#collectionModal' ).addEventListener( 'click', ( e ) => {
  if( e.target.id === 'collectionModal' ) {
    hideCollectionModal();
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

// Page input - handle Enter key and spinner changes
const pageInput = DOMHelper.query( '#page' );
const goToPage = () => {
  const pageValue = parseInt( pageInput.value, 10 );
  if( !isNaN( pageValue ) && pageValue > 0 ) {
    offset = ( pageValue - 1 ) * limit;
    state.set( 'offset', offset );
    loadData();
  }
};

pageInput.addEventListener( 'keypress', ( e ) => {
  if( e.key === 'Enter' ) {
    goToPage();
  }
} );

pageInput.addEventListener( 'change', goToPage );

/**
 * Adjusts the gallery's top margin to match the toolbar height.
 * Ensures toolbar doesn't overlap gallery content when it wraps to multiple lines.
 */
function adjustGalleryMargin() {
  const toolbar = DOMHelper.query( '#toolbar' );
  const gallery = DOMHelper.query( '#gallery' );
  const sidebar = document.getElementById( 'collectionsSidebar' );
  const toolbarHeight = toolbar.offsetHeight;
  gallery.style.marginTop = toolbarHeight + 'px';
  if( sidebar ) {
    sidebar.style.top = toolbarHeight + 'px';
    sidebar.style.height = `calc(100vh - ${toolbarHeight}px)`;
  }
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
