import io
from uuid import uuid4

import pyqrcode
from PIL import Image

# Dimensions of 8.5 x 11 sheet of paper at 300 dpi
# Height reduced 100px to accomodate timestamp added by browser
page_width, page_height = 2400, 3200


def generate_random_qr(url_prefix):
    """Returns pyqrcode instance with url_prefix + random UUID"""
    return pyqrcode.create(
        f"{url_prefix}{uuid4().hex}",
        error="H",
        version=7
    )


def get_qr_png(url_prefix, scale=5):
    """Returns PIL.Image containing QR code with url_prefix + random UUID"""
    image = io.BytesIO()
    qr = generate_random_qr(url_prefix)
    qr.png(image, scale=scale)
    return Image.open(image)


def generate_layout(url_prefix, scale=5):
    """Returns PIL.Image containing an evenly spaced grid of QR codes
    Takes url_prefix (manage endpoint without UUID) and optional scale (int)
    Scale defaults to 5 (16mm QR codes), use 7 for 1inch QR codes
    """

    # Get QR code width at current scale
    test_qr = get_qr_png(url_prefix, scale)
    qr_width = test_qr.width

    # Calculate number of rows and columns, number of margins between
    qr_per_row = int(page_width / qr_width)
    qr_per_col = int(page_height / qr_width)
    margins_per_row = qr_per_row - 1
    margins_per_col = qr_per_col - 1

    # Divide extra space evenly into margins between QR codes
    row_margin_total = page_width % qr_width
    row_margin_each = int(row_margin_total / margins_per_row)
    col_margin_total = page_height % qr_width
    col_margin_each = int(col_margin_total / margins_per_col)

    # Create blank page
    page = Image.new('RGB', (page_width, page_height), 'white')

    # Generate evenly-spaced grid of random QR codes
    for row in range(qr_per_col):
        for col in range(qr_per_row):
            qr_img = get_qr_png(url_prefix, scale)

            # Calculate coordinates of QR code top-left corner
            x = col * (qr_width + row_margin_each)
            y = row * (qr_width + col_margin_each)

            # Insert QR code into page
            page.paste(qr_img, (x, y))

    return page
