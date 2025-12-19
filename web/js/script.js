// Import utility modules
import DOMHelper from './utils/DOMHelper.js';
import LocalStorageManager from './utils/LocalStorageManager.js';
import APIClient from './utils/APIClient.js';
import ImageSelector from './utils/ImageSelector.js';

// Import gallery modules
import GalleryRenderer from './gallery/GalleryRenderer.js';
import CollectionManager from './gallery/CollectionManager.js';
import GalleryAPI from './gallery/GalleryAPI.js';


// ============================================
// Initialize reusable classes
// ============================================

// State management with localStorage persistence
const state = new LocalStorageManager( 'gallery', {
	limit:          200,      // items per page
	offset:         0,        // pagination offset
	searchString:   '',
	searchBy:       'prompt', // 'prompt', 'tag'
	sortMode:       'recent', // 'recent', 'style', 'prompt'
	wholeWordsOnly: true,
	imagesOnly:     false,
	showTags:       false,
	showHidden:     false
} );

// API client for server communication
const api = new APIClient();

// Image selector for drag-to-select functionality
const selector = new ImageSelector( {
	selectedClass: 'selected',
	itemSelector: 'img',
	onChange: () => {
		updateDeleteButton();
		updateSelectAllButton();
	}
} );

// Gallery renderer for displaying images and metadata
const renderer = new GalleryRenderer( state, selector );

// Collection manager for handling image collections
const collections = new CollectionManager( api, selector, state );

// Gallery API for server interactions
const galleryAPI = new GalleryAPI( api );


// ============================================
// Initialize UI from saved state
// ============================================

// Extract state values to variables for convenience
let limit           = state.get( 'limit' );
let offset          = state.get( 'offset' );
let searchString    = state.get( 'searchString' );
let searchBy        = state.get( 'searchBy' );
let sortMode        = state.get( 'sortMode' );
let wholeWordsOnly  = state.get( 'wholeWordsOnly' );

// Update UI elements to reflect saved state
DOMHelper.query( '#limit' ).value         = limit;
DOMHelper.query( '#search' ).value        = searchString;
DOMHelper.query( '#search_by' ).value     = searchBy;
DOMHelper.query( '#wholeWords' ).checked  = wholeWordsOnly;
DOMHelper.query( '#sort_by' ).value       = sortMode;
DOMHelper.query( '#imagesOnly' ).checked  = state.get( 'imagesOnly' );
DOMHelper.query( '#tag' ).checked         = state.get( 'showTags' );
DOMHelper.query( '#showHidden' ).checked  = state.get( 'showHidden' );

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

// Always enable image selector on the gallery
selector.enable( DOMHelper.query( '#gallery' ) );


/** Updates tags for an image and all images with the same prompt combination.
 * - Sends a POST request to the server and reloads the gallery on success.
 * @param {string} filename - The filename of the image to update
 * @param {string} tagsString - Comma-separated string of tags
 */
async function updateTags( filename, tagsString ) {
	try {
		const result = await galleryAPI.updateTags( filename, tagsString );

		if( result.success ) {
			loadData(); // reload to show updated tags
		} else {
			console.error( 'Error updating tags:', result.error );
		}

	} catch( error ) {
		console.error( 'Error updating tags:', error.message );
	}
}


/** Fetches and renders gallery data from the server.
 * - Handles both search queries and paginated results.
 * - Determines which render mode to use based on sortMode.
 * - Updates pagination controls and page info after rendering.
 */
async function loadData() {
	const showHidden = state.get( 'showHidden' );

	const params = {
		limit:      limit,
		offset:     offset,
		sort:       sortMode,
		showHidden: showHidden
	};

	if( searchString ) {
		// Server-side search with pagination
		params.searchTerm = searchString;
		params.searchBy   = searchBy;
		params.wholeWords = wholeWordsOnly;
	}

	const response = await galleryAPI.getData( params );

	// Handle both array response (no search) and object response (with search count)
	let items;
	let totalCount = null;

	if( Array.isArray( response ) ) {
		items = response;

	} else if( response && typeof response === 'object' ) {
		items       = response.items || [];
		totalCount  = response.totalCount || null;

	} else {
		console.error( 'Unexpected response format:', response );
		return;
	}

	//console.log( 'Loaded items sample (first item):', items[0] );

	const gallery     = DOMHelper.query( '#gallery' );
	gallery.innerHTML = '';

	// Render gallery based on sort mode

	let promptGroupCount = 0;

	if( sortMode === 'prompt' ) {
		renderer.renderPromptMode( items, gallery );

		// Count unique prompts for navigation info
		const uniquePrompts = new Set();

		items.forEach( item => {
			if( item.prompt ) uniquePrompts.add( item.prompt );
		} );

		promptGroupCount = uniquePrompts.size;

	} else {
		renderer.renderNormalMode( items, gallery );
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
		const endPrompt   = offset + promptGroupCount;
		DOMHelper.query( '#navInfo' ).textContent = `${startPrompt} to ${endPrompt}`;

	} else if( items.length > 0 ) {

		// In other modes, show image numbers
		const startIndex  = offset + 1;
		const endIndex    = offset + items.length;
		DOMHelper.query( '#navInfo' ).textContent = `${startIndex} to ${endIndex}`;

	} else {
		DOMHelper.query( '#navInfo' ).textContent = '';
	}

	updateSelectAllButton();
}


