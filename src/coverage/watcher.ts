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
    await this.stop();

    const absGlobs = globs.map(g =>
      g.startsWith('/') ? g : `${workspaceRoot}/${g}`
    );

    this.watcher = chokidar.watch(absGlobs, {
      ignored: excludePatterns,
      ignoreInitial: false,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
    });

    const safeOnChange = () => onChange().catch(() => {});

    this.watcher.on('change', safeOnChange);
    this.watcher.on('add', safeOnChange);
    this.watcher.on('unlink', safeOnChange);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }
}
