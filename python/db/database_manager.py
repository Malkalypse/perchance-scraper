import mysql.connector
from mysql.connector import Error
import hashlib

class DatabaseManager:
    '''
    A reusable database manager for handling MySQL connections.
    Provides basic connect/close functionality.
    '''

    def __init__(
        self,
        host: str = "localhost",
        user: str = "root", 
        password: str = "", 
        database: str = ""
    ) -> None:
        self.host = host
        self.user = user
        self.password = password
        self.database = database
        self.conn = None
        self.cursor = None

    def connect( self ) -> None:
        '''Establish a database connection and create a cursor.'''

        # mysql.connector:
        #   Creates a connection to the MySQL server
        #   Returns a MySQLConnection object
        
        try:
            self.conn = mysql.connector.connect(
                host=self.host,
                user=self.user,
                password=self.password,
                database=self.database,
                charset="utf8mb4",
                use_unicode=True
            )
            self.cursor = self.conn.cursor() # object to execute queries
            print( f"Connected to database: {self.database}" )
            
        except Error as e:
            print( f"Error connecting to MySQL: {e}" )
            raise

    def close( self ) -> None:
        '''Close the database connection if open.'''

        if self.conn:
            self.conn.close()
            self.conn = None
            self.cursor = None
            print( "Database connection closed." )

    def _get_or_create(
        self,
        cache: dict,
        key: str,
        select_sql: str,
        insert_sql: str,
        insert_params: tuple,
    ) -> int | None:
        '''
        Generic get-or-create helper.
        - cache: dict for deduplication
        - raw_value: the original string (text or name)
        - select_sql: SQL to check existence
        - insert_sql: SQL to insert new record
        - insert_params: tuple of values to use in the INSERT statement
        '''

        if not key:
            return None
        
        if key in cache:
            return cache[key]

        self.cursor.execute( select_sql, (key,) )
        row = self.cursor.fetchone()

        if row:
            record_id = row[0]
        else:
            self.cursor.execute( insert_sql, insert_params )
            record_id = self.cursor.lastrowid

        cache[key] = record_id
        return record_id

    def _get_or_create_hash(
        self,
        cache: dict,
        table: str,
        text_value: str,
        text_column: str
    ):
        '''Get or create a record based on SHA-256 hash of text value.'''

        if not text_value:
            return None
        
        h = hashlib.sha256( text_value.encode("utf-8") ).hexdigest()

        return self._get_or_create(
            cache,
            h,
            f"SELECT id FROM {table} WHERE hash = %s",
            f"INSERT INTO {table} (hash, {text_column}) VALUES (%s, %s)",
            (h, text_value),
        )

    def _get_or_create_name(
        self,
        cache: dict,
        table: str,
        name_value: str,
        extra_columns=None,
        extra_values=None
    ):
        '''Get or create a record based on name value.'''

        if not name_value or not str( name_value ).strip():
            return None
        
        cols = ["name"] + (extra_columns or [])
        placeholders = ", ".join(["%s"] * len(cols))

        return self._get_or_create(
            cache,
            name_value,
            f"SELECT id FROM {table} WHERE name = %s",
            f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})",
            (name_value, *(extra_values or [])),
        )