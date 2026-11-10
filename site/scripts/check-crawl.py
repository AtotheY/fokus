"""Check deployed HTML, release integrity, canonical URLs, and key crawler responses."""
import hashlib
import json
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit

BASE = "https://usefokus.dev"
DIST = Path(__file__).resolve().parents[1] / "dist"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = set()
        self.meta = {}
        self.headings = 0
        self.canonical = None
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.links.add(attrs["href"])
        if tag == "img":
            self.links.add(attrs["src"])
        if tag == "meta":
            self.meta[attrs.get("name")] = attrs.get("content", "")
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs["href"]
        if tag == "h1":
            self.headings += 1
        if tag == "title":
            self.in_title = True

    def handle_data(self, text):
        if self.in_title:
            self.title += text

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False


def fetch(url, agent="Fokus launch crawl"):
    req = urllib.request.Request(url, headers={"User-Agent": agent})
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.read(), response.headers, response.url


sitemap = ET.fromstring(fetch(BASE + "/sitemap.xml")[0])
urls = [node.text for node in sitemap.findall(".//{*}loc")]
destinations, titles, descriptions = set(), set(), set()
report = {}
for url in urls:
    raw, headers, final = fetch(url)
    page = Page()
    page.feed(raw.decode())
    assert final == page.canonical == url
    assert page.headings == 1 and page.title and page.meta["description"]
    assert page.title not in titles and page.meta["description"] not in descriptions
    assert "noindex" not in (page.meta.get("robots", "") + headers.get("X-Robots-Tag", "")).lower()
    titles.add(page.title)
    descriptions.add(page.meta["description"])
    destinations.update(urljoin(url, ref).split("#")[0] for ref in page.links if urlsplit(urljoin(url, ref)).netloc == "usefokus.dev")
    assert raw == (DIST / urlsplit(url).path.lstrip("/") / "index.html").read_bytes()
    report[url] = page.title
for link in sorted(destinations - set(urls)):
    raw, headers, final = fetch(link)
    local = DIST / urlsplit(link).path.lstrip("/")
    if local.is_dir():
        local = local / "index.html"
    assert local.is_file() and hashlib.sha256(raw).digest() == hashlib.sha256(local.read_bytes()).digest()
guide = next(url for url in urls if "temporarily-unblock" in url)
for ua in ["Googlebot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot"]:
    raw, headers, final = fetch(guide, ua)
    assert b"old.reddit.com" in raw and "challenge" not in headers.get("cf-mitigated", "")
assert b"Allow: /" in fetch(BASE + "/robots.txt", "OAI-SearchBot")[0]
assert fetch("https://www.usefokus.dev/guides/")[2] == BASE + "/guides/"
assert fetch("http://usefokus.dev/")[2] == BASE + "/"
ET.fromstring(fetch(BASE + "/feed.xml")[0])
try:
    fetch(BASE + "/not-a-fokus-page-321")
    raise AssertionError("Expected a 404")
except urllib.error.HTTPError as error:
    assert error.code == 404
print(json.dumps({"indexable_pages": report, "internal_destinations":len(destinations),
                  "source_html_matches":True,"crawler_user_agents_passed":4,"missing_path":404},indent=2))
