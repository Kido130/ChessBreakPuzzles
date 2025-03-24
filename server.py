import http.server
import socketserver
import os
import socket
import sys

def find_free_port(start_port=8080, max_attempts=100):
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            continue
    raise OSError("Could not find a free port")

# Find an available port starting from 8080
try:
    PORT = find_free_port()
except OSError as e:
    print(f"Error: {e}")
    sys.exit(1)

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    # Add JSON content type to supported MIME types
    extensions_map = {
        '': 'application/octet-stream',
        '.html': 'text/html',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.mp3': 'audio/mpeg',
    }

    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

# Change to the directory containing the application
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = MyHTTPRequestHandler

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        print(f"Open http://localhost:{PORT}/openings.html in your browser")
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nShutting down server...")
    sys.exit(0)
except Exception as e:
    print(f"Error starting server: {e}")
    sys.exit(1) 