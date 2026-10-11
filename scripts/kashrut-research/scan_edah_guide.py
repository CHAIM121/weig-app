"""Read-only extraction of the public 5786 guide; never certifies a business.

Usage: python scan_edah_guide.py INPUT_PDF OUTPUT_JSON
Requires PyMuPDF. Layout rules are specific to this edition, not other PDFs.
"""
import datetime
import hashlib
import json
import re
import sys
from pathlib import Path

import fitz


def clean(value):
    return re.sub(r"\s+", " ", value).strip()


def scan(input_path):
    raw = Path(input_path).read_bytes()
    expected_sha256 = "a9c2860184920a3f4d51bae2b8fc221a9516641bd58d5a81c533f264d031246c"
    if hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise ValueError("Unreviewed source revision: this extractor only supports the inspected 5786 PDF")
    doc = fitz.open(stream=raw, filetype="pdf")
    if len(doc) != 187:
        raise ValueError("Unexpected edition/layout: expected 187 PDF pages")
    page_coverage = []
    factories = []
    shops = []
    references = []
    for index, page in enumerate(doc):
        text = page.get_text()
        page_coverage.append({"pdf_page": index + 1, "has_text_layer": bool(text.strip())})
        lines = [line for block in page.get_text("dict")["blocks"]
                 for line in block.get("lines", [])]
        if 158 <= index <= 184:
            table_text_page = page.get_textpage()
            # The table headers define column right edges; rows use bold names.
            headers = [span for line in lines for span in line["spans"]
                       if span["text"] == "שם מפעל" and span["bbox"][1] < 75]
            if not headers:
                raise ValueError(f"Missing factory headers on PDF page {index + 1}")
            for header in headers:
                right = header["bbox"][2]
                left = right - 326
                name_left = right - 87
                anchors = []
                for line in lines:
                    for span in line["spans"]:
                        x0, y0, x1, y1 = span["bbox"]
                        if ("Bold" in span["font"] and name_left <= x1 <= right + 1
                                and 70 < y0 < 631):
                            anchors.append(span)
                groups = []
                for span in sorted(anchors, key=lambda s: s["bbox"][1]):
                    if groups and span["bbox"][1] - groups[-1][-1]["bbox"][1] < 14:
                        groups[-1].append(span)
                    else:
                        groups.append([span])
                for row_index, group in enumerate(groups):
                    name = clean(" ".join(s["text"] for s in group))
                    y0 = group[0]["bbox"][1] - 1
                    y1 = groups[row_index + 1][0]["bbox"][1] - 1 if row_index + 1 < len(groups) else 632
                    def cell(x0, x1):
                        return clean(table_text_page.extractTextbox(fitz.Rect(x0, y0, x1, y1)))
                    item = {
                        "candidate_id": f"factory:{index + 1}:{round(right)}:{row_index + 1}",
                        "pdf_page": index + 1,
                        "printed_page": 313 if index == 158 else (2 * index - 4 + (0 if right > 500 else 1)),
                        "name_as_extracted": name,
                        "products_as_extracted": cell(right - 194, name_left),
                        "city_as_extracted": cell(right - 252, right - 194),
                        "phone_as_extracted": cell(left, right - 252),
                        "review_status": "pending", "current_certificate_verified": False,
                        "match_eligible": False,
                    }
                    if "ראה" in name:
                        references.append(item)
                    else:
                        factories.append(item)
        if 62 <= index <= 93:
            # Bullet positions identify entries even when the PDF text order separates bullets.
            markers = [span for line in lines for span in line["spans"] if "»" in span["text"]]
            for marker in markers:
                mx, my, _, _ = marker["bbox"]
                if any(other is not marker and abs(other["bbox"][1] - my) < 2
                       and 0 < other["bbox"][0] - mx < 40 for other in markers):
                    continue  # The double-chevron occasionally occupies two spans.
                # A few lines embed bullet, name and address in one span.
                embedded = marker["text"].replace("»", "").strip()
                neighbors = [other for other in markers if other is not marker
                             and abs(other["bbox"][1] - my) < 2 and other["bbox"][2] < mx - 40]
                column_left = max([m["bbox"][2] + 1 for m in neighbors]
                                  + [500 if mx > 500 else 90])
                fragments = []
                for line in lines:
                    for span in line["spans"]:
                        x0, y0, x1, _ = span["bbox"]
                        if span is not marker and abs(y0 - my) < 2 and column_left <= x0 and x1 <= mx + 1:
                            fragments.append(span)
                value = clean(" ".join([embedded] + [s["text"].replace("»", "") for s in
                              sorted(fragments, key=lambda s: -s["bbox"][2])]))
                if not value:
                    raise ValueError(f"Empty marked shop entry on PDF page {index + 1}")
                value = re.sub(r"[.\ufffd]{3,}", " | ", value)
                shops.append({
                    "candidate_id": f"shop:{index + 1}:{round(mx)}:{round(my, 2)}",
                    "pdf_page": index + 1,
                    "printed_page": 2 * index - 4 + (0 if mx > 500 else 1),
                    "entry_as_extracted": value,
                    "review_status": "pending", "current_certificate_verified": False,
                    "match_eligible": False,
                    "parsing_note": "Visual entry only; name/address/city and scope require review."
                })
    ids = [r["candidate_id"] for r in factories + shops + references]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate candidate IDs")
    return {
        "scan_type": "read_only_annual_guide_candidate_extraction",
        "scanned_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "agency_code": "edah", "edition": "5786 / 2026",
        "source_host": "www.breslevnews.net", "source_relationship": "third_party_mirror",
        "source_url": "https://www.breslevnews.net/wp-content/uploads/2026/03/מדריך-הכשרות-העדה-החרדית-חלק-א-לפסח-וימות-תשפו-•-ברסלב-נייעס.pdf",
        "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw),
        "full_agency_coverage": False, "live_database_writes": 0,
        "current_certificate_verifications": 0,
        "limitations": [
            "Annual guide is not a current certificate and is hosted on a third-party mirror.",
            "187 PDF pages contain paired printed pages; PDF page count is not printed page count.",
            "Factories include non-food producers, importers and marketers; candidates are not unique businesses.",
            "Layout extraction is provisional. RTL names, numbers, continuations and scope need review.",
            "Shop entries include limited food supply supervision at hospitals/hotels; not whole-site certification.",
            "A valid original certificate tied to the exact address is required by the guide.",
            "No automatic matching, publication, removal of existing evidence or collector activation."
        ],
        "counts": {"pdf_pages_scanned": len(page_coverage),
                   "pages_without_text_layer": sum(not p["has_text_layer"] for p in page_coverage),
                   "factory_candidates": len(factories), "shop_entry_candidates": len(shops),
                   "cross_reference_rows": len(references)},
        "page_coverage": page_coverage,
        "factory_candidates": factories, "shop_entry_candidates": shops,
        "cross_reference_rows": references,
    }


if __name__ == "__main__":
    result = scan(sys.argv[1])
    Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"counts": result["counts"], "sha256": result["sha256"]}))
