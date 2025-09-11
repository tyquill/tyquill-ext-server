import { Injectable, Logger } from '@nestjs/common';
import { PostHog } from 'posthog-node';

@Injectable()
export class PosthogService {
  private readonly logger = new Logger(PosthogService.name);
  private client: PostHog | null = null;

  constructor() {
    const apiKey = process.env.POSTHOG_API_KEY;
    const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!apiKey) {
      this.logger.warn('POSTHOG_API_KEY not set. Analytics disabled.');
      this.client = null;
      return;
    }

    try {
      this.client = new PostHog(apiKey, { host });
      this.logger.log(`PostHog client initialized with host: ${host}`);
    } catch (err) {
      this.logger.error('Failed to initialize PostHog client', err as Error);
      this.client = null;
    }
  }

  isEnabled(): boolean {
    return !!this.client;
  }

  capture(distinctId: string, event: string, properties?: Record<string, any>) {
    if (!this.client) return;
    try {
      this.client.capture({ distinctId, event, properties });
    } catch (err) {
      this.logger.warn(`PostHog capture failed for event=${event}`, err as Error);
    }
  }

  identify(distinctId: string, set?: Record<string, any>, setOnce?: Record<string, any>) {
    if (!this.client) return;
    try {
      // posthog-node IdentifyMessage does not support $set_once in this version.
      // Merge properties as a best-effort; caller should avoid relying on set_once semantics here.
      const properties = { ...(set || {}), ...(setOnce || {}) };
      this.client.identify({ distinctId, properties });
    } catch (err) {
      this.logger.warn(`PostHog identify failed for distinctId=${distinctId}`, err as Error);
    }
  }

  shutdown(): void {
    if (!this.client) return;
    this.client.shutdown();
  }
}
