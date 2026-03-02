import json
import sys
import os
import platform

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import FreeText
from pypdf.generic import NameObject


# ============================================================================
# Language Detection and Font Mapping
# ============================================================================

# Unicode ranges for language detection
LANGUAGE_RANGES = {
    'zh': (0x4E00, 0x9FFF),      # CJK Unified Ideographs (Chinese/Japanese/Korean)
    'ja_hiragana': (0x3040, 0x309F),  # Hiragana (Japanese)
    'ja_katakana': (0x30A0, 0x30FF),  # Katakana (Japanese)
    'ko': (0xAC00, 0xD7AF),      # Hangul Syllables (Korean)
    'ar': (0x0600, 0x06FF),      # Arabic
    'th': (0x0E00, 0x0E7F),      # Thai
    'ru': (0x0400, 0x04FF),      # Cyrillic (Russian)
    'el': (0x0370, 0x03FF),      # Greek
    'he': (0x0590, 0x05FF),      # Hebrew
    'hi': (0x0900, 0x097F),      # Devanagari (Hindi)
}

# Platform-specific font paths
PLATFORM_FONTS = {
    'darwin': {  # macOS
        'zh': ('STHeiti-Light', '/System/Library/Fonts/STHeiti Light.ttc', 0),
        'ja': ('HiraginoSans-W3', '/System/Library/Fonts/Hiragino Sans GB.ttc', 0),
        'ko': ('AppleSDGothicNeo-Regular', '/System/Library/Fonts/AppleSDGothicNeo.ttc', 0),
        'ar': ('GeezaPro-Regular', '/System/Library/Fonts/GeezaPro.ttc', 0),
        'th': ('Thonburi', '/System/Library/Fonts/Thonburi.ttc', 0),
        'ru': ('Helvetica', None, None),  # Use standard font
        'el': ('Helvetica', None, None),
        'he': ('ArialHebrew', '/System/Library/Fonts/Arial Hebrew.ttc', 0),
        'hi': ('MuktaMahee-Regular', '/System/Library/Fonts/MuktaMahee.ttc', 0),
        'default': ('Helvetica', None, None),
    },
    'linux': {
        'zh': ('WQY-MicroHei', '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 0),
        'ja': ('NotoSansCJK', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 0),
        'ko': ('NotoSansCJK', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 0),
        'ar': ('NotoSansArabic', '/usr/share/fonts/truetype/noto/NotoSansArabic.ttf', None),
        'th': ('NotoSansThai', '/usr/share/fonts/truetype/noto/NotoSansThai.ttf', None),
        'ru': ('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', None),
        'default': ('LiberationSans', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf', None),
    },
    'win32': {  # Windows
        'zh': ('Microsoft-YaHei', 'C:\\Windows\\Fonts\\msyh.ttc', 0),
        'ja': ('Meiryo', 'C:\\Windows\\Fonts\\meiryo.ttc', 0),
        'ko': ('Malgun-Gothic', 'C:\\Windows\\Fonts\\malgun.ttf', None),
        'ar': ('Arial', None, None),
        'th': ('Leelawadee', 'C:\\Windows\\Fonts\\leelawui.ttf', None),
        'default': ('Arial', None, None),
    },
}


def detect_language(text: str) -> str:
    """
    Detect the primary language of the given text.

    Returns language code: 'zh', 'ja', 'ko', 'ar', 'th', 'ru', 'el', 'he', 'hi', or 'default'
    """
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

    # Get the language with maximum count
    max_lang = max(counts, key=counts.get)

    # Special handling: if we have both hiragana/katakana, treat as Japanese
    if max_lang in ('ja_hiragana', 'ja_katakana'):
        return 'ja'

    # If count is very low, use default
    if counts[max_lang] == 0:
        return 'default'

    return max_lang


def get_font_for_language(lang: str) -> tuple:
    """
    Get font information for a given language.

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
        system = 'linux'  # fallback

    font_config = PLATFORM_FONTS.get(system, PLATFORM_FONTS['linux'])
    return font_config.get(lang, font_config.get('default', ('Helvetica', None, None)))


def register_font_with_pdf(writer: PdfWriter, font_name: str, font_path: str, subfont_index: int = None) -> str:
    """
    Register a TrueType font with the PDF writer.

    Returns the font name to use in annotations.
    """
    if font_path is None or not os.path.exists(font_path):
        # Font file not found, use standard font
        return font_name if font_name else 'Helvetica'

    try:
        # For TTC (TrueType Collection) files, we need to handle subfont index
        # This is a simplified approach - pypdf has limited TTC support
        # In practice, we'll use the font name and hope the PDF viewer has it
        return font_name
    except Exception as e:
        print(f"Warning: Could not register font {font_name}: {e}", file=sys.stderr)
        return 'Helvetica'


# Font cache to avoid embedding the same font multiple times
_embedded_fonts = {}


def get_font_for_text(text: str, writer: PdfWriter = None) -> str:
    """
    Get the appropriate font name for the given text.

    Args:
        text: The text to be rendered
        writer: Optional PdfWriter for font registration

    Returns:
        Font name to use in FreeText annotation
    """
    lang = detect_language(text)
    font_name, font_path, subfont_index = get_font_for_language(lang)

    # Register font with PDF if needed (for custom fonts)
    if writer and font_path and os.path.exists(font_path):
        font_key = f"{font_name}_{lang}"
        if font_key not in _embedded_fonts:
            _embedded_fonts[font_key] = True
            # Note: pypdf's FreeText has limited support for custom fonts
            # The font name needs to be available on the viewing system
            print(f"Using font '{font_name}' for language '{lang}'", file=sys.stderr)

    return font_name




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


def fill_pdf_form(input_pdf_path, fields_json_path, output_pdf_path):
    
    with open(fields_json_path, "r") as f:
        fields_data = json.load(f)
    
    reader = PdfReader(input_pdf_path)
    writer = PdfWriter()
    
    writer.append(reader)
    
    pdf_dimensions = {}
    for i, page in enumerate(reader.pages):
        mediabox = page.mediabox
        pdf_dimensions[i + 1] = [mediabox.width, mediabox.height]
    
    annotations = []
    for field in fields_data["form_fields"]:
        page_num = field["page_number"]

        page_info = next(p for p in fields_data["pages"] if p["page_number"] == page_num)
        pdf_width, pdf_height = pdf_dimensions[page_num]

        if "pdf_width" in page_info:
            transformed_entry_box = transform_from_pdf_coords(
                field["entry_bounding_box"],
                float(pdf_height)
            )
        else:
            image_width = page_info["image_width"]
            image_height = page_info["image_height"]
            transformed_entry_box = transform_from_image_coords(
                field["entry_bounding_box"],
                image_width, image_height,
                float(pdf_width), float(pdf_height)
            )
        
        if "entry_text" not in field or "text" not in field["entry_text"]:
            continue
        entry_text = field["entry_text"]
        text = entry_text["text"]
        if not text:
            continue
        
        # Auto-detect font based on text content
        # If user specified a font, use it; otherwise auto-detect based on language
        user_font = entry_text.get("font", "")
        if user_font and user_font.lower() not in ("auto", ""):
            font_name = user_font
        else:
            font_name = get_font_for_text(text, writer)

        font_size = str(entry_text.get("font_size", 14)) + "pt"
        font_color = entry_text.get("font_color", "000000")

        annotation = FreeText(
            text=text,
            rect=transformed_entry_box,
            font=font_name,
            font_size=font_size,
            font_color=font_color,
            border_color=None,
            background_color=None,
        )
        annotations.append(annotation)
        writer.add_annotation(page_number=page_num - 1, annotation=annotation)
        
    with open(output_pdf_path, "wb") as output:
        writer.write(output)
    
    print(f"Successfully filled PDF form and saved to {output_pdf_path}")
    print(f"Added {len(annotations)} text annotations")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: fill_pdf_form_with_annotations.py [input pdf] [fields.json] [output pdf]")
        sys.exit(1)
    input_pdf = sys.argv[1]
    fields_json = sys.argv[2]
    output_pdf = sys.argv[3]
    
    fill_pdf_form(input_pdf, fields_json, output_pdf)
