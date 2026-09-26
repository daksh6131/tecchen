#!/usr/bin/env python3
"""Static dev server for the game: like `python3 -m http.server` but every
response carries Cache-Control: no-store, so edited ES modules reload.

Local-only by design:
- binds to 127.0.0.1;
- rejects any request whose Host header is not localhost / 127.0.0.1, which
  blocks DNS-rebinding pages from reading files through it;
- the POST drop used by portrait.html accepts only same-origin requests
  carrying a custom header (cross-site pages cannot send one without a CORS
  preflight this server never approves), only image files under assets/,
  and at most 16 MB.
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

ALLOWED_HOSTS = {'localhost', '127.0.0.1', '[::1]'}
WRITE_EXTS = {'.png', '.jpg', '.jpeg', '.webp'}
MAX_UPLOAD = 16 * 1024 * 1024


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    def _host_ok(self):
        host = (self.headers.get('Host') or '').lower()
        name = host.rsplit(':', 1)[0] if not host.startswith('[') else host.split(']')[0] + ']'
        if name in ALLOWED_HOSTS:
            return True
        self.send_error(403, 'local requests only')
        return False

    def _same_origin(self):
        origin = self.headers.get('Origin')
        if origin is None:
            return True
        return urlparse(origin).hostname in {'localhost', '127.0.0.1', '::1'}

    def do_GET(self):
        if self._host_ok():
            super().do_GET()

    def do_HEAD(self):
        if self._host_ok():
            super().do_HEAD()

    # Dev-only asset drop: the browser renders an image (HUD portraits) and
    # POSTs it here.
    def do_POST(self):
        if not self._host_ok():
            return
        if not self._same_origin() or self.headers.get('X-Asset-Drop') != '1':
            self.send_error(403, 'same-origin asset drops only')
            return
        rel = unquote(urlparse(self.path).path.lstrip('/'))
        root = os.path.realpath(os.getcwd())
        assets = os.path.join(root, 'assets') + os.sep
        dest = os.path.realpath(os.path.join(root, rel))
        if not dest.startswith(assets) or os.path.splitext(dest)[1].lower() not in WRITE_EXTS:
            self.send_error(403, 'writes are limited to images under assets/')
            return
        try:
            n = int(self.headers.get('Content-Length', 0))
        except ValueError:
            n = -1
        if n <= 0 or n > MAX_UPLOAD:
            self.send_error(413, 'upload must be 1 byte to 16 MB')
            return
        data = self.rfile.read(n)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            f.write(data)
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(f'saved {os.path.relpath(dest, root)} ({n} bytes)'.encode())


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
