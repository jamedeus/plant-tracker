#!/usr/bin/env python3

import io
from uuid import uuid4

import pyqrcode
from PIL import Image


url_prefix = "https://plants.lan/"

page_width, page_height = 2400, 3300


def generate_random_qr():
    """Returns pyqrcode instance with url_prefix + random UUID"""
    return pyqrcode.create(
        f"{url_prefix}{uuid4().hex}",
        error="H",
        version=6
    )


def get_qr_png(scale=5):
    """Returns PIL.Image containing QR code with url_prefix + random UUID"""
    image = io.BytesIO()
    qr = generate_random_qr()
    qr.png(image, scale=scale)
    return Image.open(image)


def generate_layout(scale=5):
    """Returns PIL.Image containing an evenly spaced grid of QR codes"""
    # Get QR code width at current scale
    test_qr = get_qr_png(scale)
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
            qr_img = get_qr_png(scale)

            # Calculate coordinates of QR code top-left corner
            x = col * (qr_width + row_margin_each)
            y = row * (qr_width + col_margin_each)

            # Insert QR code into page
            page.paste(qr_img, (x, y))

    return page


if __name__ == "__main__":
    page = generate_layout()
    page.show()
