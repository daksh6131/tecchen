#!/usr/bin/env python3
"""Static dev server for the game: like `python3 -m http.server` but every
response carries Cache-Control: no-store, so edited ES modules reload."""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    # Dev-only asset drop: the browser can render an image (HUD portraits) and
    # POST it here; writes are confined to the assets/ tree.
    def do_POST(self):
        import os
        from urllib.parse import urlparse, unquote
        rel = unquote(urlparse(self.path).path.lstrip('/'))
        root = os.path.abspath(os.getcwd())
        dest = os.path.abspath(os.path.join(root, rel))
        if not rel.startswith('assets/') or not dest.startswith(root + os.sep + 'assets' + os.sep) or '..' in rel:
            self.send_error(403, 'writes are limited to assets/')
            return
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            f.write(data)
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(f'saved {rel} ({n} bytes)'.encode())


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
