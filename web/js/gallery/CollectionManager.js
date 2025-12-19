import DOMHelper from '../utils/DOMHelper.js';


/** Manages image collections: adding images, displaying collections, and handling the collection modal.
 * - Interacts with APIClient for server requests.
 * - Utilizes DOMHelper for DOM manipulations.
 * - Works with ImageSelector to get selected images.
 */
export default class CollectionManager {
  constructor( apiClient, selector, state ) {
    this.api      = apiClient;
    this.selector = selector;
    this.state    = state;
  }

  /** Show the collection modal popup */
  showModal() {
    const selected = this.selector.getSelected();
    
    if( selected.length === 0 ) return;

    const modal       = DOMHelper.query( '#collectionModal' );
    const input       = DOMHelper.query( '#collectionInput' );
    const confirmBtn  = DOMHelper.query( '#confirmCollection' );

    input.value             = '';
    confirmBtn.textContent  = 'Add to new collection';
    modal.style.display     = 'flex';

    input.focus();
  }

  /** Hides the collection modal popup */
  hideModal() {
    DOMHelper.query( '#collectionModal' ).style.display = 'none';
  }

  /** Add selected images to a collection */
  async addToCollection() {
    const selected = this.selector.getSelected();
    
    if( selected.length === 0 ) return;

    const collectionTitle = DOMHelper.query( '#collectionInput' ).value.trim();

    try {
      const result = await this.api.post( 'api/add_to_collection.php', {
        filenames: Array.from( selected ),
        collectionTitle
      } );

      if( !result.success ) {
        alert( 'Failed to add images to collection' );
        return;
      }

      this.hideModal();
      alert( `Added ${result.imagesAdded} image(s) to "${result.collectionTitle}"` );
      this.selector.deselectAll();

    } catch( error ) {
      console.error( 'Add to collection error:', error );
      alert( 'Error adding to collection: ' + error.message );
    }
  }

  /** Load and display collections in the sidebar */
  async loadCollections() {
    try {
      const collections     = await this.api.get( 'api/collections.php' );
      const collectionsList = DOMHelper.query( '#collectionsList' );

      collectionsList.innerHTML = '';

      if( collections.length === 0 ) {
        collectionsList.innerHTML =
          '<p style="color: #666; font-size: 0.9em;">No collections yet</p>';
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
      
      DOMHelper.query( '#collectionsList' ).innerHTML =
        '<p style="color: #e74c3c;">Failed to load collections</p>';
    }
  }
}