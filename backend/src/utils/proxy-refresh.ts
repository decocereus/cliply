import { proxyManager } from "./proxy-manager";
import axios from "axios";

interface FreeProxySource {
  name: string;
  url: string;
  parser: (data: any) => Array<{
    host: string;
    port: number;
    protocol: "http" | "https" | "socks4" | "socks5";
  }>;
}

export class ProxyRefreshService {
  private refreshInterval: NodeJS.Timeout | undefined;
  private isRefreshing = false;
  private readonly refreshIntervalMs: number;
  private readonly maxProxies: number;
  private readonly minProxies: number;

  // Free proxy sources
  private readonly freeProxySources: FreeProxySource[] = [
    {
      name: "proxy-list.download",
      url: "https://www.proxy-list.download/api/v1/get?type=http",
      parser: (data: string) => {
        return data
          .split("\n")
          .filter((line) => line.trim() && line.includes(":"))
          .slice(0, 10) // Take first 10
          .map((line) => {
            const [host, port] = line.trim().split(":");
            return { host, port: parseInt(port), protocol: "http" as const };
          })
          .filter((proxy) => proxy.host && proxy.port && !isNaN(proxy.port));
      },
    },
    {
      name: "free-proxy-list.net",
      url: "https://api.proxyscrape.com/v2/?request=get&protocol=http&format=textplain&country=all",
      parser: (data: string) => {
        return data
          .split("\n")
          .filter((line) => line.trim() && line.includes(":"))
          .slice(0, 10)
          .map((line) => {
            const [host, port] = line.trim().split(":");
            return { host, port: parseInt(port), protocol: "http" as const };
          })
          .filter((proxy) => proxy.host && proxy.port && !isNaN(proxy.port));
      },
    },
    {
      name: "proxylist.geonode.com",
      url: "https://proxylist.geonode.com/api/proxy-list?limit=10&page=1&sort_by=lastChecked&sort_type=desc&protocol=http",
      parser: (data: any) => {
        try {
          // If data is already an object, use it directly, otherwise parse as JSON
          const json = typeof data === "string" ? JSON.parse(data) : data;
          if (json.data && Array.isArray(json.data)) {
            return json.data
              .map((proxy: any) => ({
                host: proxy.ip,
                port: parseInt(proxy.port),
                protocol: "http" as const,
              }))
              .filter(
                (proxy: any) => proxy.host && proxy.port && !isNaN(proxy.port)
              );
          }
        } catch (e) {
          console.error("Failed to parse geonode response:", e);
        }
        return [];
      },
    },
  ];

  constructor(
    options: {
      refreshIntervalMs?: number;
      maxProxies?: number;
      minProxies?: number;
    } = {}
  ) {
    this.refreshIntervalMs = options.refreshIntervalMs || 300000; // 5 minutes
    this.maxProxies = options.maxProxies || 15;
    this.minProxies = options.minProxies || 5;
  }

  /**
   * Start automatic proxy refresh
   */
  start() {
    console.log("🔄 Starting automatic proxy refresh service...");
    console.log(
      `   Refresh interval: ${this.refreshIntervalMs / 1000} seconds`
    );
    console.log(`   Max proxies: ${this.maxProxies}`);
    console.log(`   Min proxies: ${this.minProxies}`);

    // Initial refresh
    this.refreshProxies();

    // Set up periodic refresh
    this.refreshInterval = setInterval(() => {
      this.refreshProxies();
    }, this.refreshIntervalMs);
  }

