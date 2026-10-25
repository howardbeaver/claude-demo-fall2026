"""Local dev server with HTTP Range support, so Safari can play the videos.

Python's built-in `python3 -m http.server` always sends whole files, and
Safari refuses to play <video> unless the server answers byte-range
requests with 206 Partial Content. This adds that, plus no-cache headers
so edits show up on refresh, and the same security headers Vercel sends
(read from vercel.json) so the Content-Security-Policy is tested locally.

Usage: python3 dev-server.py [port]     (default port 8000)
"""

import json
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")
CHUNK_SIZE = 64 * 1024


def site_headers():
    """Headers vercel.json applies to every path, re-read so edits apply at once."""
    try:
        with open(os.path.join(ROOT, "vercel.json")) as f:
            config = json.load(f)
    except (OSError, ValueError):
        return []
    return [
        (header["key"], header["value"])
        for rule in config.get("headers", [])
        if rule.get("source") == "/(.*)"
        for header in rule.get("headers", [])
    ]


class RangeRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-cache")
        for key, value in site_headers():
            self.send_header(key, value)
        super().end_headers()

    def send_head(self):
        self.range_length = None
        match = RANGE_RE.match(self.headers.get("Range", "").strip())
        path = self.translate_path(self.path)
        if not match or not os.path.isfile(path):
            return super().send_head()

        size = os.path.getsize(path)
        first, last = match.groups()
        if first:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
        elif last:
            # Suffix range, e.g. "bytes=-500" means the final 500 bytes
            start = max(size - int(last), 0)
            end = size - 1
        else:
            return super().send_head()

        if start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None

        f = open(path, "rb")
        f.seek(start)
        self.range_length = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self.range_length))
        self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        try:
            if self.range_length is None:
                super().copyfile(source, outputfile)
                return
            remaining = self.range_length
            while remaining > 0:
                chunk = source.read(min(CHUNK_SIZE, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            # Browsers routinely abort video requests mid-stream when seeking
            pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(RangeRequestHandler, directory=ROOT)
    with ThreadingHTTPServer(("", port), handler) as server:
        print(f"Serving {ROOT} at http://localhost:{port} (Ctrl-C to stop)")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
