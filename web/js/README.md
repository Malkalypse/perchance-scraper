# Reusable JavaScript Classes

This directory contains reusable JavaScript classes that can be used across multiple projects.

## Classes

### GalleryState
Universal localStorage manager for persisting application state.

**Features:**
- Automatic serialization/deserialization
- Change listeners with notifications
- Batch updates
- Default values
- Storage key prefixing to avoid collisions

**Usage:**
```javascript
// Initialize with defaults
const state = new GalleryState( 'myApp', {
  theme: 'dark',
  limit: 200,
  offset: 0
} );

// Get/set values
const theme = state.get( 'theme' );
state.set( 'limit', 500 );

// Listen for changes
state.onChange( 'theme', ( newValue, oldValue ) => {
  console.log( `Theme changed from ${oldValue} to ${newValue}` );
} );

// Batch updates
state.setMany( {
  limit: 100,
  offset: 200
} );
```

### APIClient
Generic fetch wrapper for making API requests with consistent error handling.

**Features:**
- Automatic JSON parsing
- Query parameter building
- Error handling
- Authorization header management
- Support for GET, POST, PUT, DELETE, PATCH

**Usage:**
```javascript
// Initialize with base URL
const api = new APIClient( 'api/' );

// GET request with query params
const data = await api.get( 'data.php', {
  limit: 200,
  offset: 0,
  sort: 'recent'
} );

// POST request
const result = await api.post( 'update_tags.php', {
  filename: 'image.jpg',
  tags: 'favorite, landscape'
} );

// DELETE request
await api.delete( 'delete.php', {
  filenames: ['image1.jpg', 'image2.jpg']
} );

// Set authorization
api.setAuth( 'your-token-here' );
```

### DOMHelper
Element creation utilities for building DOM elements with less boilerplate.

**Features:**
- Chainable API for element creation
- Automatic attribute/style/event binding
- Shorthand methods for common elements
- Event delegation
- Query utilities

**Usage:**
```javascript
// Create a div with class and styles
const card = DOMHelper.div( {
  class: 'card',
  styles: { padding: '1em', border: '1px solid #ccc' },
  children: [
    DOMHelper.img( 'image.jpg', { class: 'card-image' } ),
    DOMHelper.p( 'Description text', { class: 'card-text' } )
  ]
} );

// Create button with event handler
const btn = DOMHelper.button( 'Click Me', {
  class: 'primary-btn',
  events: {
    click: () => alert( 'Clicked!' )
  }
} );

// Create select with options
const select = DOMHelper.select( [
  { value: 'recent', text: 'Recent' },
  { value: 'style', text: 'Style' },
  { value: 'prompt', text: 'Prompt' }
], { attrs: { id: 'sort_by' } } );

// Query utilities
const element = DOMHelper.query( '#gallery' );
const images = DOMHelper.queryAll( 'img' );

// Event delegation
DOMHelper.delegate( gallery, 'click', 'img', function( e ) {
  console.log( 'Image clicked:', this.src );
} );
```

### ImageSelector
Selection state management for image galleries.

**Features:**
- Single and multi-selection
- Drag-to-select functionality
- Select/deselect all
- Change notifications
- Visual state synchronization

**Usage:**
```javascript
// Initialize
const selector = new ImageSelector( {
  selectedClass: 'selected',
  itemSelector: 'img',
  onChange: ( selectedIds ) => {
    console.log( `Selected ${selectedIds.length} items` );
    updateDeleteButton();
  }
} );

// Enable in a container
const gallery = document.getElementById( 'gallery' );
selector.enable( gallery );

// Select/deselect items
selector.select( 'image1.jpg' );
selector.deselect( 'image2.jpg' );
selector.toggle( 'image3.jpg' );

// Select all
selector.selectAll();
selector.deselectAll();

// Get selection state
const selected = selector.getSelected(); // ['image1.jpg', 'image3.jpg']
const count = selector.getCount(); // 2
const allSelected = selector.isAllSelected(); // false

// Disable when done
selector.disable();
```

## Integration Example

See `example.html` for a complete working example using all classes together.

## Browser Compatibility

These classes use modern JavaScript features:
- ES6 classes
- Arrow functions
- Template literals
- Async/await
- Destructuring
- Spread operator

Requires ES6+ browser support (Chrome 51+, Firefox 54+, Safari 10+, Edge 15+).

## License

These classes are part of the Perchance Gallery Scraper project and follow the same educational use license.