  /**
   * Stop automatic proxy refresh
   */
  stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
      console.log("🛑 Stopped automatic proxy refresh service");
    }
  }

  /**
   * Manually trigger proxy refresh
   */
  async refreshProxies(): Promise<void> {
    if (this.isRefreshing) {
      console.log("⏳ Proxy refresh already in progress, skipping...");
      return;
    }

    this.isRefreshing = true;
    console.log("🔄 Refreshing proxy pool...");

    try {
      const currentStats = proxyManager.getStats();
      const activeProxies = currentStats.active;
      const failedProxies = currentStats.failed;

      console.log(
        `   Current: ${activeProxies} active, ${failedProxies} failed proxies`
      );

      // Remove failed proxies if we have too many total proxies
      if (currentStats.total > this.maxProxies) {
        console.log(
          "🧹 Clearing failed proxies to make room for fresh ones..."
        );
        this.removeFailedProxies();
      }

      // Fetch new proxies if we're below minimum or need to replace failed ones
      const needsRefresh = activeProxies < this.minProxies || failedProxies > 0;

      if (needsRefresh) {
        const neededProxies = Math.max(
          this.minProxies - activeProxies,
          failedProxies
        );

        console.log(`   Fetching ${neededProxies} new proxies...`);
        await this.fetchAndAddFreshProxies(neededProxies);
      } else {
        console.log("✅ Proxy pool is healthy, no refresh needed");
      }
    } catch (error) {
      console.error("❌ Error during proxy refresh:", error);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Fetch fresh proxies from multiple sources
   */
  private async fetchAndAddFreshProxies(count: number): Promise<void> {
    const allNewProxies: Array<{
      host: string;
      port: number;
      protocol: "http" | "https" | "socks4" | "socks5";
    }> = [];

    // Try each proxy source
    for (const source of this.freeProxySources) {
      try {
        console.log(`   Fetching from ${source.name}...`);

        const response = await axios.get(source.url, {
          timeout: 10000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        const proxies = source.parser(response.data);
        console.log(`   Found ${proxies.length} proxies from ${source.name}`);

        allNewProxies.push(...proxies);
      } catch (error: any) {
        console.warn(
          `   ⚠️  Failed to fetch from ${source.name}: ${error.message}`
        );
      }
    }

    // Remove duplicates and existing proxies
    const currentProxies = proxyManager.getStats().proxies;
    const existingHosts = new Set(
      currentProxies.map((p) => `${p.host}:${p.port}`)
    );

    const uniqueNewProxies = allNewProxies.filter(
      (proxy) => !existingHosts.has(`${proxy.host}:${proxy.port}`)
    );

    // Add new proxies up to the requested count
    const proxiesToAdd = uniqueNewProxies.slice(0, count);

    if (proxiesToAdd.length > 0) {
      console.log(`   Adding ${proxiesToAdd.length} fresh proxies...`);
      proxyManager.addProxies(proxiesToAdd);

      // Log the new proxies
      proxiesToAdd.forEach((proxy) => {
        console.log(`   ✅ Added: ${proxy.host}:${proxy.port}`);
      });
    } else {
      console.log("   ⚠️  No new unique proxies found");
    }
  }

  /**
   * Remove failed proxies to make room for fresh ones
   */
  private removeFailedProxies(): void {
    const stats = proxyManager.getStats();
    const failedCount = stats.failed;

    if (failedCount > 0) {
      console.log(`   Removing ${failedCount} failed proxies...`);
      // Clear all proxies and re-add only the active ones
      const activeProxies = stats.proxies
        .filter((p) => p.isActive)
        .map((p) => ({
          host: p.host,
          port: p.port,
          protocol: p.protocol as any,
        }));

      proxyManager.clearProxies();
      if (activeProxies.length > 0) {
        proxyManager.addProxies(activeProxies);
      }
    }
  }

  /**
   * Get refresh service status
   */
  getStatus() {
    return {
      isRunning: !!this.refreshInterval,
      isRefreshing: this.isRefreshing,
      refreshIntervalMs: this.refreshIntervalMs,
      maxProxies: this.maxProxies,
      minProxies: this.minProxies,
      nextRefreshIn: this.refreshInterval
        ? Math.ceil(this.refreshIntervalMs / 1000)
        : null,
    };
  }
}

// Global proxy refresh service instance
export const proxyRefreshService = new ProxyRefreshService({
  refreshIntervalMs: 300000, // 5 minutes
  maxProxies: 15,
  minProxies: 5,
});
