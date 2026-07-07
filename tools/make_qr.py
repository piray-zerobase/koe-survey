#!/usr/bin/env python3
"""配布用QRコードのPNG生成（管理画面の「配布用URL」をQR化する）

準備（初回のみ・自分のターミナルで）:
    pip3 install qrcode pillow

使い方:
    python3 tools/make_qr.py "https://.../#/s/nd-nps?ch=unit1" unit1
    → qr/unit1.png ができる（印刷してカードにする）

複数チャネルをまとめて:
    python3 tools/make_qr.py --survey "https://.../#/s/nd-nps" unit1 unit2 unit3
    → qr/unit1.png, qr/unit2.png, qr/unit3.png
"""
import sys
from pathlib import Path

try:
    import qrcode
except ImportError:
    sys.exit("qrcodeパッケージがありません。 pip3 install qrcode pillow を実行してください")

OUT_DIR = Path(__file__).resolve().parent.parent / "qr"


def make(url: str, name: str) -> Path:
    OUT_DIR.mkdir(exist_ok=True)
    img = qrcode.make(url, box_size=12, border=4)
    out = OUT_DIR / f"{name}.png"
    img.save(out)
    return out


def main(argv: list[str]) -> None:
    if not argv:
        sys.exit(__doc__)
    if argv[0] == "--survey":
        base, channels = argv[1], argv[2:] or ["common"]
        sep = "&" if "?" in base else "?"
        for ch in channels:
            url = base if ch == "common" else f"{base}{sep}ch={ch}"
            print(f"{ch}: {url}\n  -> {make(url, ch)}")
    else:
        url, name = argv[0], (argv[1] if len(argv) > 1 else "qr")
        print(f"{url}\n  -> {make(url, name)}")


if __name__ == "__main__":
    main(sys.argv[1:])
