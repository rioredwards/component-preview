import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export interface ImageServer {
  port: number;
  url(filename: string): string;
  dispose(): void;
}

export function startImageServer(serveDir: string): Promise<ImageServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const filename = path.basename(req.url ?? '');
      if (!filename.endsWith('.png')) {
        res.writeHead(404);
        res.end();
        return;
      }
      const filePath = path.join(serveDir, filename);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        url(filename: string) {
          return `http://127.0.0.1:${addr.port}/${filename}`;
        },
        dispose() {
          server.close();
        },
      });
    });

    server.on('error', reject);
  });
}
