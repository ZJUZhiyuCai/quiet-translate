"""Draw the small original leaf/book mark. No remote artwork or fonts."""
from PIL import Image, ImageDraw
from pathlib import Path

folder = Path(__file__).resolve().parents[1] / 'extension' / 'icons'
folder.mkdir(exist_ok=True)
scale = 4
image = Image.new('RGBA', (128 * scale, 128 * scale))
d = ImageDraw.Draw(image)
def p(points):
    return [(round(x * scale), round(y * scale)) for x, y in points]
d.rounded_rectangle((0, 0, 128 * scale - 1, 128 * scale - 1), radius=33 * scale, fill='#397965')
d.polygon(p([(32, 87), (32, 47), (44, 35), (83, 35), (96, 23), (96, 71), (85, 87), (65, 94), (45, 94)]), fill='#edf4e8')
d.line(p([(40, 91), (81, 49)]), fill='#397965', width=7 * scale)
d.line(p([(49, 60), (65, 60)]), fill='#397965', width=5 * scale)
for size in (16, 32, 48, 128):
    image.resize((size, size), Image.Resampling.LANCZOS).save(folder / f'{size}.png')
print('Icons generated: 16, 32, 48, 128 px')
