# Refactoring Guide: Converting script.js to Use Reusable Classes

This guide shows how to refactor the existing `script.js` to use the new reusable classes.

## Before and After Comparison

### 1. State Management

**Before (Procedural):**
```javascript
let limit = parseInt( localStorage.getItem( 'limit' ) ) || 200;
let offset = parseInt( localStorage.getItem( 'offset' ) ) || 0;
let searchString = localStorage.getItem( 'searchString' ) || '';
let sortMode = localStorage.getItem( 'sortMode' ) || 'recent';

// Updating state
limit = 500;
localStorage.setItem( 'limit', limit );
```

**After (Class-based):**
```javascript
// Initialize once
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

// Getting/setting values
const limit = state.get( 'limit' );
state.set( 'limit', 500 );

// Batch updates
state.setMany( {
  searchString: 'castle',
  offset: 0
} );

// Listen for changes
state.onChange( 'limit', ( newValue ) => {
  loadData();
} );
```

---

### 2. API Calls

**Before (Procedural):**
```javascript
async function loadData() {
  let url = `api/data.php?limit=${limit}&offset=${offset}&sort=${sortMode}`;
  const res = await fetch( url );
  const items = await res.json();
  // ...
}

async function updateTags( filename, tagsString ) {
  const response = await fetch( 'api/update_tags.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify( { filename, tags: tagsString } )
  } );
  const result = await response.json();
  // ...
}
```

**After (Class-based):**
```javascript
// Initialize once
const api = new APIClient( 'api/' );

async function loadData() {
  const items = await api.get( 'data.php', {
    limit: state.get( 'limit' ),
    offset: state.get( 'offset' ),
    sort: state.get( 'sortMode' ),
    searchTerm: state.get( 'searchString' ),
    searchBy: state.get( 'searchBy' ),
    wholeWords: state.get( 'wholeWordsOnly' )
  } );
  // ...
}

async function updateTags( filename, tagsString ) {
  const result = await api.post( 'update_tags.php', {
    filename,
    tags: tagsString
  } );
  // ...
}
```

---

### 3. DOM Element Creation

**Before (Procedural):**
```javascript
function createImageElement( item ) {
  const img = document.createElement( 'img' );
  img.src = `../images/medium/${item.filename}`;
  img.dataset.filename = item.filename;
  img.style.maxWidth = '300px';
  img.style.cursor = 'pointer';
  
  if( selectedFiles.has( item.filename ) ) {
    img.classList.add( 'selected' );
  }
  
  img.onclick = () => {
    if( selectedFiles.has( item.filename ) ) {
      selectedFiles.delete( item.filename );
      img.classList.remove( 'selected' );
    } else {
      selectedFiles.add( item.filename );
      img.classList.add( 'selected' );
    }
  };
  
  return img;
}

function createTagInput( item, containerStyles = {} ) {
  const tagsContainer = document.createElement( 'div' );
  tagsContainer.className = 'tags-container';
  Object.assign( tagsContainer.style, containerStyles );
  
  const tagsInput = document.createElement( 'input' );
  tagsInput.type = 'text';
  tagsInput.placeholder = 'Enter tags...';
  tagsInput.value = Array.isArray( item.tags ) ? item.tags.join( ', ' ) : '';
  
  tagsInput.addEventListener( 'keypress', ( e ) => {
    if( e.key === 'Enter' ) {
      updateTags( item.filename, tagsInput.value );
    }
  } );
  
  tagsContainer.appendChild( tagsInput );
  return tagsContainer;
}
```

**After (Class-based):**
```javascript
function createImageElement( item ) {
  return DOMHelper.img( `../images/medium/${item.filename}`, {
    class: selector.isSelected( item.filename ) ? 'selected' : '',
    data: { filename: item.filename },
    styles: { maxWidth: '300px', cursor: 'pointer' },
    events: {
      click: function() {
        if( !state.get( 'selectMode' ) ) {
          selector.toggle( item.filename, this );
        }
      }
    }
  } );
}

function createTagInput( item, containerStyles = {} ) {
  return DOMHelper.div( {
    class: 'tags-container',
    styles: containerStyles,
    children: [
      DOMHelper.input( 'text', {
        attrs: {
          placeholder: 'Enter tags...',
          value: Array.isArray( item.tags ) ? item.tags.join( ', ' ) : ''
        },
        events: {
          keypress: ( e ) => {
            if( e.key === 'Enter' ) {
              updateTags( item.filename, e.target.value );
            }
          }
        }
      } )
    ]
  } );
}
```

