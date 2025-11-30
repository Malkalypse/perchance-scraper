/**
 * Universal localStorage manager for persisting application state.
 * Provides a clean API for getting/setting state with automatic serialization.
 */
class GalleryState {
  /**
   * Creates a new GalleryState instance.
   * @param {string} storagePrefix - Prefix for localStorage keys to avoid collisions
   * @param {Object} defaults - Default values for state properties
   */
  constructor( storagePrefix = 'app', defaults = {} ) {
    this.prefix = storagePrefix;
    this.defaults = defaults;
    this.state = {};
    this.listeners = {}; // For change notifications

    // Load initial state from localStorage
    this._loadState();
  }

  /**
   * Loads all state from localStorage.
   * @private
   */
  _loadState() {
    for( const key in this.defaults ) {
      const storedValue = localStorage.getItem( this._getKey( key ) );
      if( storedValue !== null ) {
        this.state[key] = this._deserialize( storedValue );
      } else {
        this.state[key] = this.defaults[key];
      }
    }
  }

  /**
   * Gets the full localStorage key with prefix.
   * @private
   * @param {string} key - The state key
   * @returns {string} Prefixed key
   */
  _getKey( key ) {
    return `${this.prefix}_${key}`;
  }

  /**
   * Deserializes a value from localStorage.
   * @private
   * @param {string} value - Serialized value
   * @returns {*} Deserialized value
   */
  _deserialize( value ) {
    try {
      return JSON.parse( value );
    } catch( e ) {
      return value; // Return as string if not valid JSON
    }
  }

  /**
   * Serializes a value for localStorage.
   * @private
   * @param {*} value - Value to serialize
   * @returns {string} Serialized value
   */
  _serialize( value ) {
    if( typeof value === 'string' ) {
      return value;
    }
    return JSON.stringify( value );
  }

  /**
   * Gets a state value.
   * @param {string} key - The state key
   * @returns {*} The state value
   */
  get( key ) {
    return this.state[key];
  }

  /**
   * Sets a state value and persists to localStorage.
   * @param {string} key - The state key
   * @param {*} value - The value to set
   * @param {boolean} notify - Whether to notify listeners (default: true)
   */
  set( key, value, notify = true ) {
    const oldValue = this.state[key];
    this.state[key] = value;
    localStorage.setItem( this._getKey( key ), this._serialize( value ) );

    if( notify && oldValue !== value ) {
      this._notifyListeners( key, value, oldValue );
    }
  }

  /**
   * Sets multiple state values at once.
   * @param {Object} updates - Object with key-value pairs to update
   */
  setMany( updates ) {
    for( const [key, value] of Object.entries( updates ) ) {
      this.set( key, value, false );
    }
    // Notify listeners after all updates
    for( const key of Object.keys( updates ) ) {
      this._notifyListeners( key, updates[key], this.state[key] );
    }
  }

  /**
   * Removes a state value.
   * @param {string} key - The state key
   */
  remove( key ) {
    delete this.state[key];
    localStorage.removeItem( this._getKey( key ) );
  }

  /**
   * Clears all state (localStorage and memory).
   */
  clear() {
    for( const key in this.state ) {
      localStorage.removeItem( this._getKey( key ) );
    }
    this.state = { ...this.defaults };
  }

  /**
   * Registers a listener for state changes.
   * @param {string} key - The state key to watch
   * @param {Function} callback - Callback function (newValue, oldValue) => void
   * @returns {Function} Unsubscribe function
   */
  onChange( key, callback ) {
    if( !this.listeners[key] ) {
      this.listeners[key] = [];
    }
    this.listeners[key].push( callback );

    // Return unsubscribe function
    return () => {
      this.listeners[key] = this.listeners[key].filter( cb => cb !== callback );
    };
  }

  /**
   * Notifies listeners of a state change.
   * @private
   * @param {string} key - The state key that changed
   * @param {*} newValue - The new value
   * @param {*} oldValue - The previous value
   */
  _notifyListeners( key, newValue, oldValue ) {
    if( this.listeners[key] ) {
      this.listeners[key].forEach( callback => callback( newValue, oldValue ) );
    }
  }

  /**
   * Gets all state as a plain object.
   * @returns {Object} All state values
   */
  getAll() {
    return { ...this.state };
  }

  /**
   * Resets a specific key to its default value.
   * @param {string} key - The state key to reset
   */
  reset( key ) {
    if( key in this.defaults ) {
      this.set( key, this.defaults[key] );
    }
  }
}

// Export for use in other modules
if( typeof module !== 'undefined' && module.exports ) {
  module.exports = GalleryState;
}
