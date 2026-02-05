import type { Session } from "./types.js";

export class SessionStore {
  private sessions = new Map<string, Session>();

  private getOrCreate(id: string): Session {
    let session = this.sessions.get(id);
    if (!session) {
      session = { id, toolCalls: [] };
      this.sessions.set(id, session);
    }
    return session;
  }

  setContext(
    sessionId: string,
    query: string,
    intent?: string
  ): void {
    const session = this.getOrCreate(sessionId);
    session.context = { query, intent, timestamp: Date.now() };
  }

  getContext(sessionId: string) {
    return this.sessions.get(sessionId)?.context;
  }

  recordToolCall(sessionId: string, toolName: string): void {
    const session = this.getOrCreate(sessionId);
    session.toolCalls.push({
      toolName,
      timestamp: Date.now(),
      contextSnapshot: session.context?.query,
    });
  }

  setRetrievedTools(sessionId: string, toolNames: string[]): void {
    const session = this.getOrCreate(sessionId);
    session.retrievedTools = toolNames;
  }

  getRetrievedTools(sessionId: string): string[] | undefined {
    return this.sessions.get(sessionId)?.retrievedTools;
  }

  setLastSearch(
    sessionId: string,
    query: string,
    results: string[]
  ): void {
    const session = this.getOrCreate(sessionId);
    session.lastSearch = { query, results, timestamp: Date.now() };
  }

  getLastSearch(sessionId: string) {
    return this.sessions.get(sessionId)?.lastSearch;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
}
