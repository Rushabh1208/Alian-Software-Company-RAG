from __future__ import annotations

from bs4 import BeautifulSoup


BOILERPLATE_SELECTORS = [
    "nav",
    "footer",
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "form",
    "button",
    "[role='navigation']",
    "[role='banner']",
    "[role='contentinfo']",
    "[aria-modal='true']",
    ".navbar",
    ".nav",
    ".footer",
    ".site-footer",
    ".cookie",
    ".cookie-banner",
    ".cookies",
    ".popup",
    ".modal",
    ".newsletter",
    ".subscribe",
    ".advertisement",
    ".ads",
    ".ad",
    "#cookie-banner",
    "#newsletter",
]

BOILERPLATE_KEYWORDS = (
    "cookie",
    "cookies",
    "newsletter",
    "subscribe",
    "popup",
    "modal",
    "advert",
    "banner",
)


def remove_boilerplate(soup: BeautifulSoup) -> BeautifulSoup:
    for selector in BOILERPLATE_SELECTORS:
        for node in soup.select(selector):
            node.decompose()

    for node in soup.find_all(True):
        if node.attrs is None:
            continue
        class_text = " ".join(node.get("class", []))
        node_id = node.get("id", "")
        marker = f"{class_text} {node_id}".lower()
        if any(keyword in marker for keyword in BOILERPLATE_KEYWORDS):
            node.decompose()

    return soup

