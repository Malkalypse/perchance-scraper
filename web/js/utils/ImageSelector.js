import SelectionManager from './SelectionManager.js';


/** Image-specific selection manager. */
class ImageSelector extends SelectionManager {
	constructor( options = {} ) {
		super( {
			...options,
			itemSelector: options.itemSelector || 'img',
			getItemId: options.getItemId || (item =>
				item.dataset.id || item.dataset.filename || item.src || item.getAttribute( 'id' ) )
		} );
	}
}


export default ImageSelector;