/** Updates the delete button's disabled state based on selection count. */
function updateDeleteButton() {
	const selectedCount = selector.getSelected().length;
	const hasSelection  = selectedCount > 0;
	const showHidden    = state.get( 'showHidden' );

	DOMHelper.query( '#deleteSelected' ).disabled = !hasSelection;
	DOMHelper.query( '#addToCollection' ).disabled = !hasSelection;

	// Update hide/unhide button
	const hideButton        = DOMHelper.query( '#hideSelected' );
	hideButton.disabled     = !hasSelection;
	hideButton.textContent  = showHidden ? 'Unhide' : 'Hide';

	// Update selection info text
	const selectionInfo = DOMHelper.query( '#selectionInfo' );
	if( hasSelection ) {
		selectionInfo.textContent = `${selectedCount} image${selectedCount === 1 ? '' : 's'} selected`;
	} else {
		selectionInfo.textContent = '';
	}
}


/** Updates the select all button text based on current selection state.
 * - Shows "Unselect All" when all images are selected, "Select All" otherwise.
 */
function updateSelectAllButton() {
	const images        = DOMHelper.queryAll( '#gallery img' );
	const allSelected   = images.length > 0 && Array.from( images ).every( img => img.classList.contains( 'selected' ) );
	const selectAllBtn  = DOMHelper.query( '#selectAll' );
	selectAllBtn.querySelector( 'span' ).textContent = allSelected ? 'Unselect All' : 'Select All';
}


/** Hides or unhides selected images based on current view mode.
 * - Sends request to server, clears selection, and reloads gallery.
 */
