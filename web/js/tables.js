// Load state from localStorage or use defaults
let currentTable      = localStorage.getItem( 'tables_currentTable' ) || 'art-styles';
let currentOffset     = 0;
let currentLimit      = parseInt( localStorage.getItem( 'tables_currentLimit' ) ) || 200;
let currentSortColumn = localStorage.getItem( 'tables_currentSortColumn' ) || 'image_count';
let currentSortOrder  = localStorage.getItem( 'tables_currentSortOrder' ) || 'desc';

// Cache for preloaded table data
const tableCache = {
  'art-styles':       null,
  'positive-prompts': null,
  'negative-prompts': null,
  'tags':             null,
  'tokens':           null
};

// Table counts (loaded from cache)
let tableCounts = {};

// Table name formatting
const tableNames = {
  'art-styles':       'art styles',
  'positive-prompts': 'positive prompts',
  'negative-prompts': 'negative prompts',
  'tags':             'tags',
  'tokens':           'tokens'
};

// Handle table selection
const tableSelect = document.getElementById( 'tableSelect' );
const containers  = document.querySelectorAll( '.data-table-container' );
const limitInput  = document.getElementById( 'limit' );
const prevBtn     = document.getElementById( 'prev' );
const nextBtn     = document.getElementById( 'next' );

tableSelect.addEventListener( 'change', function () {

  currentTable  = this.value;
  currentOffset = 0;

  // Set appropriate default sort column for each table
  if( currentTable === 'tokens' ) {
    currentSortColumn = 'positive_count';
  } else {
    currentSortColumn = 'image_count';
  }
  currentSortOrder = 'desc';

  // Save to localStorage
  localStorage.setItem( 'tables_currentTable', currentTable );
  localStorage.setItem( 'tables_currentSortColumn', currentSortColumn );
  localStorage.setItem( 'tables_currentSortOrder', currentSortOrder );

  // Hide all containers
  containers.forEach( container => {
    container.classList.remove( 'active' );
  } );

  // Show selected container
  const selectedContainer = document.getElementById( currentTable + '-container' );
  if( selectedContainer ) {
    selectedContainer.classList.add( 'active' );
    updateSortIndicators();

    // If cached, render immediately; otherwise load
    if( tableCache[currentTable] ) {
      renderTableData( tableCache[currentTable] );
    } else {
      loadTableData();
    }
  }

} );

// Navigation controls
prevBtn.addEventListener( 'click', function () {
  if( currentOffset > 0 ) {
    currentOffset = Math.max( 0, currentOffset - currentLimit );
    loadTableData();
  }
} );

nextBtn.addEventListener( 'click', function () {
  currentOffset += currentLimit;
  loadTableData();
} );

limitInput.addEventListener( 'change', function () {
  currentLimit = parseInt( this.value ) || 200;
  currentOffset = 0;
  localStorage.setItem( 'tables_currentLimit', currentLimit );
  loadTableData();
} );

// Handle column sorting
function setupSortHandlers() {
  containers.forEach( container => {
    const arrows = container.querySelectorAll( '.sort-arrow' );

    arrows.forEach( arrow => {
      arrow.addEventListener( 'click', function ( e ) {
        e.stopPropagation(); // Prevent header click

        // Don't allow clicking active arrow
        if( this.classList.contains( 'active' ) ) {
          return;
        }

        const header      = this.closest( 'th[data-sort]' );
        const sortColumn  = header.getAttribute( 'data-sort' );
        const sortOrder   = this.getAttribute( 'data-order' );

        currentSortColumn = sortColumn;
        currentSortOrder  = sortOrder;
        currentOffset     = 0; // reset to first page when sorting

        // Save to localStorage
        localStorage.setItem( 'tables_currentSortColumn', currentSortColumn );
        localStorage.setItem( 'tables_currentSortOrder', currentSortOrder );

        updateSortIndicators();
        loadTableData();
      } );
    } );

  } );
}

// Update sort indicators in headers
function updateSortIndicators() {
  const container = document.getElementById( currentTable + '-container' );
  const headers   = container.querySelectorAll( 'th[data-sort]' );

  headers.forEach( header => {
    const sortColumn  = header.getAttribute( 'data-sort' );
    const ascArrow    = header.querySelector( '.sort-asc' );
    const descArrow   = header.querySelector( '.sort-desc' );

    // Remove active class from all arrows
    ascArrow.classList.remove( 'active' );
    descArrow.classList.remove( 'active' );

    // Update for current sort column
    if( sortColumn === currentSortColumn ) {
      if( currentSortOrder === 'asc' ) {
        ascArrow.classList.add( 'active' );
      } else {
        descArrow.classList.add( 'active' );
      }
    }
  } );
}

