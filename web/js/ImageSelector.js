/**
 * Selection state management for image galleries.
 * Handles single selection, multi-selection, and drag-to-select functionality.
 */
class ImageSelector {
  /**
   * Creates a new ImageSelector instance.
   * @param {Object} options - Configuration options
   * @param {string} options.selectedClass - CSS class for selected items (default: 'selected')
   * @param {string} options.itemSelector - Selector for selectable items (default: 'img')
   * @param {Function} options.onChange - Callback when selection changes
   */
  constructor( options = {} ) {
    this.selectedClass = options.selectedClass || 'selected';
    this.itemSelector = options.itemSelector || 'img';
    this.onChange = options.onChange || ( () => { } );

    this.selected = new Set();
    this.isDragging = false;
    this.dragSelecting = true;
    this.enabled = false;

    // Bind event handlers
    this._handleMouseDown = this._handleMouseDown.bind( this );
    this._handleMouseOver = this._handleMouseOver.bind( this );
    this._handleMouseUp = this._handleMouseUp.bind( this );
  }

  /**
   * Enables selection functionality.
   * @param {HTMLElement} container - Container element with selectable items
   */
  enable( container = document ) {
    if( this.enabled ) return;

    this.container = container;
    this.enabled = true;

    // Add event listeners
    document.addEventListener( 'mousedown', this._handleMouseDown );
    document.addEventListener( 'mouseover', this._handleMouseOver );
    document.addEventListener( 'mouseup', this._handleMouseUp );
  }

  /**
   * Disables selection functionality.
   */
  disable() {
    if( !this.enabled ) return;

    this.enabled = false;

    // Remove event listeners
    document.removeEventListener( 'mousedown', this._handleMouseDown );
    document.removeEventListener( 'mouseover', this._handleMouseOver );
    document.removeEventListener( 'mouseup', this._handleMouseUp );
  }

  /**
   * Handles mousedown event.
   * @private
   */
  _handleMouseDown( e ) {
    const item = e.target.closest( this.itemSelector );

    if( item && this.container.contains( item ) ) {
      e.preventDefault(); // Prevent text selection
      this.isDragging = true;

      const itemId = this._getItemId( item );

      // Determine if we're selecting or deselecting based on first item
      this.dragSelecting = !this.selected.has( itemId );

      // Apply selection to first item immediately
      if( this.dragSelecting ) {
        this.select( itemId, item );
      } else {
        this.deselect( itemId, item );
      }
    } else if( this.container.contains( e.target ) ) {
      // Clicked in container but not on item
      this.isDragging = true;
      this.dragSelecting = true;
    }
  }

  /**
   * Handles mouseover event for drag selection.
   * @private
   */
  _handleMouseOver( e ) {
    if( !this.isDragging ) return;

    const item = e.target.closest( this.itemSelector );
    if( item && this.container.contains( item ) ) {
      const itemId = this._getItemId( item );

      if( this.dragSelecting ) {
        this.select( itemId, item );
      } else {
        this.deselect( itemId, item );
      }
    }
  }

  /**
   * Handles mouseup event.
   * @private
   */
  _handleMouseUp() {
    this.isDragging = false;
  }

  /**
   * Gets a unique identifier for an item.
   * @private
   * @param {HTMLElement} item - The item element
   * @returns {string} Item identifier
   */
  _getItemId( item ) {
    return item.dataset.id || item.dataset.filename || item.src || item.getAttribute( 'id' );
  }

  /**
   * Selects an item.
   * @param {string} itemId - Item identifier
   * @param {HTMLElement} element - Item element (optional, for visual update)
   */
  select( itemId, element = null ) {
    if( this.selected.has( itemId ) ) return;

    this.selected.add( itemId );

    if( element ) {
      element.classList.add( this.selectedClass );
    } else {
      this._updateVisual( itemId, true );
    }

    this.onChange( Array.from( this.selected ) );
  }

  /**
   * Deselects an item.
   * @param {string} itemId - Item identifier
   * @param {HTMLElement} element - Item element (optional, for visual update)
   */
  deselect( itemId, element = null ) {
    if( !this.selected.has( itemId ) ) return;

    this.selected.delete( itemId );

    if( element ) {
      element.classList.remove( this.selectedClass );
    } else {
      this._updateVisual( itemId, false );
    }

    this.onChange( Array.from( this.selected ) );
  }

  /**
   * Toggles selection for an item.
   * @param {string} itemId - Item identifier
   * @param {HTMLElement} element - Item element (optional)
   */
  toggle( itemId, element = null ) {
    if( this.selected.has( itemId ) ) {
      this.deselect( itemId, element );
    } else {
      this.select( itemId, element );
    }
  }

  /**
   * Updates visual state of an item.
   * @private
   * @param {string} itemId - Item identifier
   * @param {boolean} selected - Whether item is selected
   */
  _updateVisual( itemId, selected ) {
    const elements = this.container.querySelectorAll( this.itemSelector );
    for( const el of elements ) {
      if( this._getItemId( el ) === itemId ) {
        el.classList.toggle( this.selectedClass, selected );
      }
    }
  }

  /**
   * Selects all items in the container.
   */
  selectAll() {
    const items = this.container.querySelectorAll( this.itemSelector );
    items.forEach( item => {
      const itemId = this._getItemId( item );
      this.select( itemId, item );
    } );
  }

  /**
   * Deselects all items.
   */
  deselectAll() {
    if( !this.container ) {
      // No container set, just clear the selection set
      this.selected.clear();
      this.onChange( [] );
      return;
    }

    const items = this.container.querySelectorAll( this.itemSelector );
    items.forEach( item => {
      const itemId = this._getItemId( item );
      this.deselect( itemId, item );
    } );
    this.selected.clear();
    this.onChange( [] );
  }

  /**
   * Checks if an item is selected.
   * @param {string} itemId - Item identifier
   * @returns {boolean} True if selected
   */
  isSelected( itemId ) {
    return this.selected.has( itemId );
  }

  /**
   * Gets all selected item IDs.
   * @returns {Array<string>} Array of selected item IDs
   */
  getSelected() {
    return Array.from( this.selected );
  }

  /**
   * Gets the count of selected items.
   * @returns {number} Number of selected items
   */
  getCount() {
    return this.selected.size;
  }

  /**
   * Checks if all items are selected.
   * @returns {boolean} True if all items are selected
   */
  isAllSelected() {
    const items = this.container.querySelectorAll( this.itemSelector );
    return items.length > 0 && items.length === this.selected.size;
  }

  /**
   * Clears selection state without triggering onChange.
   */
  clear() {
    this.selected.clear();
  }

  /**
   * Restores selection state from an array of IDs.
   * @param {Array<string>} itemIds - Array of item IDs to select
   */
  restore( itemIds ) {
    this.selected = new Set( itemIds );
    this._syncVisuals();
    this.onChange( Array.from( this.selected ) );
  }

  /**
   * Syncs visual state with internal selection state.
   * @private
   */
  _syncVisuals() {
    const items = this.container.querySelectorAll( this.itemSelector );
    items.forEach( item => {
      const itemId = this._getItemId( item );
      item.classList.toggle( this.selectedClass, this.selected.has( itemId ) );
    } );
  }
}

// Export for use in other modules
if( typeof module !== 'undefined' && module.exports ) {
  module.exports = ImageSelector;
}