---

### 4. Selection Management

**Before (Procedural):**
```javascript
let selectedFiles = new Set();
let isDragging = false;
let dragSelecting = true;

document.addEventListener( 'mousedown', ( e ) => {
  const img = e.target.closest( 'img' );
  if( img && img.dataset.filename ) {
    isDragging = true;
    dragSelecting = !selectedFiles.has( img.dataset.filename );
    
    if( dragSelecting ) {
      selectedFiles.add( img.dataset.filename );
      img.classList.add( 'selected' );
    } else {
      selectedFiles.delete( img.dataset.filename );
      img.classList.remove( 'selected' );
    }
  }
} );

document.addEventListener( 'mouseover', ( e ) => {
  if( !isDragging ) return;
  const img = e.target.closest( 'img' );
  // ... more drag logic
} );

document.getElementById( 'selectAll' ).addEventListener( 'click', () => {
  const images = document.querySelectorAll( '#gallery img' );
  images.forEach( img => {
    img.classList.add( 'selected' );
    selectedFiles.add( img.dataset.filename );
  } );
} );
```

**After (Class-based):**
```javascript
// Initialize once
const selector = new ImageSelector( {
  selectedClass: 'selected',
  itemSelector: 'img',
  onChange: ( selectedIds ) => {
    updateDeleteButton();
    updateSelectAllButton();
  }
} );

// Enable when select mode is active
state.onChange( 'selectMode', ( enabled ) => {
  if( enabled ) {
    selector.enable( DOMHelper.query( '#gallery' ) );
  } else {
    selector.disable();
  }
} );

// Select all button
DOMHelper.query( '#selectAll' ).addEventListener( 'click', () => {
  if( selector.isAllSelected() ) {
    selector.deselectAll();
  } else {
    selector.selectAll();
  }
} );
```

---

## Complete Refactoring Steps

### Step 1: Include the class files in index.php

```html
<!-- Add before script.js -->
<script src="js/GalleryState.js"></script>
<script src="js/APIClient.js"></script>
<script src="js/DOMHelper.js"></script>
<script src="js/ImageSelector.js"></script>
<script src="script.js"></script>
```

### Step 2: Initialize classes at the top of script.js

```javascript
// State management
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

// API client
const api = new APIClient( 'api/' );

// Image selector
const selector = new ImageSelector( {
  selectedClass: 'selected',
  itemSelector: 'img',
  onChange: ( selectedIds ) => {
    updateDeleteButton();
    updateSelectAllButton();
  }
} );
```

### Step 3: Update initialization code

Replace:
```javascript
document.getElementById( 'limit' ).value = limit;
document.getElementById( 'search' ).value = searchString;
// ... etc
```

With:
```javascript
DOMHelper.query( '#limit' ).value = state.get( 'limit' );
DOMHelper.query( '#search' ).value = state.get( 'searchString' );
DOMHelper.query( '#sort_by' ).value = state.get( 'sortMode' );
// ... etc
```

### Step 4: Replace all fetch calls with api.get/post/delete

### Step 5: Replace all createElement calls with DOMHelper methods

### Step 6: Replace selection management with selector methods

### Step 7: Replace localStorage access with state.get/set

### Step 8: Set up state change listeners

```javascript
state.onChange( 'limit', () => loadData() );
state.onChange( 'sortMode', () => loadData() );
state.onChange( 'searchString', () => loadData() );
```

---

## Benefits of Refactoring

1. **Portability**: Classes can be reused in other projects
2. **Maintainability**: Clear separation of concerns
3. **Testability**: Each class can be unit tested independently
4. **Consistency**: Standardized patterns across codebase
5. **Documentation**: Classes have clear APIs and JSDoc comments
6. **Extensibility**: Easy to add features without modifying core logic

---

## Next Steps

1. Test the classes with the example.html file
2. Gradually refactor script.js section by section
3. Keep the old script.js as script.old.js for reference
4. Test thoroughly after each refactoring step
5. Commit changes incrementally for easy rollback
