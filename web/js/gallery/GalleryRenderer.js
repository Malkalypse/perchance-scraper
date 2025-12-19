import DOMHelper from '../utils/DOMHelper.js';
import ImageSelector from '../utils/ImageSelector.js';


/** Renders the image gallery in various modes.
 * - Supports normal card layout and prompt grouping mode.
 * - Utilizes DOMHelper for element creation.
 * - Integrates with ImageSelector for selection state.
 */
export default class GalleryRenderer {
	constructor( state, selector ) {
		this.state    = state;
		this.selector = selector;
	}


	/** Creates a tag input field for an image item.
	 * @param {Object} item							- The image item containing tags array
	 * @param {Object} containerStyles	- Optional CSS styles to apply to the container
	 * @returns {HTMLElement} The tags container div element
	 */
	createTagInput( item, containerStyles = {}, updateTagsFn ) {
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
								updateTagsFn( item.filename, e.target.value );
							}
						}
					}

				} )
			]
		} );
	}


	/** Creates an image element with selected state.
	 * - Selection is handled by ImageSelector (click and drag).
	 * @param {Object} item - The image item containing filename and metadata
	 * @returns {HTMLElement} The img element
	 */
	createImageElement( item ) {
		return DOMHelper.img( `../images/medium/${item.filename}`, {
			class: this.selector.isSelected( item.filename ) ? 'selected' : '',
			data: { filename: item.filename },
			styles: { maxWidth: '300px', cursor: 'pointer' }
		} );
	}


	/** Renders metadata key-value pairs as paragraph elements.
	 * - Filters out specified keys and empty negative_prompt values.
	 * @param {Object} item			- The image item containing metadata
	 * @param {Array} skipKeys	- Array of key names to exclude from rendering
	 * @returns {DocumentFragment} Fragment containing paragraph elements
	 */
	renderMetadata( item, skipKeys = [] ) {
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


	/** Renders gallery in prompt grouping mode.
	 * - Groups images by prompt and displays them horizontally with shared metadata.
	 * - Shows individual seeds when multiple images share the same prompt.
	 * @param {Array} filtered			- Array of image items to render
	 * @param {HTMLElement} gallery	- The gallery container element
	 */
	renderPromptMode( filtered, gallery, updateTagsFn ) {
		const promptGroups = new Map();

		filtered.forEach( item => {
			if( !item.prompt ) return;

			if( !promptGroups.has( item.prompt ) ) {
				promptGroups.set( item.prompt, [] );
			}

			promptGroups.get( item.prompt ).push( item );
		});

		const imagesOnlyActive = this.state.get( 'imagesOnly' );

		promptGroups.forEach( ( groupItems, prompt ) => {
			const card = DOMHelper.div( {
				class: 'card',
				styles: { flexDirection: 'column' },
				attrs: groupItems[0].art_style ? { art_style: groupItems[0].art_style } : {}
			} );

			// Metadata section
			if( !imagesOnlyActive ) {
				const item = groupItems[0];
				const skipKeys = ['filename', 'date_downloaded', 'title', 'tags'];
				if( groupItems.length > 1 ) skipKeys.push( 'seed' );

				const cardTop = DOMHelper.div( {
					class: 'card-right',
					children: this.renderMetadata( item, skipKeys )
				} );
				card.appendChild(cardTop);
			}

			// Images section
			const imageWrappers = groupItems.map( item => {
				const wrapper = DOMHelper.div( {
					styles: {
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center'
					},
					children: [this.createImageElement( item )]
				} );

				if( item.seed && groupItems.length > 1 && !imagesOnlyActive ) {
					wrapper.appendChild(
						DOMHelper.div( {
							text: `Seed: ${item.seed}`,
							styles: { fontSize: '0.85em', marginTop: '0.75em' }
						} )
					);
				}

				wrapper.appendChild(
					this.createTagInput(
						item,
						{ width: '300px', marginTop: '0.5em' },
						updateTagsFn
					)
				);

				return wrapper;
			} );

			const cardBottom = DOMHelper.div({
				styles: { display: 'flex', gap: '1em', flexWrap: 'wrap' },
				children: imageWrappers
			} );

			card.appendChild( cardBottom );
			gallery.appendChild( card );
		} );
	}


	/** Renders gallery in normal mode (card layout with image on left, metadata on right).
	 * - Used for 'recent' and 'style' sort modes.
	 * @param {Array} filtered			- Array of image items to render
	 * @param {HTMLElement} gallery	- The gallery container element
	 */
	renderNormalMode( filtered, gallery, updateTagsFn ) {
		const imagesOnlyActive = this.state.get( 'imagesOnly' );

		filtered.forEach( item => {
			if( !item.prompt ) return;

			const card = DOMHelper.div( {
				class: 'card',
				attrs: item.art_style ? { art_style: item.art_style } : {}
			} );

			const cardLeftChildren = [this.createImageElement(item)];
			if( imagesOnlyActive ) {
				cardLeftChildren.push( this.createTagInput(item, { width: '300px', marginTop: '0.5em' }, updateTagsFn) );
			}

			const cardLeft = DOMHelper.div( { class: 'card-left', children: cardLeftChildren } );
			card.appendChild( cardLeft );

			if( !imagesOnlyActive ) {
				const skipKeys = ['filename', 'date_downloaded', 'title', 'tags'];
				const cardRight = DOMHelper.div( { class: 'card-right' } );
				cardRight.appendChild( this.renderMetadata(item, skipKeys) );
				cardRight.appendChild( this.createTagInput(item, {}, updateTagsFn) );
				card.appendChild( cardRight );
			}

			gallery.appendChild( card );
		} );
	}
}