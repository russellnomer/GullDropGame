import fitz
from pathlib import Path
src = Path('attached_assets/screencapture-google-search-2026-09-10-01_52_13_1789019567033.pdf')
out = Path('.agents/outputs/boardwalk-reference')
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(src)
print('pages', doc.page_count)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    path = out / f'page-{i+1}.png'
    pix.save(path)
    print(path, pix.width, pix.height)
