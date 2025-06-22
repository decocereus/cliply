interface ProxyConfig {
  host: string;
  port: number;
  protocol: "http" | "https" | "socks4" | "socks5";
  username?: string;
  password?: string;
  isActive: boolean;
  lastUsed: number;
  failureCount: number;
  maxFailures: number;
}

interface ProxyManagerConfig {
  maxFailures: number;
  failureCooldown: number; // Time in ms before retrying a failed proxy
  rotationStrategy: "round-robin" | "random" | "least-used";
  healthCheckInterval: number; // Time in ms between health checks
  enableHealthCheck: boolean;
}

export class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;
  private config: ProxyManagerConfig;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: Partial<ProxyManagerConfig> = {}) {
    this.config = {
      maxFailures: 3,
      failureCooldown: 300000, // 5 minutes
      rotationStrategy: "round-robin",
      healthCheckInterval: 600000, // 10 minutes
      enableHealthCheck: true,
      ...config,
    };

    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }
  }

  /**
   * Add a proxy to the pool
   */
  addProxy(
    proxy: Omit<
      ProxyConfig,
      "isActive" | "lastUsed" | "failureCount" | "maxFailures"
    >
  ) {
    const proxyConfig: ProxyConfig = {
      ...proxy,
      isActive: true,
      lastUsed: 0,
      failureCount: 0,
      maxFailures: this.config.maxFailures,
    };

    this.proxies.push(proxyConfig);
    console.log(`Added proxy: ${proxy.protocol}://${proxy.host}:${proxy.port}`);
  }

  /**
   * Add multiple proxies from configuration
   */
  addProxies(
    proxies: Array<
      Omit<
        ProxyConfig,
        "isActive" | "lastUsed" | "failureCount" | "maxFailures"
      >
    >
  ) {
    proxies.forEach((proxy) => this.addProxy(proxy));
  }

  /**
   * Get the next available proxy
   */
  getNextProxy(): ProxyConfig | null {
    const availableProxies = this.getAvailableProxies();

    if (availableProxies.length === 0) {
      console.warn("No available proxies found");
      return null;
    }

    let selectedProxy: ProxyConfig;

    switch (this.config.rotationStrategy) {
      case "random":
        selectedProxy =
          availableProxies[Math.floor(Math.random() * availableProxies.length)];
        break;

      case "least-used":
        selectedProxy = availableProxies.reduce((prev, current) =>
          prev.lastUsed < current.lastUsed ? prev : current
        );
        break;

      case "round-robin":
      default:
        // Find the next proxy in round-robin fashion
        const availableIndices = availableProxies.map((proxy) =>
          this.proxies.indexOf(proxy)
        );
        let nextIndex = availableIndices.find(
          (index) => index >= this.currentIndex
        );

        if (nextIndex === undefined) {
          nextIndex = availableIndices[0];
        }

        this.currentIndex = (nextIndex + 1) % this.proxies.length;
        selectedProxy = this.proxies[nextIndex];
        break;
    }

    selectedProxy.lastUsed = Date.now();
    return selectedProxy;
  }

  /**
   * Report a proxy failure
   */
  reportFailure(proxy: ProxyConfig, error?: Error) {
    proxy.failureCount++;
    console.warn(
      `Proxy ${proxy.host}:${proxy.port} failed (${proxy.failureCount}/${proxy.maxFailures}):`,
      error?.message
    );

    if (proxy.failureCount >= proxy.maxFailures) {
      proxy.isActive = false;
      console.error(
        `Proxy ${proxy.host}:${proxy.port} deactivated due to excessive failures`
      );

      // Schedule reactivation after cooldown
      setTimeout(() => {
        proxy.isActive = true;
        proxy.failureCount = 0;
        console.log(
          `Proxy ${proxy.host}:${proxy.port} reactivated after cooldown`
        );
      }, this.config.failureCooldown);
    }
  }

  /**
   * Report successful proxy usage
   */
  reportSuccess(proxy: ProxyConfig) {
    proxy.failureCount = Math.max(0, proxy.failureCount - 1);
  }

  /**
   * Get all available (active) proxies
   */
  private getAvailableProxies(): ProxyConfig[] {
    return this.proxies.filter((proxy) => proxy.isActive);
  }

  /**
   * Generate proxy URL for yt-dlp
   */
  getProxyUrl(proxy: ProxyConfig): string {
    const auth =
      proxy.username && proxy.password
        ? `${proxy.username}:${proxy.password}@`
        : "";

    return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    const total = this.proxies.length;
    const active = this.getAvailableProxies().length;
    const failed = total - active;

    return {
      total,
      active,
      failed,
      proxies: this.proxies.map((proxy) => ({
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        isActive: proxy.isActive,
        failureCount: proxy.failureCount,
        lastUsed: new Date(proxy.lastUsed).toISOString(),
      })),
    };
  }

  /**
   * Health check for proxies (basic implementation)
   */
  private async healthCheck(proxy: ProxyConfig): Promise<boolean> {
    try {
      // Simple test - this could be enhanced with actual HTTP requests
      // For now, we'll just check if the proxy configuration is valid
      return !!(proxy.host && proxy.port > 0 && proxy.port < 65536);
    } catch (error) {
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck() {
    this.healthCheckTimer = setInterval(async () => {
      console.log("Running proxy health checks...");

      for (const proxy of this.proxies) {
        if (!proxy.isActive) continue;

        const isHealthy = await this.healthCheck(proxy);
        if (!isHealthy) {
          this.reportFailure(proxy, new Error("Health check failed"));
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checks and cleanup
   */
  destroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Reset all proxy failure counts
   */
  resetFailureCounts() {
    this.proxies.forEach((proxy) => {
      proxy.failureCount = 0;
      proxy.isActive = true;
    });
    console.log("Reset all proxy failure counts");
  }

  /**
   * Remove all proxies
   */
  clearProxies() {
    this.proxies = [];
    this.currentIndex = 0;
    console.log("Cleared all proxies");
  }
}

// Global proxy manager instance
export const proxyManager = new ProxyManager({
  rotationStrategy: "round-robin",
  maxFailures: 3,
  failureCooldown: 300000, // 5 minutes
  enableHealthCheck: true,
});

// Helper function to load proxies from environment or config
export const loadProxiesFromConfig = () => {
  const proxiesConfig = process.env.PROXIES_CONFIG;

  if (proxiesConfig) {
    try {
      const proxies = JSON.parse(proxiesConfig);
      proxyManager.addProxies(proxies);
      console.log(`Loaded ${proxies.length} proxies from configuration`);
    } catch (error) {
      console.error("Failed to parse proxies configuration:", error);
    }
  }

  // Also check for individual proxy environment variables
  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyProtocol = process.env.PROXY_PROTOCOL;

  if (proxyHost && proxyPort) {
    proxyManager.addProxy({
      host: proxyHost,
      port: parseInt(proxyPort),
      protocol: (proxyProtocol as any) || "http",
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    });
    console.log(`Loaded single proxy from environment variables`);
  }
};
