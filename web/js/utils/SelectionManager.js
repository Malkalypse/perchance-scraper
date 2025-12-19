class SelectionManager {

	/**
	 * @param {Object}    options               - Configuration options
	 * @param {string}    options.selectedClass - CSS class for selected items (default: 'selected')
	 * @param {string}    options.itemSelector  - Selector for selectable items (default: '*')
	 * @param {Function}  options.onChange			- Callback when selection changes
	 * @param {Function}  options.getItemId			- Function to resolve unique item IDs
	 */
	constructor( options = {} ) {
		this.selectedClass = options.selectedClass || 'selected';
		this.itemSelector  = options.itemSelector || '*';
		this.onChange      = options.onChange || ( () => {} );

		this.getItemId = options.getItemId || ( item =>
			item.dataset.id || item.getAttribute('id')
		);

		this.selected      = new Set();
		this.isDragging    = false;
		this.hasDragged    = false;
		this.dragSelecting = true;
		this.mouseDownItem = null;
		this.enabled       = false;

		// Bind event handlers
		this._handleMouseDown = this._handleMouseDown.bind( this );
		this._handleMouseOver = this._handleMouseOver.bind( this );
		this._handleMouseUp   = this._handleMouseUp.bind( this );
	}


  /** Enables selection functionality.
   * @param {HTMLElement} container - Container element with selectable items
   */
	enable( container = document ) {
		if( this.enabled ) return;

		this.container = container;
		this.enabled = true;
		container.addEventListener( 'mousedown', this._handleMouseDown );
		container.addEventListener( 'mouseover', this._handleMouseOver );
		container.addEventListener( 'mouseup', this._handleMouseUp );
	}


	/** Disables selection functionality. */
	disable() {
		if( !this.enabled ) return;

		this.enabled = false;
		this.container.removeEventListener( 'mousedown', this._handleMouseDown );
		this.container.removeEventListener( 'mouseover', this._handleMouseOver );
		this.container.removeEventListener( 'mouseup', this._handleMouseUp );
	}


	/** Handles mousedown event. */
	_handleMouseDown( e ) {
		if( e.button !== 0 ) return; // only left click

		const item = e.target.closest( this.itemSelector );

		if( item && this.container.contains( item ) ) {
			e.preventDefault();
			this.isDragging    = true;
			this.hasDragged    = false;
			this.mouseDownItem = item;

			const itemId = this.getItemId( item );
			this.dragSelecting = !this.selected.has( itemId );

			if( this.dragSelecting ) {
				this.select( itemId, item );
			} else {
				this.deselect( itemId, item );
			}

		} else if( this.container.contains( e.target ) ) {

			// Clicked inside container but not on an item
			this.isDragging    = true;
			this.hasDragged    = false;
			this.mouseDownItem = null;
			this.dragSelecting = true;
		}
	}


	/** Handles mouseover event for drag selection. */
	_handleMouseOver( e ) {
		if( !this.isDragging ) return;

		const item = e.target.closest( this.itemSelector );

		if( item && item !== this.mouseDownItem && this.container.contains( item ) ) {
			this.hasDragged = true;
			const itemId = this.getItemId( item );
			if( this.dragSelecting ) {
				this.select( itemId, item );
			} else {
				this.deselect( itemId, item );
			}
		}
	}


	/** Handles mouseup event. */
	_handleMouseUp( e ) {
		this.isDragging    = false;
		this.hasDragged    = false;
		this.mouseDownItem = null;
	}


	/** Select an item. */
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


	/** Deselect an item. */
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


	/** Toggle selection for an item. */
	toggle( itemId, element = null ) {
		if( this.selected.has( itemId ) ) {
			this.deselect( itemId, element );
		} else {
			this.select( itemId, element );
		}
	}


	/** Update visual state of an item. */
	_updateVisual( itemId, selected ) {
		const elements = this.container.querySelectorAll( this.itemSelector );
		for( const el of elements ) {
			if( this.getItemId( el ) === itemId ) {
				el.classList.toggle( this.selectedClass, selected );
			}
		}
	}


	/** Select all items. */
	selectAll() {
		const items = this.container.querySelectorAll( this.itemSelector );

		items.forEach( item => {
			const itemId = this.getItemId( item );
			this.select( itemId, item );
		} );
	}


	/** Deselect all items. */
	deselectAll() {
		if( !this.container) {
			this.selected.clear();
			this.onChange( [] );
			return;
		}

		const items = this.container.querySelectorAll( this.itemSelector );

		items.forEach( item => {
			const itemId = this.getItemId( item );
			this.deselect( itemId, item );
		} );

		this.selected.clear();
		this.onChange( [] );
	}


	/** Check if an item is selected. */
	isSelected( itemId ) {
		return this.selected.has( itemId );
	}


	/** Get all selected IDs. */
	getSelected() {
		return Array.from( this.selected );
	}


	/** Get count of selected items. */
	getCount() {
		return this.selected.size;
	}


	/** Check if all items are selected. */
	isAllSelected() {
		const items = this.container.querySelectorAll( this.itemSelector );
		return items.length > 0 && items.length === this.selected.size;
	}


	/** Clear selection state without triggering onChange. */
	clear() {
		this.selected.clear();
	}


	/** Restore selection state from an array of IDs. */
	restore( itemIds ) {
		this.selected = new Set( itemIds );
		this._syncVisuals();
		this.onChange( Array.from( this.selected ) );
	}


	/** Sync visuals with internal state. */
	_syncVisuals() {
		const items = this.container.querySelectorAll( this.itemSelector );

		items.forEach( item => {
			const itemId = this.getItemId( item );
			item.classList.toggle( this.selectedClass, this.selected.has( itemId ) );
		} );
	}
}


export default SelectionManager;