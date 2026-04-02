import * as chokidar from 'chokidar';
import { Logger } from '../util/logger';

export class CoverageWatcher {
  private watcher: chokidar.FSWatcher | undefined;
  private onChange: (path: string) => void;
  private log: Logger;

  constructor(onChange: (path: string) => void, log: Logger) {
    this.onChange = onChange;
    this.log = log;
  }

  watch(patterns: string[]): void {
    this.dispose();
    this.log.info(`Watching coverage files: ${patterns.join(', ')}`);

    this.watcher = chokidar.watch(patterns, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    this.watcher.on('change', (path) => {
      this.log.info(`Coverage file changed: ${path}`);
      this.onChange(path);
    });

    this.watcher.on('add', (path) => {
      this.log.info(`Coverage file added: ${path}`);
      this.onChange(path);
    });
  }

  dispose(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }
}
