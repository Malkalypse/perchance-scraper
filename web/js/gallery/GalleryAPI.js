/** GalleryAPI: Handles communication with the backend gallery API. */
export default class GalleryAPI {
  constructor( apiClient ) {
    this.api = apiClient; // instance of APIClient
  }

  /** Fetch gallery data (with optional search/pagination params) */
  async getData( params ) {
    return this.api.get( 'api/data.php', params );
  }

  /** Update tags for an image */
  async updateTags( filename, tagsString ) {
    return this.api.post( 'api/update_tags.php', {
      filename,
      tags: tagsString
    } );
  }

  /** Hide or unhide images */
  async hideImages( filenames, hidden ) {
    return this.api.post( 'api/hide.php', {
      filenames,
      hidden
    } );
  }

  /** Delete images */
  async deleteImages( filenames ) {
    return this.api.post( 'api/delete.php', {
      filenames
    } );
  }

  /** Add images to a collection */
  async addToCollection( filenames, collectionTitle ) {
    return this.api.post( 'api/add_to_collection.php', {
      filenames,
      collectionTitle
    } );
  }

  /** Fetch collections list */
  async getCollections() {
    return this.api.get( 'api/collections.php' );
  }
}