type CtaValue = string | number | boolean;

type CtaCommand = {
  command: string;
  args?: Record<string, CtaValue>;
  options?: Record<string, CtaValue>;
  description?: string;
};

const STRUCTURED_FORMATS = new Set(['json', 'jsonl']);

/**
 * Return a CTA block for human/agent guidance while keeping --json/--jsonl payloads data-only.
 */
export function withCta(format: string, description: string, commands: CtaCommand[]) {
  if (STRUCTURED_FORMATS.has(format)) {
    return undefined;
  }

  if (commands.length === 0) {
    return undefined;
  }

  return {
    cta: {
      description,
      commands,
    },
  };
}
