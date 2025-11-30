/**
 * Generic fetch wrapper for making API requests with consistent error handling.
 * Provides methods for GET, POST, PUT, DELETE with automatic JSON parsing.
 */
class APIClient {
  /**
   * Creates a new APIClient instance.
   * @param {string} baseURL - Base URL for all API requests
   * @param {Object} defaultOptions - Default fetch options
   */
  constructor( baseURL = '', defaultOptions = {} ) {
    this.baseURL = baseURL;
    this.defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
      ...defaultOptions
    };
  }

  /**
   * Builds the full URL with base URL and query parameters.
   * @private
   * @param {string} endpoint - The API endpoint
   * @param {Object} params - Query parameters
   * @returns {string} Full URL with query string
   */
  _buildURL( endpoint, params = {} ) {
    const url = new URL( endpoint, this.baseURL );

    // Add query parameters
    for( const [key, value] of Object.entries( params ) ) {
      if( value !== null && value !== undefined ) {
        url.searchParams.append( key, value );
      }
    }

    return url.toString();
  }

  /**
   * Makes a fetch request with error handling.
   * @private
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Parsed response
   */
  async _request( url, options = {} ) {
    const config = {
      ...this.defaultOptions,
      ...options,
      headers: {
        ...this.defaultOptions.headers,
        ...( options.headers || {} )
      }
    };

    try {
      const response = await fetch( url, config );

      // Check if response is ok
      if( !response.ok ) {
        throw new Error( `HTTP error ${response.status}: ${response.statusText}` );
      }

      // Parse response based on content type
      const contentType = response.headers.get( 'content-type' );
      if( contentType && contentType.includes( 'application/json' ) ) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch( error ) {
      console.error( 'API request failed:', error );
      throw error;
    }
  }

  /**
   * Makes a GET request.
   * @param {string} endpoint - The API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} options - Additional fetch options
   * @returns {Promise<Object>} Response data
   */
  async get( endpoint, params = {}, options = {} ) {
    const url = this._buildURL( endpoint, params );
    return this._request( url, {
      method: 'GET',
      ...options
    } );
  }

  /**
   * Makes a POST request.
   * @param {string} endpoint - The API endpoint
   * @param {Object} data - Request body data
   * @param {Object} options - Additional fetch options
   * @returns {Promise<Object>} Response data
   */
  async post( endpoint, data = {}, options = {} ) {
    const url = this._buildURL( endpoint );
    return this._request( url, {
      method: 'POST',
      body: JSON.stringify( data ),
      ...options
    } );
  }

  /**
   * Makes a PUT request.
   * @param {string} endpoint - The API endpoint
   * @param {Object} data - Request body data
   * @param {Object} options - Additional fetch options
   * @returns {Promise<Object>} Response data
   */
  async put( endpoint, data = {}, options = {} ) {
    const url = this._buildURL( endpoint );
    return this._request( url, {
      method: 'PUT',
      body: JSON.stringify( data ),
      ...options
    } );
  }

  /**
   * Makes a DELETE request.
   * @param {string} endpoint - The API endpoint
   * @param {Object} data - Request body data (optional)
   * @param {Object} options - Additional fetch options
   * @returns {Promise<Object>} Response data
   */
  async delete( endpoint, data = null, options = {} ) {
    const url = this._buildURL( endpoint );
    const config = {
      method: 'DELETE',
      ...options
    };

    if( data ) {
      config.body = JSON.stringify( data );
    }

    return this._request( url, config );
  }

  /**
   * Makes a PATCH request.
   * @param {string} endpoint - The API endpoint
   * @param {Object} data - Request body data
   * @param {Object} options - Additional fetch options
   * @returns {Promise<Object>} Response data
   */
  async patch( endpoint, data = {}, options = {} ) {
    const url = this._buildURL( endpoint );
    return this._request( url, {
      method: 'PATCH',
      body: JSON.stringify( data ),
      ...options
    } );
  }

  /**
   * Sets a default header for all requests.
   * @param {string} key - Header name
   * @param {string} value - Header value
   */
  setHeader( key, value ) {
    this.defaultOptions.headers[key] = value;
  }

  /**
   * Removes a default header.
   * @param {string} key - Header name
   */
  removeHeader( key ) {
    delete this.defaultOptions.headers[key];
  }

  /**
   * Sets the authorization header.
   * @param {string} token - Auth token
   * @param {string} type - Auth type (default: 'Bearer')
   */
  setAuth( token, type = 'Bearer' ) {
    this.setHeader( 'Authorization', `${type} ${token}` );
  }

  /**
   * Clears the authorization header.
   */
  clearAuth() {
    this.removeHeader( 'Authorization' );
  }
}

// Export for use in other modules
if( typeof module !== 'undefined' && module.exports ) {
  module.exports = APIClient;
}
