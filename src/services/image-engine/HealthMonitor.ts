export interface ProviderHealth {
  attempts: number;
  failures: number;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  avgResponseTimeMs: number;
  status: "healthy" | "degraded" | "circuit-open";
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private registry = new Map<string, ProviderHealth>();

  private readonly DEGRADED_THRESHOLD = 5000; // ms response time
  private readonly CIRCUIT_BREAK_FAILURES = 3; // consecutive failures
  private readonly CIRCUIT_RECOVERY_TIME = 60000; // 1 min

  private constructor() {}

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  getHealth(providerId: string): ProviderHealth {
    if (!this.registry.has(providerId)) {
      this.registry.set(providerId, {
        attempts: 0,
        failures: 0,
        consecutiveFailures: 0,
        lastFailureTime: null,
        avgResponseTimeMs: 0,
        status: "healthy",
      });
    }
    const health = this.registry.get(providerId)!;

    // Check circuit recovery
    if (health.status === "circuit-open" && health.lastFailureTime) {
      if (Date.now() - health.lastFailureTime > this.CIRCUIT_RECOVERY_TIME) {
        health.status = "degraded"; // Try again slowly
        health.consecutiveFailures = 0;
      }
    }

    return health;
  }

  recordSuccess(providerId: string, responseTimeMs: number) {
    const health = this.getHealth(providerId);
    health.attempts++;
    health.consecutiveFailures = 0;
    
    // Moving average
    health.avgResponseTimeMs = (health.avgResponseTimeMs * 0.8) + (responseTimeMs * 0.2);
    
    health.status = health.avgResponseTimeMs > this.DEGRADED_THRESHOLD ? "degraded" : "healthy";
    this.registry.set(providerId, health);
  }

  recordFailure(providerId: string) {
    const health = this.getHealth(providerId);
    health.attempts++;
    health.failures++;
    health.consecutiveFailures++;
    health.lastFailureTime = Date.now();

    if (health.consecutiveFailures >= this.CIRCUIT_BREAK_FAILURES) {
      health.status = "circuit-open";
    } else {
      health.status = "degraded";
    }

    this.registry.set(providerId, health);
  }

  isAvailable(providerId: string): boolean {
    return this.getHealth(providerId).status !== "circuit-open";
  }

  getWeight(providerId: string): number {
    const health = this.getHealth(providerId);
    if (health.status === "circuit-open") return 0;
    if (health.status === "degraded") return 0.5;
    
    // Healthy, prioritize faster providers slightly
    if (health.avgResponseTimeMs < 1000) return 1.5;
    return 1.0;
  }
}
