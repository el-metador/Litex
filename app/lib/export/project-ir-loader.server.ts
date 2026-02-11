/**
 * Load raw Project IR JSON by projectId from your persistent storage.
 *
 * Contract:
 * - return `unknown` raw JSON payload when project exists
 * - return `null` when project does not exist
 * - throw only for transport/storage failures
 */
export async function loadProjectIR(projectId: string): Promise<unknown | null> {
  void projectId;

  return null;
}
