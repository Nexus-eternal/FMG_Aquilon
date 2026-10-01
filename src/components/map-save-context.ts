type RestoreMapContext = () => void | Promise<void>;
type PrepareMapContext = () => RestoreMapContext | Promise<RestoreMapContext>;

class MapSaveContextRegistry {
  private prepareMapContext?: PrepareMapContext;

  register(prepare: PrepareMapContext): () => void {
    this.prepareMapContext = prepare;
    return () => {
      if (this.prepareMapContext === prepare) this.prepareMapContext = undefined;
    };
  }

  async prepare(): Promise<RestoreMapContext> {
    return (await this.prepareMapContext?.()) ?? (() => undefined);
  }
}

export const MapSaveContext = new MapSaveContextRegistry();
