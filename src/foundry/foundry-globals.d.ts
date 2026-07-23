declare const Hooks: {
  once(hook: string, callback: (...args: unknown[]) => void): void;
  on(hook: string, callback: (...args: unknown[]) => void): void;
};

declare const foundry: {
  applications?: {
    api?: {
      DialogV2?: {
        prompt(config: unknown): Promise<unknown>;
      };
    };
  };
};

declare const game: {
  user?: {
    isGM?: boolean;
  };
  modules?: {
    get(id: string): { api?: unknown } | undefined;
  };
};

declare const ui: {
  notifications?: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
};