async function performHide() {
	const selected = selector.getSelected();

	if( selected.length === 0 ) return;

	const showHidden        = state.get( 'showHidden' );
	const action            = showHidden ? 'unhide' : 'hide';
	const actionCapitalized = showHidden ? 'Unhide' : 'Hide';

	if( !confirm( `${actionCapitalized} ${selected.length} selected image(s)?` ) ) return;

	try {
		const result = await galleryAPI.hideImages(
			Array.from( selected ),
			!showHidden
		);

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


/** Deletes selected images after user confirmation.
 * - Sends DELETE request to server, clears selection, and reloads gallery.
 */
async function performDelete() {
  const selected = selector.getSelected();

  if( selected.length === 0 ) return;
  if( !confirm( `Delete ${selected.length} selected image(s)?` ) ) return;

  // Optimistically remove from DOM
  selected.forEach( filename => {
    const img = DOMHelper.query( `#gallery img[data-filename="${filename}"]` );
    if( img ) img.closest( '.card' ).remove();
  } );

  selector.deselectAll();
  updateDeleteButton();

  try {
    const result = await galleryAPI.deleteImages( Array.from( selected ) );
    if( !result.success ) {
      alert( 'Failed to delete images' );
      loadData(); // fallback refresh
    }
  } catch( error ) {
    console.error( 'Delete error:', error );
    alert( 'Error deleting images: ' + error.message );
    loadData(); // fallback refresh
  }
}


/** Adjusts the gallery's top margin to match the toolbar height.
 * - Ensures toolbar doesn't overlap gallery content when it wraps to multiple lines.
 */
function adjustGalleryMargin() {
	const toolbar				= DOMHelper.query( '#toolbar' );
	const gallery				= DOMHelper.query( '#gallery' );
	const sidebar				= document.getElementById( 'collectionsSidebar' );
	const toolbarHeight	= toolbar.offsetHeight;

	gallery.style.marginTop = toolbarHeight + 'px';

	if( sidebar ) {
		sidebar.style.top = toolbarHeight + 'px';
		sidebar.style.height = `calc(100vh - ${toolbarHeight}px)`;
	}
}


/** Initializes all event listeners for UI interactions.
 * - Handles search input, toggles, pagination, CRUD actions, modals, and keyboard shortcuts.
 */
function initEventListeners() {

  // Search bar input
  const searchInput = DOMHelper.query( '#search' );

  // Update state as user types
  searchInput.addEventListener( 'input', e => {
    searchString = e.target.value.trim();
    state.set( 'searchString', searchString );
  } );

  // Reload on Enter or blur
  ['keypress', 'blur'].forEach( evt => {
    searchInput.addEventListener( evt, e => {
      if( evt === 'keypress' && e.key !== 'Enter' ) return;
      offset = 0;
      state.set( 'offset', offset );
      loadData();
    } );
  } );

  // Simple toggles with reload
  const toggleReload = (selector, key, transform = v => v) => {
    DOMHelper.query( selector ).addEventListener( 'change', e => {
      state.set( key, transform( e.target.checked ) );
      offset = 0;
      state.set( 'offset', offset );
      if( key === 'showHidden' ) updateDeleteButton(); // special case
      loadData();
    } );
  };
  toggleReload( '#wholeWords', 'wholeWordsOnly' );
  toggleReload( '#imagesOnly', 'imagesOnly' );
  toggleReload( '#showHidden', 'showHidden' );

  // Search by dropdown
  DOMHelper.query( '#search_by' ).addEventListener( 'change', e => {
    searchBy = e.target.value;
    state.set( 'searchBy', searchBy );
    offset = 0;
    state.set( 'offset', offset );
    loadData();
  } );

  // Clear search
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

  // Select all toggle
  DOMHelper.query( '#selectAll' ).addEventListener( 'click', () => {
    const images = DOMHelper.queryAll( '#gallery img' );
    const allSelected = images.length > 0 &&
      Array.from( images ).every( img => selector.isSelected( img.dataset.filename ) );

    allSelected
      ? selector.deselectAll()
      : selector.selectAll( images.map( img => img.dataset.filename ) );
    updateDeleteButton();
    updateSelectAllButton();
  } );

  // CRUD buttons 
  DOMHelper.query( '#hideSelected' ).addEventListener( 'click', performHide );
  DOMHelper.query( '#deleteSelected' ).addEventListener( 'click', performDelete );
  DOMHelper.query( '#addToCollection' ).addEventListener( 'click', () => collections.showModal() );

  // Collection modal
  DOMHelper.query( '#collectionInput' ).addEventListener( 'input', e => {
    const confirmBtn = DOMHelper.query( '#confirmCollection' );
    confirmBtn.textContent = e.target.value.trim()
      ? 'Add to collection'
      : 'Add to new collection';
  } );
  DOMHelper.query( '#confirmCollection' ).addEventListener( 'click', () => collections.addToCollection() );
  DOMHelper.query( '#cancelCollection' ).addEventListener( 'click', () => collections.hideModal() );

  // Keyboard shortcuts
  document.addEventListener( 'keydown', e => {
    if( e.key === 'Escape' ) {
      const modal = DOMHelper.query( '#collectionModal' );
      if( modal.style.display === 'flex' ) collections.hideModal();
    }

    if( e.key === 'Delete' ) performDelete();
  } );

  // Click outside modal closes it
  DOMHelper.query( '#collectionModal' ).addEventListener( 'click', e => {
    if( e.target.id === 'collectionModal' ) collections.hideModal();
  } );

  // Collections sidebar toggle
  DOMHelper.query( '#collections' ).addEventListener( 'change', async () => {
    const isChecked	= DOMHelper.query( '#collections' ).checked;
    const sidebar		= document.getElementById( 'collectionsSidebar' );

    if( !sidebar ) return;

    if( isChecked ) {
      sidebar.style.display = 'block';
      document.body.classList.add( 'collections-visible' );
      await collections.loadCollections();
    } else {
      sidebar.style.display = 'none';
      document.body.classList.remove( 'collections-visible' );
    }
  } );

  // Sort mode
  DOMHelper.query( '#sort_by' ).addEventListener( 'change', e => {
    sortMode = e.target.value;
    state.set( 'sortMode', sortMode );
    offset = 0;
    state.set( 'offset', offset );
    loadData();
  } );

  // Pagination
  const pageInput = DOMHelper.query( '#page' );
  const goToPage = () => {
    const pageValue = parseInt( pageInput.value, 10 );
    if( !isNaN( pageValue ) && pageValue > 0 ) {
      offset = (pageValue - 1) * limit;
      state.set( 'offset', offset );
      loadData();
    }
  };

  DOMHelper.query( '#limit' ).addEventListener( 'change', e => {
    limit = parseInt(e.target.value, 10);
    state.set( 'limit', limit );
    offset = 0;
    state.set( 'offset', offset );
    loadData();
  } );

	// Next/Prev buttons
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

  pageInput.addEventListener( 'keypress', e => { if( e.key === 'Enter' ) goToPage(); } );
  pageInput.addEventListener( 'change', goToPage );

  // Window resize
  window.addEventListener( 'resize', debounce( adjustGalleryMargin, 200 ) );
}


// Initial load
loadData();

// Adjust margin on load and resize
adjustGalleryMargin();

// Wire up all event listeners
initEventListeners();

// Enable drag selection if select mode is active
if( state.get( 'selectMode' ) ) {
	selector.enable( DOMHelper.query( '#gallery' ) );
}
