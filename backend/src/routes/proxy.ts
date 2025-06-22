import { Router, Request, Response } from "express";
import { proxyManager } from "../utils/proxy-manager";
import { proxyRefreshService } from "../utils/proxy-refresh";
import { cookieSecurityManager } from "../utils/cookie-security";

const router = Router();

// Get proxy statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = proxyManager.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Proxy stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get proxy statistics",
    });
  }
});

// Add a new proxy
router.post("/add", async (req: Request, res: Response) => {
  try {
    const { host, port, protocol, username, password } = req.body;

    if (!host || !port) {
      return res.status(400).json({
        success: false,
        error: "Host and port are required",
      });
    }

    if (!["http", "https", "socks4", "socks5"].includes(protocol)) {
      return res.status(400).json({
        success: false,
        error: "Protocol must be one of: http, https, socks4, socks5",
      });
    }

    proxyManager.addProxy({
      host,
      port: parseInt(port),
      protocol,
      username,
      password,
    });

    res.json({
      success: true,
      message: `Proxy ${host}:${port} added successfully`,
    });
  } catch (error: any) {
    console.error("Add proxy error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add proxy",
    });
  }
});

// Add multiple proxies
router.post("/add-bulk", async (req: Request, res: Response) => {
  try {
    const { proxies } = req.body;

    if (!Array.isArray(proxies)) {
      return res.status(400).json({
        success: false,
        error: "Proxies must be an array",
      });
    }

    // Validate each proxy
    for (const proxy of proxies) {
      if (!proxy.host || !proxy.port) {
        return res.status(400).json({
          success: false,
          error: "Each proxy must have host and port",
        });
      }

      if (!["http", "https", "socks4", "socks5"].includes(proxy.protocol)) {
        return res.status(400).json({
          success: false,
          error: "Protocol must be one of: http, https, socks4, socks5",
        });
      }
    }

    proxyManager.addProxies(proxies);

    res.json({
      success: true,
      message: `${proxies.length} proxies added successfully`,
    });
  } catch (error: any) {
    console.error("Add bulk proxies error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add proxies",
    });
  }
});

// Reset proxy failure counts
router.post("/reset", async (req: Request, res: Response) => {
  try {
    proxyManager.resetFailureCounts();

    res.json({
      success: true,
      message: "All proxy failure counts reset",
    });
  } catch (error: any) {
    console.error("Reset proxies error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset proxy failure counts",
    });
  }
});

// Clear all proxies
router.delete("/clear", async (req: Request, res: Response) => {
  try {
    proxyManager.clearProxies();

    res.json({
      success: true,
      message: "All proxies cleared",
    });
  } catch (error: any) {
    console.error("Clear proxies error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear proxies",
    });
  }
});

// Test proxy connectivity (basic test)
router.post("/test", async (req: Request, res: Response) => {
  try {
    const { host, port, protocol, username, password } = req.body;

    if (!host || !port) {
      return res.status(400).json({
        success: false,
        error: "Host and port are required",
      });
    }

    // This is a basic validation - in a real implementation,
    // you might want to test actual connectivity
    const isValid = host && port > 0 && port < 65536;

    res.json({
      success: true,
      data: {
        host,
        port,
        protocol: protocol || "http",
        isValid,
        message: isValid
          ? "Proxy configuration appears valid"
          : "Invalid proxy configuration",
      },
    });
  } catch (error: any) {
    console.error("Test proxy error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test proxy",
    });
  }
});

// Auto-refresh service endpoints
router.get("/refresh/status", async (req: Request, res: Response) => {
  try {
    const status = proxyRefreshService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error("Get refresh status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get refresh service status",
    });
  }
});

router.post("/refresh/start", async (req: Request, res: Response) => {
  try {
    proxyRefreshService.start();
    res.json({
      success: true,
      message: "Proxy refresh service started",
    });
  } catch (error: any) {
    console.error("Start refresh service error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start refresh service",
    });
  }
});

router.post("/refresh/stop", async (req: Request, res: Response) => {
  try {
    proxyRefreshService.stop();
    res.json({
      success: true,
      message: "Proxy refresh service stopped",
    });
  } catch (error: any) {
    console.error("Stop refresh service error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to stop refresh service",
    });
  }
});

router.post("/refresh/trigger", async (req: Request, res: Response) => {
  try {
    await proxyRefreshService.refreshProxies();
    res.json({
      success: true,
      message: "Proxy refresh triggered successfully",
    });
  } catch (error: any) {
    console.error("Trigger refresh error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to trigger proxy refresh",
    });
  }
});

// ======== COOKIE SECURITY ENDPOINTS ========

// Get cookie security status
router.get("/cookies/security", (req: Request, res: Response) => {
  try {
    const status = cookieSecurityManager.getSecurityStatus();
    res.json({
      success: true,
      status: {
        ...status,
        cookieAge: status.cookieAge
          ? `${Math.round(status.cookieAge / (1000 * 60 * 60 * 24))} days`
          : null,
        recommendation: status.rotationNeeded
          ? "⚠️ Cookies are old, consider rotating them"
          : status.encryptedFileExists
          ? "✅ Cookies are secure and up to date"
          : "❌ No cookies found",
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
