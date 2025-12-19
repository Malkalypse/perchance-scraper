import hashlib
from db.database_manager import DatabaseManager

class PerchanceDatabaseManager(DatabaseManager):

    def __init__( self, **kwargs ):
        super().__init__( database="perchance_gallery", **kwargs )
        
        self.positive_prompt_cache    = {}
        self.negative_prompt_cache    = {}
        self.title_cache              = {}
        self.style_cache              = {}
        self.prompt_combination_cache = {}


    # _get_or_create() helper methods

    def get_or_create_positive_prompt( self, prompt_text: str ):
        return self._get_or_create_hash(
            self.positive_prompt_cache,
            "positive_prompts",
            prompt_text,
            text_column="prompt_text"
        )

    def get_or_create_negative_prompt( self, prompt_text: str ):
        return self._get_or_create_hash(
            self.negative_prompt_cache,
            "negative_prompts",
            prompt_text,
            text_column="prompt_text"
        )

    def get_or_create_title( self, title_text: str ):
        return self._get_or_create_hash(
            self.title_cache,
            "titles",
            title_text,
            text_column="title_text"
        )

    def get_or_create_style( self, style_name: str ):
        return self._get_or_create_name(
            self.style_cache,
            "art_styles",
            style_name,
            extra_columns=["style_string"],
            extra_values=[""]
        )

    def get_or_create_prompt_combination(
        self,
        positive_prompt_id: int | None,
        negative_prompt_id: int | None
    ):
        combined   = f"{positive_prompt_id or 'NULL'}|||{negative_prompt_id or 'NULL'}"
        combo_hash = hashlib.sha256( combined.encode( "utf-8" ) ).hexdigest()

        return self._get_or_create(
            self.prompt_combination_cache,
            combo_hash,
            "SELECT id FROM prompt_combinations WHERE hash = %s",
            "INSERT INTO prompt_combinations (positive_prompt_id, negative_prompt_id, hash) VALUES (%s, %s, %s)",
            (positive_prompt_id, negative_prompt_id, combo_hash),
        )
    

    def image_exists( self, filename: str ) -> bool:
        self.cursor.execute( "SELECT id FROM images WHERE filename = %s", (filename,) )
        return self.cursor.fetchone() is not None


    def insert_image( self, item: dict ) -> int:
        '''Insert an image record into the database. Returns the new image ID.'''

        # Get component IDs
        pp_id    = self.get_or_create_positive_prompt( item["prompt"] )
        np_id    = self.get_or_create_negative_prompt( item["negative_prompt"] )
        combo_id = self.get_or_create_prompt_combination( pp_id, np_id )
        style_id = self.get_or_create_style( item["art_style"] )
        title_id = self.get_or_create_title( item["title"] )

        # Insert image record
        self.cursor.execute(
            """
            INSERT INTO images 
            (filename, prompt_combination_id, art_style_id, title_id, seed, date_downloaded, deleted, tags)
            VALUES (%s, %s, %s, %s, %s, %s, 0, '')
            """,
            (
                item["filename"],
                combo_id,
                style_id,
                title_id,
                item["seed"],
                item["date_downloaded"],
            ),
        )

        self.conn.commit()

        return self.cursor.lastrowid