import { setInterval, clearInterval } from 'node:timers';

import {
  CompleteEvent,
  ErrorEvent,
  EventType,
  HeartbeatEvent,
  NodeCompleteEvent,
  NodeName,
  NodeStartEvent,
  ProgressEvent,
  StreamEvent,
  TokenEvent,
  NODE_MESSAGES,
} from '../models/streaming';

class AsyncQueue<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private resolvers: Array<(value: IteratorResult<T>) => void> = [];
  private done = false;

  push(item: T) {
    if (this.done) {
      return;
    }
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      resolve?.({ value: item, done: false });
    } else {
      this.items.push(item);
    }
  }

  end() {
    if (this.done) {
      return;
    }
    this.done = true;
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift();
      resolve?.({ value: undefined as never, done: true });
    }
  }

  async next(): Promise<IteratorResult<T>> {
    if (this.items.length > 0) {
      const value = this.items.shift() as T;
      return { value, done: false };
    }
    if (this.done) {
      return { value: undefined as never, done: true };
    }
    return new Promise<IteratorResult<T>>((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this;
  }
}

export class StreamingService {
  private readonly queue = new AsyncQueue<StreamEvent>();
  private isStreaming = false;
  private startTime = 0;
  private nodeStartTimes = new Map<string, number>();
  private heartbeatHandle: NodeJS.Timeout | null = null;

  async start() {
    if (this.isStreaming) {
      return;
    }
    this.isStreaming = true;
    this.startTime = Date.now();
    this.nodeStartTimes.clear();
    this.startHeartbeat();
  }

  async stop() {
    if (!this.isStreaming) {
      return;
    }
    this.isStreaming = false;
    this.stopHeartbeat();
    this.queue.end();
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatHandle = setInterval(() => {
      if (this.isStreaming) {
        const event: HeartbeatEvent = {
          type: EventType.HEARTBEAT,
          message: 'heartbeat',
          timestamp: Date.now(),
        };
        this.queue.push(event);
      }
    }, 30_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatHandle) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }
  }

  emitProgress(event: Omit<ProgressEvent, 'type' | 'timestamp'>) {
    if (!this.isStreaming) {
      return;
    }
    this.queue.push({
      type: EventType.PROGRESS,
      timestamp: Date.now(),
      ...event,
    });
  }

  emitNodeStart(node: NodeName | string, metadata?: Record<string, unknown>) {
    if (!this.isStreaming) {
      return;
    }
    const now = Date.now();
    this.nodeStartTimes.set(node, now);
    const message = NODE_MESSAGES[node as NodeName];
    const event: NodeStartEvent = {
      type: EventType.NODE_START,
      timestamp: now,
      node,
      message_ko: message?.start_ko ?? `Starting ${node}`,
      message_en: message?.start_en ?? `Starting ${node}`,
      metadata,
    };
    this.queue.push(event);
  }

  emitNodeComplete(
    node: NodeName | string,
    result?: Record<string, unknown>,
    message?: string,
  ) {
    if (!this.isStreaming) {
      return;
    }
    const now = Date.now();
    const start = this.nodeStartTimes.get(node) ?? now;
    const msg =
      message ??
      NODE_MESSAGES[node as NodeName]?.complete_en ??
        `Completed ${node}`;
    const event: NodeCompleteEvent = {
      type: EventType.NODE_COMPLETE,
      timestamp: now,
      node,
      result,
      duration: (now - start) / 1000,
      message: msg,
    };
    this.queue.push(event);
  }

  emitToken(event: Omit<TokenEvent, 'type' | 'timestamp'>) {
    if (!this.isStreaming) {
      return;
    }
    this.queue.push({
      type: EventType.TOKEN,
      timestamp: Date.now(),
      ...event,
    });
  }

  emitComplete(
    event: Omit<CompleteEvent, 'type' | 'timestamp' | 'total_duration'> & {
      total_duration?: number;
    },
  ) {
    if (!this.isStreaming) {
      return;
    }
    const totalDuration =
      event.total_duration ?? (Date.now() - this.startTime) / 1000;
    const warnings = Array.isArray(event.warnings) ? event.warnings : [];

    const payload: CompleteEvent = {
      type: EventType.COMPLETE,
      timestamp: Date.now(),
      title: event.title,
      content: event.content,
      analysis_reason: event.analysis_reason,
      warnings,
      total_duration: totalDuration,
      metadata: event.metadata,
    };

    this.queue.push(payload);
    this.stop();
  }

  emitError(event: Omit<ErrorEvent, 'type' | 'timestamp'>) {
    const errorEvent: ErrorEvent = {
      type: EventType.ERROR,
      timestamp: Date.now(),
      ...event,
    };
    this.queue.push(errorEvent);
    this.stop();
  }

  async *events(): AsyncGenerator<StreamEvent, void, unknown> {
    for await (const event of this.queue) {
      yield event;
    }
  }
}