// Load data for current table
async function loadTableData() {
  const container = document.getElementById( currentTable + '-container' );
  const loading   = container.querySelector( '.loading' );
  const table     = container.querySelector( '.data-table' );

  try {
    loading.classList.add( 'active' );

    // Show count in loading message if available
    const count       = tableCounts[currentTable];
    const countText   = count ? ` ${count.toLocaleString()}` : '';
    const tableName   = tableNames[currentTable] || currentTable.replace( '-', ' ' );
    loading.innerHTML = `Loading${countText} ${tableName}...<br><small style="font-size: 14px; color: var(--text-secondary);">(Please wait, this may take a moment)</small>`;

    const response = await fetch( `api/tables_data.php?table=${currentTable}&limit=${currentLimit}&offset=${currentOffset}&sort=${currentSortColumn}&order=${currentSortOrder}` );

    if( !response.ok ) throw new Error( 'Network response was not ok' );

    const data = await response.json();

    if( data.error ) {
      throw new Error( data.error );
    }

    // Cache the data for this table
    tableCache[currentTable] = data;

    renderTableData( data );

  } catch( error ) {
    loading.classList.add( 'active' );
    loading.innerHTML = `<div class="error">Error loading data: ${error.message}</div>`;
  }
}

// Render table data from cache or fresh load
function renderTableData( data ) {
  const container = document.getElementById( currentTable + '-container' );
  const loading   = container.querySelector( '.loading' );
  const table     = container.querySelector( '.data-table' );
  const tbody     = container.querySelector( 'tbody' );

  // Populate table
  tbody.innerHTML = '';
  if( data.length === 0 ) {
    tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 40px;">No data found</td></tr>';
  } else {
    data.forEach( row => {
      const tr = document.createElement( 'tr' );

      switch( currentTable ) {
        case 'art-styles':
          tr.innerHTML = `
            <td>${row.id}</td>
            <td>${escapeHtml( row.style_string )}</td>
            <td>${row.image_count}</td>
          `;
          break;
        case 'positive-prompts':
        case 'negative-prompts':
          tr.innerHTML = `
            <td>${row.id}</td>
            <td>${escapeHtml( row.prompt_text )}</td>
            <td>${row.combinations_count}</td>
            <td>${row.image_count}</td>
          `;
          break;
        case 'tags':
          tr.innerHTML = `
            <td>${row.id}</td>
            <td>${escapeHtml( row.name )}</td>
            <td>${row.image_count}</td>
          `;
          break;
        case 'tokens':
          tr.innerHTML = `
          <td>${row.id}</td>
          <td>${escapeHtml( row.token )}</td>
          <td>${row.positive_count}</td>
          <td>${row.negative_count}</td>
          `;
          break;
      }

      tbody.appendChild( tr );
    } );
  }

  loading.classList.remove( 'active' );
  table.style.display = 'table';

  // Update button states
  prevBtn.disabled = currentOffset === 0;
  nextBtn.disabled = data.length < currentLimit;
}

// Preload all tables on page load
async function preloadAllTables() {
  const tables = ['art-styles', 'positive-prompts', 'negative-prompts', 'tags', 'tokens'];
  const sortDefaults = {
    'art-styles':       'image_count',
    'positive-prompts': 'image_count',
    'negative-prompts': 'image_count',
    'tags':             'image_count',
    'tokens':           'positive_count'
  };

  // Preload tables in parallel with timeout
  const promises = tables.map( tableName => {
    return new Promise( async ( resolve ) => {
      try {
        const sortColumn  = sortDefaults[tableName];
        const controller  = new AbortController();
        const timeoutId   = setTimeout( () => controller.abort(), 10000 ); // 10 second timeout

        const response = await fetch(
          `api/tables_data.php?table=${tableName}&limit=${currentLimit}&offset=0&sort=${sortColumn}&order=desc`,
          { signal: controller.signal }
        );

        clearTimeout( timeoutId );

        if( response.ok ) {
          const data = await response.json();
          if( !data.error ) {
            tableCache[tableName] = data;
          }
        }
      } catch( error ) {
        // Silently fail preloading - table will load on demand
        console.debug( `Skipped preloading ${tableName}:`, error.message );
      }

      resolve();
    } );
  } );

  // Don't await all promises - let them complete in background
  Promise.all( promises ).then( () => {
    console.debug( 'Preloading complete' );
  } );
}

// Load table counts from cache
async function loadTableCounts() {
  try {
    const response = await fetch( 'api/table_counts.php' );
    if( response.ok ) {
      tableCounts = await response.json();
    }
  } catch( error ) {
    console.warn( 'Failed to load table counts:', error );
  }
}

// Escape HTML to prevent XSS
function escapeHtml( text ) {
  const div       = document.createElement( 'div' );
  div.textContent = text;
  return div.innerHTML;
}

// Load initial table
window.addEventListener( 'DOMContentLoaded', async function () {
  // Set form values from localStorage
  tableSelect.value = currentTable;
  limitInput.value  = currentLimit;

  setupSortHandlers();

  // Show the selected table container
  containers.forEach( container => {
    container.classList.remove( 'active' );
  } );

  const selectedContainer = document.getElementById( currentTable + '-container' );

  if( selectedContainer ) {
    selectedContainer.classList.add( 'active' );
  }

  updateSortIndicators();

  await loadTableCounts();  // load table counts first (fast from cache)
  loadTableData();          // load the initial table
  preloadAllTables();       // start preloading all tables in the background

} );
