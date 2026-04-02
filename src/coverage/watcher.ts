import * as chokidar from 'chokidar';
import { log } from '../util/logger';

export class CoverageWatcher {
  private watcher: chokidar.FSWatcher | undefined;
  private onChange: (path: string) => void;

  constructor(onChange: (path: string) => void) {
    this.onChange = onChange;
  }

  watch(patterns: string[]): void {
    this.dispose();
    log(`Watching coverage files: ${patterns.join(', ')}`);

    this.watcher = chokidar.watch(patterns, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    this.watcher.on('change', (path) => {
      log(`Coverage file changed: ${path}`);
      this.onChange(path);
    });

    this.watcher.on('add', (path) => {
      log(`Coverage file added: ${path}`);
      this.onChange(path);
    });
  }

  dispose(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }
}
