/**
 * Element creation utilities for building DOM elements with less boilerplate.
 * Provides a chainable API for creating and configuring elements.
 */
class DOMHelper {
  /**
   * Creates a new element with optional attributes, styles, and children.
   * @param {string} tag - HTML tag name
   * @param {Object} options - Configuration options
   * @param {Object} options.attrs - HTML attributes
   * @param {Object} options.styles - CSS styles
   * @param {Array|HTMLElement|string} options.children - Child elements or text
   * @param {Object} options.events - Event listeners
   * @param {string} options.text - Text content
   * @param {string} options.html - innerHTML content
   * @returns {HTMLElement} The created element
   */
  static create( tag, options = {} ) {
    const element = document.createElement( tag );

    // Set attributes
    if( options.attrs ) {
      for( const [key, value] of Object.entries( options.attrs ) ) {
        if( value !== null && value !== undefined ) {
          element.setAttribute( key, value );
        }
      }
    }

    // Set styles
    if( options.styles ) {
      Object.assign( element.style, options.styles );
    }

    // Set class (can be string or array)
    if( options.class ) {
      if( Array.isArray( options.class ) ) {
        element.classList.add( ...options.class );
      } else {
        element.className = options.class;
      }
    }

    // Set data attributes
    if( options.data ) {
      for( const [key, value] of Object.entries( options.data ) ) {
        element.dataset[key] = value;
      }
    }

    // Add event listeners
    if( options.events ) {
      for( const [event, handler] of Object.entries( options.events ) ) {
        element.addEventListener( event, handler );
      }
    }

    // Set text content
    if( options.text ) {
      element.textContent = options.text;
    }

    // Set innerHTML
    if( options.html ) {
      element.innerHTML = options.html;
    }

    // Add children
    if( options.children ) {
      this.appendChildren( element, options.children );
    }

    return element;
  }

  /**
   * Appends children to an element.
   * @param {HTMLElement} parent - Parent element
   * @param {Array|HTMLElement|string} children - Child elements or text
   */
  static appendChildren( parent, children ) {
    if( !Array.isArray( children ) ) {
      children = [children];
    }

    for( const child of children ) {
      if( typeof child === 'string' ) {
        parent.appendChild( document.createTextNode( child ) );
      } else if( child instanceof HTMLElement || child instanceof DocumentFragment ) {
        parent.appendChild( child );
      }
    }
  }

  /**
   * Creates a div element.
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} The created div
   */
  static div( options = {} ) {
    return this.create( 'div', options );
  }

  /**
   * Creates a span element.
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} The created span
   */
  static span( options = {} ) {
    return this.create( 'span', options );
  }

  /**
   * Creates a button element.
   * @param {string} text - Button text
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} The created button
   */
  static button( text, options = {} ) {
    return this.create( 'button', { ...options, text } );
  }

  /**
   * Creates an input element.
   * @param {string} type - Input type
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} The created input
   */
  static input( type, options = {} ) {
    return this.create( 'input', {
      ...options,
      attrs: { type, ...( options.attrs || {} ) }
    } );
  }

  /**
   * Creates an image element.
   * @param {string} src - Image source URL
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} The created img
   */
  static img( src, options = {} ) {
    return this.create( 'img', {
      ...options,
      attrs: { src, ...( options.attrs || {} ) }
    } );
  }

  /**
   * Creates a link element.
   * @param {string} href - Link URL
   * @param {string} text - Link text
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} The created link
   */
  static link( href, text, options = {} ) {
    return this.create( 'a', {
      ...options,
      text,
      attrs: { href, ...( options.attrs || {} ) }
    } );
  }

  /**
   * Creates a paragraph element.
   * @param {string} text - Paragraph text
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} The created paragraph
   */
  static p( text, options = {} ) {
    return this.create( 'p', { ...options, text } );
  }

  /**
   * Creates a label element.
   * @param {string} text - Label text
   * @param {Object} options - Configuration options
   * @returns {HTMLElement} The created label
   */
  static label( text, options = {} ) {
    return this.create( 'label', { ...options, text } );
  }

  /**
   * Creates a select element with options.
   * @param {Array} options - Array of {value, text} objects or strings
   * @param {Object} config - Configuration options
   * @returns {HTMLElement} The created select
   */
  static select( options, config = {} ) {
    const select = this.create( 'select', config );

    for( const option of options ) {
      const opt = this.create( 'option', {
        attrs: {
          value: typeof option === 'string' ? option : option.value
        },
        text: typeof option === 'string' ? option : option.text
      } );
      select.appendChild( opt );
    }

    return select;
  }

  /**
   * Removes all children from an element.
   * @param {HTMLElement} element - Element to clear
   */
  static clear( element ) {
    while( element.firstChild ) {
      element.removeChild( element.firstChild );
    }
  }

  /**
   * Toggles a class on an element.
   * @param {HTMLElement} element - Target element
   * @param {string} className - Class name to toggle
   * @param {boolean} force - Force add (true) or remove (false)
   */
  static toggleClass( element, className, force ) {
    element.classList.toggle( className, force );
  }

  /**
   * Shows an element.
   * @param {HTMLElement} element - Element to show
   * @param {string} display - Display value (default: 'block')
   */
  static show( element, display = 'block' ) {
    element.style.display = display;
  }

  /**
   * Hides an element.
   * @param {HTMLElement} element - Element to hide
   */
  static hide( element ) {
    element.style.display = 'none';
  }

  /**
   * Queries a single element.
   * @param {string} selector - CSS selector
   * @param {HTMLElement} parent - Parent element (default: document)
   * @returns {HTMLElement|null} Found element
   */
  static query( selector, parent = document ) {
    return parent.querySelector( selector );
  }

  /**
   * Queries multiple elements.
   * @param {string} selector - CSS selector
   * @param {HTMLElement} parent - Parent element (default: document)
   * @returns {Array<HTMLElement>} Array of found elements
   */
  static queryAll( selector, parent = document ) {
    return Array.from( parent.querySelectorAll( selector ) );
  }

  /**
   * Creates a DocumentFragment with children.
   * @param {Array|HTMLElement|string} children - Child elements
   * @returns {DocumentFragment} The created fragment
   */
  static fragment( children = [] ) {
    const frag = document.createDocumentFragment();
    this.appendChildren( frag, children );
    return frag;
  }

  /**
   * Delegates event handling to a parent element.
   * @param {HTMLElement} parent - Parent element
   * @param {string} event - Event name
   * @param {string} selector - Child selector
   * @param {Function} handler - Event handler
   */
  static delegate( parent, event, selector, handler ) {
    parent.addEventListener( event, ( e ) => {
      const target = e.target.closest( selector );
      if( target && parent.contains( target ) ) {
        handler.call( target, e );
      }
    } );
  }
}

// Export for use in other modules
if( typeof module !== 'undefined' && module.exports ) {
  module.exports = DOMHelper;
}
