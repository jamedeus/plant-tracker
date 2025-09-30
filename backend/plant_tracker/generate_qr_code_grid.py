'''Contains functions used to generate a grid of URL QR codes, each with the
same URL prefix followed by a random UUID. Used by /get_qr_codes endpoint.
'''

import io
from uuid import uuid4

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
import cairosvg
from django.conf import settings
from PIL import Image, ImageFilter


LOGO_SVG_PATH = "qr-code-logo.svg"


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


def get_logo_overlay(qr_size, qr_scale):
    '''Takes QR code size and scale (returned by calculate_qr_width_and_scale).
    Returns PIL.Image of logo with white border and transparent background.
    '''

    # Get logo size that is a multiple of qr_scale with approximately 35% of QR
    # code width (allows logo to align to grid without slicing adjacent modules)
    logo_modules = round(int(qr_size * 0.35) / qr_scale)
    # Ensure logo and QR code both have either even or odd number of modules
    # (otherwise edge of centered logo will slice adjacent modules in half)
    if qr_size / qr_scale % 2 != logo_modules % 2:
        logo_modules += 1
    logo_size = logo_modules * qr_scale

    # Convert SVG logo to PNG with size calculated above (will cover less than
    # 35% of modules since logo isn't square and background is transparent)
    logo_img = get_scaled_logo(logo_size)

    # Calculate total width with 1 module padding all the way around logo
    total_width = logo_size + 2 * qr_scale

    # Extract alpha channel (silhouette), convert semitransparent px to solid
    base_mask = logo_img.split()[3].point(lambda p: 255 if p >= 1 else 0, mode='L')

    # Expand mask with disk dilation to add padding (radius = width of 1 module)
    dilated_mask = Image.new('L', (total_width, total_width), 0)
    radius = qr_scale
    radius_sq = radius * radius
    for offset_y in range(-radius, radius + 1):
        offset_y_sq = offset_y * offset_y
        for offset_x in range(-radius, radius + 1):
            # Skip if offset is outside the disk
            if offset_x * offset_x + offset_y_sq > radius_sq:
                continue

            # Paste silhouette onto dilated mask shifted by (offset_x, offset_y)
            # Only paste pixels that are white (255) in the shifted mask (don't
            # overwrite px from previous iteration when black shifts over them)
            dilated_mask.paste(
                255,
                box=(radius + offset_x, radius + offset_y),
                mask=base_mask
            )

    # Convert inside of mask to solid white (border), outside to transparent
    overlay = Image.new('RGBA', (total_width, total_width), (0, 0, 0, 0))
    white = Image.new('RGBA', (total_width, total_width), (255, 255, 255, 255))
    overlay.paste(white, (0, 0), dilated_mask)

    # Paste logo into center of mask (same padding width on all sides)
    overlay.paste(logo_img, (qr_scale, qr_scale), logo_img)

    return overlay


def generate_random_qr():
    '''Returns qrcode.QRCode instance with URL_PREFIX + random UUID.'''
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H)
    qr.add_data(f"{settings.URL_PREFIX}{uuid4().hex}")
    qr.make(fit=True)
    return qr


def get_qr_png(scale=5):
    '''Returns PIL.Image containing QR code with URL_PREFIX + random UUID.'''
    qr = generate_random_qr()
    qr.box_size = scale
    qr.border = 3
    # Apply rounded module style, convert to PIL.Image
    styled = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer()
    )
    return styled.get_image().convert("RGB")


def calculate_qr_width_and_scale(qr_per_row, page_width):
    '''Calculates largest QR code scale that will fit the requested grid size.
    Takes qr_per_row (grid size) and page width (int).
    Returns scaled QR code width (pixels) and scaling factor (px per module).
    '''

    # Get absolute max width for configured page dimensions
    max_width = int(page_width / qr_per_row)

    # Generate test QR code, get number of modules + 3 module border per side
    test_qr = generate_random_qr()
    modules = test_qr.modules_count + 6

    # Calculate max module scale (px) that fits in max_width, total width (px)
    qr_scale = int(max_width / modules)
    qr_width = qr_scale * modules

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
    logo = get_logo_overlay(qr_width, qr_scale)
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
