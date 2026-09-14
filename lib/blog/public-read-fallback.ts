export async function withPublicReadFallback<T>(
  read: () => Promise<T>,
  fallback: T,
  report: (error: unknown) => void = (error) => console.error("Public blog read unavailable", error),
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    report(error);
    return fallback;
  }
}
