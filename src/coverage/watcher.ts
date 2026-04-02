import * as chokidar from 'chokidar';

type OnChangeCallback = () => Promise<void>;

export class CoverageWatcher {
  private watcher?: chokidar.FSWatcher;

  async start(
    globs: string[],
    excludePatterns: string[],
    workspaceRoot: string,
    onChange: OnChangeCallback
  ): Promise<void> {
    this.stop();

    // Resolve globs to actual patterns
    const absGlobs = globs.map(g =>
      g.startsWith('/') ? g : `${workspaceRoot}/${g}`
    );

    this.watcher = chokidar.watch(absGlobs, {
      ignored: excludePatterns,
      ignoreInitial: false,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
    });

    this.watcher.on('change', async () => {
      await onChange();
    });

    this.watcher.on('add', async () => {
      await onChange();
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }
}
