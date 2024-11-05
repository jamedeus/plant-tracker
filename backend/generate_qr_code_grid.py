import io
from uuid import uuid4

import pyqrcode
from PIL import Image

# Dimensions of 8.5 x 11 sheet of paper at 300 dpi
# Height reduced 100px to accommodate timestamp added by browser
page_width, page_height = 2400, 3200


def generate_random_qr(url_prefix):
    '''Returns pyqrcode instance with url_prefix + random UUID'''
    return pyqrcode.create(f"{url_prefix}{uuid4().hex}", error="H")


def get_qr_png(url_prefix, scale=5):
    '''Returns PIL.Image containing QR code with url_prefix + random UUID'''
    image = io.BytesIO()
    qr_data = generate_random_qr(url_prefix)
    qr_data.png(image, scale=scale)
    return Image.open(image)


def calculate_qr_width_and_scale(url_prefix, qr_per_row):
    '''Calculates largest QR code scale that will fit the requested grid size
    Takes url_prefix (determines minimum QR width) and qr_per_row (grid size)
    Returns scaled QR code width (pixels) and scaling factor (get_qr_png arg)
    '''

    # Get absolute max width for configured page dimensions
    max_width = int(page_width / qr_per_row)

    # Generate test QR code (minimum size for URL), calculate scaling factor
    test_qr = generate_random_qr(url_prefix)
    qr_scale = int(max_width / test_qr.get_png_size())
    qr_width = test_qr.get_png_size(qr_scale)

    # Prevent ZeroDivisionError when URL_PREFIX is extremely long
    # Happens when test_qr exceeds max_width, resulting in qr_scale of 0
    if qr_width == 0:
        raise RuntimeError(
            "Unable to generate, decrease qr_per_row or use shorter URL_PREFIX"
        )

    return qr_width, qr_scale


def calculate_grid_margin_sizes(qr_width, qr_per_row, qr_per_col):
    '''Calculates horizontal and vertical margins for a given QR size and grid
    Takes width of each QR code (pixels), codes per row, and codes per column
    Returns horizontal margin width (pixels) and vertical margin width (pixels)
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


def generate_layout(url_prefix, qr_per_row=8):
    '''Returns PIL.Image containing an evenly spaced grid of QR codes
    Takes url_prefix (manage endpoint without UUID) and QR codes per row (int)
    QR code dimensions vary based on URL length and number per row
    '''

    # Limit qr_per_row to reasonable values
    # Below 2 results in ZeroDivisionError, above 25 is unprintable
    if not 2 <= qr_per_row <= 25:
        raise ValueError("qr_per_row must be an integer between 2 and 25")

    # Get max QR width that fits requested grid, scaling factor for max width
    qr_width, qr_scale = calculate_qr_width_and_scale(url_prefix, qr_per_row)

    # Calculate number of max-width QR codes per column
    qr_per_col = int(page_height / qr_width)

    # Get horizontal and vertical margin width (pixels)
    row_margin_each, col_margin_each = calculate_grid_margin_sizes(
        qr_width,
        qr_per_row,
        qr_per_col
    )

    # Create blank page
    page = Image.new('RGB', (page_width, page_height), 'white')

    # Generate evenly-spaced grid of random QR codes
    for row in range(qr_per_col):
        for col in range(qr_per_row):
            qr_img = get_qr_png(url_prefix, qr_scale)

            # Calculate coordinates of QR code top-left corner
            x_position = col * (qr_width + row_margin_each)
            y_position = row * (qr_width + col_margin_each)

            # Insert QR code into page
            page.paste(qr_img, (x_position, y_position))

    return page
