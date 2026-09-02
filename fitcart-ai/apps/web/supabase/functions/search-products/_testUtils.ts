// Minimal, dependency-free test assertions shared by this directory's
// `*.test.ts` files. Deliberately not pulling in `jsr:@std/assert` (or any
// other remote import) purely for a handful of equality checks — keeps
// `deno test` runnable without a network fetch for a test-only dependency.

export function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    throw new Error(
      message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export async function assertRejects(fn: () => Promise<unknown>, message?: string): Promise<void> {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error(message ?? 'Expected promise to reject, but it resolved');
}
