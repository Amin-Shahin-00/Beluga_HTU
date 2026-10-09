"""Makes clearly fake sample ID card images for the demo and for testing
Ameen's document checker. Run: npm run make-samples (needs: pip install pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "assets" / "samples"
OUT.mkdir(parents=True, exist_ok=True)


def font(size, bold=False):
    for name in ["DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]:
        for d in ["/usr/share/fonts/truetype/dejavu", "/Library/Fonts", "C:/Windows/Fonts"]:
            p = Path(d) / name
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def card(expiry: str) -> Image.Image:
    w, h = 1012, 638  # ID-1 card ratio
    img = Image.new("RGB", (w, h), (233, 240, 236))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 96], fill=(30, 110, 80))
    d.text((32, 26), "SAMPLE ID CARD - NOT A REAL DOCUMENT", font=font(34, True), fill="white")
    d.rectangle([40, 140, 300, 470], fill=(200, 210, 205), outline=(120, 130, 125), width=3)
    d.text((95, 290), "PHOTO", font=font(36, True), fill=(120, 130, 125))
    rows = [
        ("National No.", "9990000001"),
        ("Name", "Layla Mahmoud Ahmad"),
        ("Date of birth", "1995-03-14"),
        ("Expiry", expiry),
    ]
    y = 150
    for label, value in rows:
        d.text((340, y), label, font=font(24), fill=(90, 100, 95))
        d.text((340, y + 32), value, font=font(36, True), fill=(20, 30, 25))
        y += 82
    d.rectangle([0, h - 70, w, h], fill=(210, 60, 50))
    d.text((32, h - 54), "DUMMY DATA FOR BEDAYA HACKATHON DEMO", font=font(30, True), fill="white")
    return img


card("2031-03-14").save(OUT / "layla-national-id.png")
card("2025-08-01").save(OUT / "layla-national-id-expired.png")
card("2031-03-14").filter(ImageFilter.GaussianBlur(9)).save(OUT / "layla-national-id-blurry.png")
print("Wrote samples to", OUT)
