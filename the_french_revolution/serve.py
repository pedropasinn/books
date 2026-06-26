#!/usr/bin/env python3
"""Servidor estático local COM suporte a HTTP Range — necessário para dar seek
no áudio (o `python3 -m http.server` não suporta, e aí todo pulo volta ao início).
Uso:  python3 serve.py [porta]      (padrão 8000)"""
import http.server, os, re, sys, socketserver

class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        fs = os.fstat(f.fileno())
        size = fs.st_size
        ctype = self.guess_type(path)
        rng = self.headers.get("Range")
        if not rng:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
            self.end_headers()
            return f
        m = re.match(r"bytes=(\d*)-(\d*)\s*$", rng)
        if not m:
            self.send_error(400, "Invalid Range"); f.close(); return None
        s, e = m.group(1), m.group(2)
        if s == "":                     # bytes=-N  (últimos N bytes)
            length = int(e or 0); start = max(0, size - length); end = size - 1
        else:
            start = int(s); end = int(e) if e else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers(); f.close(); return None
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()
        f.seek(start)
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        try:
            if remaining is None:
                return super().copyfile(source, outputfile)
            self._remaining = None
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # navegador abortou o stream (normal ao dar seek)

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True
    def handle_error(self, request, client_address):
        pass  # silencia desconexões durante streaming de áudio

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with Server(("127.0.0.1", port), RangeHandler) as httpd:
        print(f"Servindo {os.getcwd()}")
        print(f"  http://localhost:{port}/index.html   (com seek/Range)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
