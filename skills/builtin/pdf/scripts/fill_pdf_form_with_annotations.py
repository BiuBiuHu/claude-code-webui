import json
import sys
import os
import platform
import io
from typing import List, Tuple

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ============================================================================
# Language Detection and Font Mapping
# ============================================================================

# Unicode ranges for language detection
LANGUAGE_RANGES = {
    'zh': (0x4E00, 0x9FFF),      # CJK Unified Ideographs
    'ja_hiragana': (0x3040, 0x309F),  # Hiragana
    'ja_katakana': (0x30A0, 0x30FF),  # Katakana
    'ko': (0xAC00, 0xD7AF),      # Hangul
    'ar': (0x0600, 0x06FF),      # Arabic
    'th': (0x0E00, 0x0E7F),      # Thai
    'ru': (0x0400, 0x04FF),      # Cyrillic
    'el': (0x0370, 0x03FF),      # Greek
    'he': (0x0590, 0x05FF),      # Hebrew
    'hi': (0x0900, 0x097F),      # Devanagari
}

# Platform-specific font paths
# Note: ReportLab doesn't support TTC files with PostScript outlines
# We use TTF fonts or specific TTC subfonts that work
PLATFORM_FONTS = {
    'darwin': {  # macOS
        # Chinese - STHeiti works well
        'zh': ('STHeitiLight', '/System/Library/Fonts/STHeiti Light.ttc', 0),
        # Japanese - try different fonts
        'ja': ('STHeitiLight', '/System/Library/Fonts/STHeiti Light.ttc', 0),  # Fallback to STHeiti
        # Korean - same, STHeiti supports CJK
        'ko': ('STHeitiLight', '/System/Library/Fonts/STHeiti Light.ttc', 0),
        # Arabic
        'ar': ('GeezaPro', '/System/Library/Fonts/GeezaPro.ttc', 0),
        # Thai
        'th': ('Thonburi', '/System/Library/Fonts/Thonburi.ttc', 0),
        # Cyrillic - standard fonts work
        'ru': ('Helvetica', None, None),
        # Greek
        'el': ('Helvetica', None, None),
        # Hebrew
        'he': ('ArialHebrew', '/System/Library/Fonts/Arial Hebrew.ttc', 0),
        # Hindi
        'hi': ('MuktaMahee', '/System/Library/Fonts/MuktaMahee.ttc', 0),
        # Default
        'default': ('Helvetica', None, None),
    },
    'linux': {
        'zh': ('WQY-MicroHei', '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 0),
        'ja': ('WQY-MicroHei', '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 0),
        'ko': ('WQY-MicroHei', '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 0),
        'ar': ('NotoSansArabic', '/usr/share/fonts/truetype/noto/NotoSansArabic.ttf', None),
        'th': ('NotoSansThai', '/usr/share/fonts/truetype/noto/NotoSansThai.ttf', None),
        'ru': ('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', None),
        'default': ('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', None),
    },
    'win32': {  # Windows
        'zh': ('MS-YaHei', 'C:\\Windows\\Fonts\\msyh.ttc', 0),
        'ja': ('MS-YaHei', 'C:\\Windows\\Fonts\\msyh.ttc', 0),  # Fallback
        'ko': ('Malgun-Gothic', 'C:\\Windows\\Fonts\\malgun.ttf', None),
        'ar': ('Arial', None, None),
        'th': ('Leelawadee', 'C:\\Windows\\Fonts\\leelawui.ttf', None),
        'default': ('Arial', None, None),
    },
}


def detect_language(text: str) -> str:
    """Detect the primary language of the given text."""
    if not text:
        return 'default'

    counts = {lang: 0 for lang in LANGUAGE_RANGES}
    counts['default'] = 0

    for char in text:
        code = ord(char)
        detected = False
        for lang, (start, end) in LANGUAGE_RANGES.items():
            if start <= code <= end:
                counts[lang] += 1
                detected = True
                break
        if not detected:
            counts['default'] += 1

    max_lang = max(counts, key=counts.get)
    if max_lang in ('ja_hiragana', 'ja_katakana'):
        return 'ja'
    if counts[max_lang] == 0:
        return 'default'
    return max_lang


def get_font_for_language(lang: str) -> Tuple[str, str, int]:
    """Get font information for a given language.

    Returns: (font_name, font_path, subfont_index)
    """
    system = platform.system().lower()
    if system == 'darwin':
        system = 'darwin'
    elif system.startswith('linux'):
        system = 'linux'
    elif system == 'windows':
        system = 'win32'
    else:
        system = 'linux'

    font_config = PLATFORM_FONTS.get(system, PLATFORM_FONTS['linux'])
    return font_config.get(lang, font_config.get('default', ('Helvetica', None, None)))


# Global font registry to avoid re-registering
_registered_fonts: set = set()


def ensure_font_registered(font_name: str, font_path: str, subfont_index: int = None) -> str:
    """Register a TrueType font with ReportLab if not already registered."""
    global _registered_fonts

    font_key = f"{font_name}_{subfont_index if subfont_index is not None else 0}"

    if font_key in _registered_fonts:
        return font_name

    if font_path is None or not os.path.exists(font_path):
        # Use standard font
        return 'Helvetica'

    try:
        if subfont_index is not None:
            # Try with subfont index for TTC files
            pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=subfont_index))
        else:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
        _registered_fonts.add(font_key)
        print(f"Registered font: {font_name}", file=sys.stderr)
        return font_name
    except Exception as e:
        print(f"Warning: Could not register font {font_name}: {e}", file=sys.stderr)
        return 'Helvetica'


def get_font_for_text(text: str) -> str:
    """Get the appropriate registered font name for the given text."""
    lang = detect_language(text)
    font_name, font_path, subfont_index = get_font_for_language(lang)
    return ensure_font_registered(font_name, font_path, subfont_index)


# ============================================================================
# Coordinate Transform
# ============================================================================

def transform_from_image_coords(bbox, image_width, image_height, pdf_width, pdf_height):
    x_scale = pdf_width / image_width
    y_scale = pdf_height / image_height

    left = bbox[0] * x_scale
    right = bbox[2] * x_scale

    top = pdf_height - (bbox[1] * y_scale)
    bottom = pdf_height - (bbox[3] * y_scale)

    return left, bottom, right, top


def transform_from_pdf_coords(bbox, pdf_height):
    left = bbox[0]
    right = bbox[2]

    pypdf_top = pdf_height - bbox[1]
    pypdf_bottom = pdf_height - bbox[3]

    return left, pypdf_bottom, right, pypdf_top


# ============================================================================
# Text Rendering with ReportLab
# ============================================================================

class TextField:
    """Represents a text field to be rendered on PDF."""
    def __init__(self, text: str, rect: Tuple[float, float, float, float],
                 font_size: int = 14, font_color: str = "000000"):
        self.text = text
        self.rect = rect  # (left, bottom, right, top) in PDF coordinates
        self.font_size = font_size
        self.font_color = font_color


def create_text_overlay_page(page_width: float, page_height: float,
                             text_fields: List[TextField]) -> bytes:
    """Create a PDF page with text overlay using ReportLab.

    Each text field gets its appropriate font based on language detection.

    Returns: PDF bytes
    """
    packet = io.BytesIO()

    # Create canvas with same dimensions as the page
    c = canvas.Canvas(packet, pagesize=(page_width, page_height))

    for field in text_fields:
        if not field.text:
            continue

        # Get appropriate font for THIS specific text (per-field language detection)
        font_name = get_font_for_text(field.text)

        # Convert hex color to RGB
        color_hex = field.font_color.lstrip('#')
        if len(color_hex) == 6:
            r = int(color_hex[0:2], 16) / 255.0
            g = int(color_hex[2:4], 16) / 255.0
            b = int(color_hex[4:6], 16) / 255.0
            c.setFillColorRGB(r, g, b)

        c.setFont(font_name, field.font_size)

        # PDF coordinates: (0,0) is bottom-left
        left, bottom, right, top = field.rect

        # Calculate text position
        # Draw text at the bottom of the bounding box
        text_x = left
        text_y = bottom + (field.font_size * 0.3)  # Small offset for baseline

        # Handle multi-line text if needed
        lines = field.text.split('\n')
        line_height = field.font_size * 1.2

        for i, line in enumerate(lines):
            y_pos = text_y + (len(lines) - 1 - i) * line_height
            c.drawString(text_x, y_pos, line)

    c.save()
    return packet.getvalue()


def merge_pdf_layers(base_pdf_path: str, overlay_bytes: bytes,
                     page_num: int, output_pdf_path: str):
    """Merge a text overlay page onto the base PDF page."""
    # Read base PDF
    base_reader = PdfReader(base_pdf_path)
    base_writer = PdfWriter()

    # Copy all pages to writer
    for page in base_reader.pages:
        base_writer.add_page(page)

    # Read overlay PDF
    overlay_reader = PdfReader(io.BytesIO(overlay_bytes))
    overlay_page = overlay_reader.pages[0]

    # Merge overlay onto target page
    if page_num < len(base_writer.pages):
        target_page = base_writer.pages[page_num]
        target_page.merge_page(overlay_page)

    # Write output
    with open(output_pdf_path, 'wb') as f:
        base_writer.write(f)


# ============================================================================
# Main Fill Function
# ============================================================================

def fill_pdf_form(input_pdf_path, fields_json_path, output_pdf_path):
    """Fill PDF form with multi-language text support."""

    with open(fields_json_path, "r", encoding='utf-8') as f:
        fields_data = json.load(f)

    reader = PdfReader(input_pdf_path)

    # Get PDF dimensions
    pdf_dimensions = {}
    for i, page in enumerate(reader.pages):
        mediabox = page.mediabox
        pdf_dimensions[i + 1] = [float(mediabox.width), float(mediabox.height)]

    # Group text fields by page
    text_fields_by_page: dict[int, List[TextField]] = {}
    for field in fields_data.get("form_fields", []):
        page_num = field["page_number"]

        # Find page info
        try:
            page_info = next(
                (p for p in fields_data.get("pages", []) if p["page_number"] == page_num),
                None
            )
            if not page_info:
                continue
        except StopIteration:
            continue

        pdf_width, pdf_height = pdf_dimensions.get(page_num, (595, 842))

        # Get bounding box
        if "pdf_width" in page_info:
            rect = transform_from_pdf_coords(
                field["entry_bounding_box"],
                float(pdf_height)
            )
        else:
            image_width = page_info["image_width"]
            image_height = page_info["image_height"]
            rect = transform_from_image_coords(
                field["entry_bounding_box"],
                image_width, image_height,
                float(pdf_width), float(pdf_height)
            )

        # Get text content
        if "entry_text" not in field or "text" not in field["entry_text"]:
            continue
        entry_text = field["entry_text"]
        text = entry_text["text"]
        if not text:
            continue

        font_size = entry_text.get("font_size", 14)
        font_color = entry_text.get("font_color", "000000")

        text_field = TextField(text, rect, font_size, font_color)

        if page_num not in text_fields_by_page:
            text_fields_by_page[page_num] = []
        text_fields_by_page[page_num].append(text_field)

    # Process each page
    current_pdf = input_pdf_path
    temp_output = output_pdf_path

    for page_num, text_fields in sorted(text_fields_by_page.items()):
        if not text_fields:
            continue

        page_width, page_height = pdf_dimensions[page_num]

        # Create overlay PDF with text
        overlay_bytes = create_text_overlay_page(page_width, page_height, text_fields)

        # Merge overlay onto current PDF
        merge_pdf_layers(current_pdf, overlay_bytes, page_num - 1, temp_output)

        # Use the merged PDF as base for next iteration
        current_pdf = temp_output

    # Copy to final location if no changes were made
    if not text_fields_by_page:
        import shutil
        shutil.copy(input_pdf_path, output_pdf_path)
        print(f"No text fields to fill, copied original to {output_pdf_path}", file=sys.stderr)
    else:
        total_fields = sum(len(fields) for fields in text_fields_by_page.values())
        print(f"Successfully filled PDF form and saved to {output_pdf_path}", file=sys.stderr)
        print(f"Added {total_fields} text fields across {len(text_fields_by_page)} pages", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: fill_pdf_form_with_annotations.py [input pdf] [fields.json] [output pdf]")
        sys.exit(1)
    input_pdf = sys.argv[1]
    fields_json = sys.argv[2]
    output_pdf = sys.argv[3]

    fill_pdf_form(input_pdf, fields_json, output_pdf)
