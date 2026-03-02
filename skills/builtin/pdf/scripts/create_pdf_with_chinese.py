#!/usr/bin/env python3
"""
Create PDF with Chinese (and other CJK) font support.

This script supports creating PDFs with Chinese, Japanese, and Korean text
by registering system CJK fonts with ReportLab.

Usage:
    python3 create_pdf_with_chinese.py output.pdf "中文标题" "中文内容..."

Or as a module:
    from create_pdf_with_chinese import create_chinese_pdf
    create_chinese_pdf("output.pdf", [("标题", "title"), ("内容", "normal")])
"""

import sys
import os
from pathlib import Path


def register_cjk_fonts():
    """
    Register CJK (Chinese/Japanese/Korean) fonts with ReportLab.

    Returns a dict with font names for 'normal', 'bold', 'title' etc.
    """
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    # Platform-specific font paths
    font_configs = {
        'darwin': {  # macOS
            'fonts': [
                # Use individual TTF files from TTC if available
                # STHeiti (华文黑体) - macOS Chinese font
                ('/System/Library/Fonts/STHeiti Light.ttc', 'STHeiti-Light', 0),
                ('/System/Library/Fonts/STHeiti Medium.ttc', 'STHeiti-Medium', 0),
                # Try PingFang (might be in different location)
                ('/System/Library/Fonts/PingFang.ttc', 'PingFang-SC-Regular', 1),
                ('/System/Library/Fonts/PingFang.ttc', 'PingFang-SC-Medium', 2),
            ],
            'fallback': 'STHeiti-Light',
        },
        'linux': {
            'fonts': [
                ('/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 'WQY-MicroHei', 0),
                ('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 'NotoSansCJK', 0),
                ('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 'NotoSansCJK', 0),
                ('/usr/share/fonts/truetype/arphicuming/uming.ttc', 'AR-PL-Uming', 0),
            ],
            'fallback': 'WQY-MicroHei',
        },
        'win32': {
            'fonts': [
                ('C:\\Windows\\Fonts\\msyh.ttc', 'Microsoft-YaHei', 0),
                ('C:\\Windows\\Fonts\\simsun.ttc', 'SimSun', 0),
                ('C:\\Windows\\Fonts\\simhei.ttf', 'SimHei', 0),
            ],
            'fallback': 'Microsoft-YaHei',
        },
    }

    import platform
    system = platform.system().lower()

    # Normalize platform names
    if system == 'darwin':
        system = 'darwin'
    elif system.startswith('linux'):
        system = 'linux'
    elif system == 'windows':
        system = 'win32'

    config = font_configs.get(system, font_configs['linux'])
    registered_fonts = {}

    for font_path, font_name, subfont_index in config['fonts']:
        if os.path.exists(font_path):
            try:
                # For TTC files, we need to extract or use specific subfont
                # ReportLab's TTFont can handle TTC with subfontIndex
                try:
                    pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=subfont_index))
                    registered_fonts[font_name] = font_name
                    print(f"Registered font: {font_name} from {font_path}", file=sys.stderr)
                except Exception as e:
                    # Try without subfont index
                    try:
                        pdfmetrics.registerFont(TTFont(font_name, font_path))
                        registered_fonts[font_name] = font_name
                        print(f"Registered font: {font_name} from {font_path}", file=sys.stderr)
                    except:
                        print(f"Warning: Could not register {font_path}: {e}", file=sys.stderr)
            except Exception as e:
                print(f"Warning: Error registering {font_path}: {e}", file=sys.stderr)

    # Set up font mapping for different styles
    if registered_fonts:
        primary_font = list(registered_fonts.keys())[0]
        return {
            'normal': primary_font,
            'bold': primary_font,
            'title': primary_font,
            'heading': primary_font,
            'code': primary_font,
            'available': list(registered_fonts.keys()),
        }
    else:
        print("Warning: No CJK fonts found. Text may not display correctly.", file=sys.stderr)
        return None


def create_chinese_pdf(output_path: str, sections: list, font_config: dict = None):
    """
    Create a PDF with Chinese text support.

    Args:
        output_path: Path to save the PDF
        sections: List of tuples (text, style) where style is 'title', 'heading', 'normal', or 'code'
        font_config: Optional font configuration dict from register_cjk_fonts()
    """
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch

    # Register fonts
    if font_config is None:
        font_config = register_cjk_fonts()

    # Create document
    doc = SimpleDocTemplate(output_path, pagesize=A4)
    styles = getSampleStyleSheet()

    # Custom styles with Chinese font
    if font_config:
        custom_styles = {}
        for style_name in ['Title', 'Heading1', 'Heading2', 'Normal', 'Code', 'BodyText']:
            base_style = styles.get(style_name, styles['Normal'])
            custom_styles[style_name] = ParagraphStyle(
                style_name,
                parent=base_style,
                fontName=font_config.get('normal', 'Helvetica'),
                fontSize=base_style.fontSize,
                leading=base_style.leading * 1.2,  # More space for CJK characters
                wordWrap='CJK',  # Enable CJK word wrapping
            )
    else:
        custom_styles = {name: styles.get(name, styles['Normal']) for name in
                        ['Title', 'Heading1', 'Heading2', 'Normal', 'Code', 'BodyText']}

    # Build story
    story = []

    for text, style_name in sections:
        style = custom_styles.get(style_name.lower(), custom_styles['Normal'])
        # XML-escape special characters
        text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        para = Paragraph(text, style)
        story.append(para)
        story.append(Spacer(1, 0.2 * inch))

    # Build PDF
    doc.build(story)
    print(f"PDF created: {output_path}", file=sys.stderr)


def main():
    """Command-line interface."""
    if len(sys.argv) < 3:
        print("Usage: create_pdf_with_chinese.py <output.pdf> <text> [<text> ...]")
        print("\nEach text can be prefixed with style:")
        print("  title:<text>    - Title style")
        print("  heading:<text>  - Heading style")
        print("  normal:<text>   - Normal style (default)")
        print("\nExample:")
        print('  create_pdf_with_chinese.py output.pdf "title:中文报告标题" "normal:这是内容"')
        sys.exit(1)

    output_pdf = sys.argv[1]

    # Parse arguments
    sections = []
    for arg in sys.argv[2:]:
        if ':' in arg and arg.split(':', 1)[0] in ('title', 'heading', 'normal', 'code'):
            style, text = arg.split(':', 1)
            sections.append((text, style))
        else:
            sections.append((arg, 'normal'))

    # Create PDF
    create_chinese_pdf(output_pdf, sections)


if __name__ == "__main__":
    main()
