# PDF Translation to Chinese

Expert skill for translating PDF documents to Chinese with proper CJK character support.

## Core Principles

This skill ensures reliable Chinese text handling in PDF translation workflows by avoiding tools with poor CJK support.

## Implementation Guidelines

### 1. Text Extraction (PyPDF2)

**Always use PyPDF2 for text extraction from PDFs.**

```python
from PyPDF2 import PdfReader

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF using PyPDF2."""
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    return text
```

**Why PyPDF2?**
- Reliable CJK character extraction
- Maintains text encoding properly
- Well-tested with Chinese, Japanese, Korean characters
- Minimal text corruption

### 2. PDF Generation (reportlab with CJK fonts)

**Use reportlab with proper CJK font configuration for generating translated PDFs.**

```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register CJK font
pdfmetrics.registerFont(TTFont('CJKFont', 'path/to/cjk/font.ttf'))

def create_translated_pdf(text, output_path):
    """Create PDF with Chinese text using CJK font."""
    c = canvas.Canvas(output_path, pagesize=letter)
    c.setFont('CJKFont', 12)
    c.drawString(100, 750, text)
    c.save()
```

**Recommended CJK Fonts:**
- Simplified Chinese: `SimSun`, `SimHei`, `Microsoft YaHei`
- Traditional Chinese: `MingLiU`, `PMingLiU`
- Japanese: `MS Gothic`, `IPAGothic`
- Korean: `Malgun Gothic`, `Dotum`

**Alternative: Use pdfkit (wkhtmltopdf wrapper)**
```python
import pdfkit

def create_pdf_from_html(html_content, output_path):
    """Generate PDF from HTML with proper CJK encoding."""
    options = {
        'encoding': 'UTF-8',
        'quiet': ''
    }
    pdfkit.from_string(html_content, output_path, options=options)
```

### 3. Tools to Avoid

**DO NOT use the following for Chinese text processing:**

#### pdf-parse
```javascript
// ❌ AVOID - Poor CJK support
const pdfParse = require('pdf-parse');
// Causes character encoding issues with Chinese text
```

**Problems:**
- CJK characters often render as garbled text
- Encoding detection fails for multi-byte characters
- Text corruption common with complex scripts

#### pdfjs-dist (for extraction)
```javascript
// ❌ AVOID for Chinese text extraction
const pdfjsLib = require('pdfjs-dist');
// While excellent for display, extraction has CJK issues
```

**Problems:**
- Better for PDF rendering than text extraction
- CJK text extraction unreliable
- Requires additional font mapping for Chinese

**Note:** pdfjs-dist is acceptable for PDF viewing/rendering, but not for text extraction workflows.

## Common Issues and Solutions

### Issue: Garbled Chinese Characters

**Symptoms:** Text displays as ``, `???`, or random symbols

**Solutions:**
1. Ensure UTF-8 encoding throughout pipeline
2. Use PyPDF2 for extraction (not pdf-parse)
3. Register proper CJK fonts in reportlab
4. Verify font files support required Unicode ranges

### Issue: Missing Characters in Generated PDF

**Symptoms:** Some Chinese characters display as squares or blanks

**Solutions:**
1. Use comprehensive CJK fonts (e.g., `SimSun` for 20,000+ characters)
2. Fallback font chain for uncommon characters
3. Verify font files are not corrupted

### Issue: Text Extraction Returns Empty String

**Symptoms:** PyPDF2 returns `""` for image-based PDFs

**Solutions:**
1. Detect if PDF is scanned/image-based
2. Use OCR (Tesseract) with Chinese language pack:
```bash
apt-get install tesseract-ocr-chi-sim  # Simplified Chinese
apt-get install tesseract-ocr-chi-tra  # Traditional Chinese
```

3. OCR workflow:
```python
import pytesseract
from PIL import Image
from pdf2image import convert_from_path

def ocr_pdf(pdf_path):
    """OCR for image-based PDFs."""
    images = convert_from_path(pdf_path)
    text = ""
    for image in images:
        text += pytesseract.image_to_string(image, lang='chi_sim')
    return text
```

## Workflow Example

Complete PDF translation workflow:

```python
from PyPDF2 import PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import json

def translate_pdf_to_chinese(input_pdf, output_pdf):
    """Complete PDF translation workflow."""

    # 1. Extract text using PyPDF2
    reader = PdfReader(input_pdf)
    extracted_text = ""
    for page in reader.pages:
        extracted_text += page.extract_text()

    # 2. Translate (using translation API)
    # translated_text = translate_api(extracted_text, target='zh-CN')

    # For demo, use original text
    translated_text = extracted_text

    # 3. Generate PDF with CJK font support
    pdfmetrics.registerFont(
        TTFont('SimSun', '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc')
    )

    c = canvas.Canvas(output_pdf, pagesize=letter)
    c.setFont('SimSun', 12)

    # Handle multi-page text
    lines = translated_text.split('\n')
    y_position = 750

    for line in lines:
        if y_position < 50:
            c.showPage()
            c.setFont('SimSun', 12)
            y_position = 750
        c.drawString(50, y_position, line)
        y_position -= 20

    c.save()
    return output_pdf
```

## Best Practices

1. **Always validate CJK support** before processing:
   ```python
   def has_cjk(text):
       import re
       cjk_pattern = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]')
       return bool(cjk_pattern.search(text))
   ```

2. **Font verification** before generation:
   ```python
   def verify_cjk_font(font_path):
       from fontTools.ttLib import TTFont
       font = TTFont(font_path)
       # Check for CJK Unicode ranges
       cmap = font['cmap']
       return has_cjk_chars(cmap)
   ```

3. **Error handling** for encoding issues:
   ```python
   try:
       text = page.extract_text()
       text.encode('utf-8')  # Verify encoding
   except UnicodeEncodeError:
       # Fallback to alternative extraction
       pass
   ```

4. **Logging** for troubleshooting:
   ```python
   import logging
   logging.basicConfig(level=logging.INFO)
   logger = logging.getLogger('pdf-translate')

   logger.info(f"Extracted {len(extracted_text)} characters")
   logger.info(f"CJK ratio: {calculate_cjk_ratio(extracted_text):.2%}")
   ```

## Testing

Validate your translation workflow:

```python
def test_pdf_translation():
    # Test with sample Chinese PDF
    input_pdf = "test_chinese.pdf"
    output_pdf = "test_translated.pdf"

    result = translate_pdf_to_chinese(input_pdf, output_pdf)

    # Verify output
    assert os.path.exists(output_pdf)
    assert has_cjk(extract_text_from_pdf(output_pdf))
    print("✓ PDF translation test passed")
```

## Resources

- **PyPDF2 Documentation**: https://pypdf2.readthedocs.io/
- **reportlab CJK Guide**: https://www.reportlab.com/documentation/
- **CJK Fonts**:
  - WQY Microhei: https://github.com/adobe-fonts/source-han-sans
  - Noto Sans CJK: https://github.com/googlefonts/noto-cjk
- **Tesseract OCR**: https://github.com/tesseract-ocr/tesseract
