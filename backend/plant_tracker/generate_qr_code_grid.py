'''Contains functions used to generate a grid of URL QR codes, each with the
same URL prefix followed by a random UUID. Used by /get_qr_codes endpoint.
'''

import io
from uuid import uuid4

import segno
import cairosvg
from PIL import Image, ImageDraw
from django.conf import settings


LOGO_SVG_PATH = "plant_tracker/static/plant_tracker/favicon.svg"


def get_scaled_logo(size):
    '''Returns PIL.Image containing logo SVG scaled to requested size (px).'''
    image = io.BytesIO()
    cairosvg.svg2png(
        url=LOGO_SVG_PATH,
        write_to=image,
        output_width=size,
        output_height=size
    )
    image.seek(0)
    # Convert SVG to RGBA PNG (preserve alpha channel)
    return Image.open(image).convert("RGBA")


def get_logo_overlay(qr_size):
    '''Takes QR code size (px), returns logo overlay PNG as PIL.Image.'''

    # Create white circle background for logo (diameter = 40% of QR height)
    circle_size = int(qr_size * 0.4)
    circle_mask = Image.new("L", (circle_size, circle_size), 0)
    draw = ImageDraw.Draw(circle_mask)
    draw.ellipse((0, 0, circle_size, circle_size), fill=255)
    white_circle = Image.new("RGB", (circle_size, circle_size), "white")
    overlay = Image.new('RGBA', (circle_size, circle_size), (0, 0, 0, 0))
    overlay.paste(white_circle, (0, 0), circle_mask)

    # Convert SVG logo to PNG resized to 75% of circle diameter
    logo_size = int(circle_size * 0.75)
    logo_img = get_scaled_logo(logo_size)

    # Paste logo into center of white circle
    logo_left = (circle_size - logo_size) // 2
    logo_top = (circle_size - logo_size) // 2
    overlay.paste(logo_img, (logo_left, logo_top), logo_img)

    return overlay


def generate_random_qr():
    '''Returns pyqrcode instance with URL_PREFIX + random UUID.'''
    return segno.make(f"{settings.URL_PREFIX}{uuid4().hex}", error="H", micro=False)


def get_qr_png(scale=5):
    '''Returns PIL.Image containing QR code with URL_PREFIX + random UUID.'''
    image = io.BytesIO()
    qr_data = generate_random_qr()
    qr_data.save(image, scale=scale, border=3, kind='png')
    image.seek(0)

    # Convert QR code to PIL.Image
    return Image.open(image).convert('RGB')


def calculate_qr_width_and_scale(qr_per_row, page_width):
    '''Calculates largest QR code scale that will fit the requested grid size.
    Takes qr_per_row (grid size) and page width (int).
    Returns scaled QR code width (pixels) and scaling factor (get_qr_png arg).
    '''

    # Get absolute max width for configured page dimensions
    max_width = int(page_width / qr_per_row)

    # Generate test QR code (minimum size for URL), calculate scaling factor
    test_qr = generate_random_qr()
    qr_scale = int(max_width / test_qr.symbol_size(border=3)[0])
    qr_width = test_qr.symbol_size(qr_scale, border=3)[0]

    # Prevent ZeroDivisionError when URL_PREFIX is extremely long
    # Happens when test_qr exceeds max_width, resulting in qr_scale of 0
    if qr_width == 0:
        raise RuntimeError(
            "Unable to generate, decrease qr_per_row or use shorter URL_PREFIX"
        )

    return qr_width, qr_scale


def calculate_grid_margin_sizes(qr_width, qr_per_row, qr_per_col, page_width, page_height):
    '''Calculates horizontal and vertical margins for a given QR size and grid.
    Takes QR code width (px), codes per row and column, and page dimensions.
    Returns horizontal margin width (pixels) and vertical margin width (pixels).
    '''

    # Get number of margins for requested grid size
    margins_per_row = qr_per_row - 1
    margins_per_col = qr_per_col - 1

    # Get total vertical and horizontal extra space
    row_margin_total = page_width - qr_width * qr_per_row
    col_margin_total = page_height - qr_width * qr_per_col

    # Divide extra space evenly into margins between QR codes
    row_margin_each = int(row_margin_total / margins_per_row)
    col_margin_each = int(col_margin_total / margins_per_col)

    return row_margin_each, col_margin_each


# Default dimensions are for 8.5 x 11 sheet of paper at 300 dpi
# Height reduced 100px to accommodate timestamp added by browser
def generate_layout(qr_per_row=8, page_width=2400, page_height=3200):
    '''Returns PIL.Image containing an evenly spaced grid of QR codes.
    Takes QR codes per row (int), page width (int), and page height (int).
    QR code dimensions vary based on URL length and number per row.
    '''

    # Limit qr_per_row to reasonable values
    # Below 2 results in ZeroDivisionError, above 25 is unprintable
    if not 2 <= qr_per_row <= 25:
        raise ValueError("qr_per_row must be an integer between 2 and 25")

    # Get max QR width that fits requested grid, scaling factor for max width
    qr_width, qr_scale = calculate_qr_width_and_scale(qr_per_row, page_width)

    # Calculate number of max-width QR codes per column
    qr_per_col = int(page_height / qr_width)

    # Get horizontal and vertical margin width (pixels)
    row_margin_each, col_margin_each = calculate_grid_margin_sizes(
        qr_width,
        qr_per_row,
        qr_per_col,
        page_width,
        page_height
    )

    # Create blank page
    page = Image.new('RGB', (page_width, page_height), 'white')

    # Get logo for requested QR code size (added to center of each QR code)
    logo = get_logo_overlay(qr_width)
    # Get logo margin width (top-left corner coordinates to center logo)
    logo_margin = (qr_width - logo.size[0]) // 2

    # Generate evenly-spaced grid of random QR codes
    for row in range(qr_per_col):
        for col in range(qr_per_row):
            qr_img = get_qr_png(qr_scale)
            # Add logo to center of QR code
            qr_img.paste(logo, (logo_margin, logo_margin), logo)

            # Calculate coordinates of QR code top-left corner
            x_position = col * (qr_width + row_margin_each)
            y_position = row * (qr_width + col_margin_each)

            # Insert QR code into page
            page.paste(qr_img, (x_position, y_position))

    return page
