import os, io, sys
import requests
from requests.exceptions import RequestException
from PIL import Image

def process_image(
    source: str,
    output_path: str,
    max_dimension: int | None = None,   # None → no resize
    quality: int = 50,
    scraper: requests.Session = requests,
) -> str | None:
    """
    Load an image from a URL or local path, optionally resize, and compress/optimize.

    Args:
        source: URL (http/https) or local input path.
        output_path: Path to save optimized image.
        max_dimension: Maximum width or height in pixels. If None, no resizing is performed.
        quality: JPEG/WebP quality (1-100).
        scraper: requests-like object for HTTP GET (defaults to requests).

    Returns:
        Output filename (str) if successful, None otherwise.
    """
    try:
        # Decide whether source is a URL or local path
        if source.lower().startswith(("http://", "https://")):
            resp = scraper.get(source, timeout=10)
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content))
        else:
            img = Image.open(source)

        width, height = img.size

        # Resize only if max_dimension is set
        if max_dimension is not None and (width > max_dimension or height > max_dimension):
            if width > height:
                new_width = max_dimension
                new_height = int(height * (max_dimension / width))
            else:
                new_height = max_dimension
                new_width = int(width * (max_dimension / height))

            if (new_width, new_height) != (width, height):
                img = img.resize((new_width, new_height), Image.LANCZOS)

        # Handle color modes
        if img.mode == "RGBA" and output_path.lower().endswith((".jpg", ".jpeg")):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])  # alpha channel
            img = background
        elif img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Save parameters by format
        save_kwargs = {}
        ext = output_path.lower()
        if ext.endswith((".jpg", ".jpeg")):
            save_kwargs = {"quality": quality, "optimize": True}
        elif ext.endswith(".png"):
            save_kwargs = {"optimize": True, "compress_level": 6}
        elif ext.endswith(".webp"):
            save_kwargs = {"quality": quality, "method": 6}

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img.save(output_path, **save_kwargs)

        return os.path.basename(output_path)

    except RequestException as e:
        print(f"Failed to download {source}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error processing image: {e}", file=sys.stderr)
        return None