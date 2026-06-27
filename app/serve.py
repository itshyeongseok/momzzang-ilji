"""몸짱일지 로컬 서버 (멀티스레드 + PWA 캐시 무효화)"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5777


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # 개발 중 캐시 때문에 옛 버전이 뜨는 걸 방지
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"몸짱일지 → http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
