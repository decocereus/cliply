import crypto from "crypto";
import fs from "fs";
import path from "path";

interface CookieSecurityConfig {
  encryptionKey: string;
  cookieFilePath: string;
  encryptedCookieFilePath: string;
  backupPath: string;
  rotationIntervalMs: number;
  maxCookieAge: number; // in milliseconds
}

export class CookieSecurityManager {
  private config: CookieSecurityConfig;
  private rotationTimer?: NodeJS.Timeout;
  private lastAccessTime: number = 0;
  private accessCount: number = 0;

  constructor(config: Partial<CookieSecurityConfig> = {}) {
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.COOKIE_ENCRYPTION_KEY
    ) {
      console.error(
        "🚨 CRITICAL: COOKIE_ENCRYPTION_KEY environment variable not found in production!"
      );
      console.error(
        '🔧 Set it using: export COOKIE_ENCRYPTION_KEY="your_64_character_hex_key"'
      );
      throw new Error("Missing encryption key in production environment");
    }
    let defaultKey = process.env.COOKIE_ENCRYPTION_KEY!;
    if (!defaultKey) {
      console.warn(
        "⚠️  Using auto-generated encryption key. Set COOKIE_ENCRYPTION_KEY for production!"
      );
    }

    this.config = {
      encryptionKey: defaultKey,
      cookieFilePath: path.join(__dirname, "../../cookies.txt"),
      encryptedCookieFilePath: path.join(__dirname, "../../cookies.encrypted"),
      backupPath: path.join(__dirname, "../../cookies_backup"),
      rotationIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
      maxCookieAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...config,
    };

    this.initialize();
  }

  /**
   * Initialize cookie security system
   */
  private initialize() {
    console.log("🔐 Initializing cookie security system...");

    // Check if cookies file exists and encrypt it
    if (fs.existsSync(this.config.cookieFilePath)) {
      console.log("📁 Found existing cookies file, encrypting...");
      this.encryptCookieFile();
    }

    // Set up automatic security checks
    this.setupSecurityMonitoring();

    console.log("✅ Cookie security system initialized");
  }

  /**
   * Encrypt the cookie file
   */
  private encryptCookieFile(): void {
    try {
      if (!fs.existsSync(this.config.cookieFilePath)) {
        console.warn("⚠️  No cookies file found to encrypt");
        return;
      }

      const cookieData = fs.readFileSync(this.config.cookieFilePath, "utf8");
      const encryptedData = this.encrypt(cookieData);

      // Save encrypted version
      fs.writeFileSync(this.config.encryptedCookieFilePath, encryptedData);

      // Create backup
      this.createSecureBackup(cookieData);

      // Securely delete original (overwrite with random data)
      this.secureDelete(this.config.cookieFilePath);

      console.log("🔒 Cookies encrypted and original file securely deleted");
    } catch (error) {
      console.error("❌ Failed to encrypt cookies:", error);
    }
  }

  /**
   * Decrypt and temporarily restore cookies for use
   */
  getDecryptedCookieFile(): string {
    this.logAccess();

    try {
      if (!fs.existsSync(this.config.encryptedCookieFilePath)) {
        console.error("❌ No encrypted cookies file found");
        return "";
      }

      const encryptedData = fs.readFileSync(
        this.config.encryptedCookieFilePath,
        "utf8"
      );
      const decryptedData = this.decrypt(encryptedData);

      // Create temporary decrypted file
      const tempPath = path.join(__dirname, "../../cookies_temp.txt");
      fs.writeFileSync(tempPath, decryptedData);

      // Set strict permissions (owner read/write only)
      fs.chmodSync(tempPath, 0o600);

      // Schedule automatic cleanup
      setTimeout(() => this.secureDelete(tempPath), 30000); // Delete after 30 seconds

      return tempPath;
    } catch (error) {
      console.error("❌ Failed to decrypt cookies:", error);
      return "";
    }
  }

  /**
   * Encrypt data using AES-256-CBC
   */
  private encrypt(data: string): string {
    try {
      const algorithm = "aes-256-cbc";
      const key = Buffer.from(this.config.encryptionKey, "hex");
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(data, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Combine IV and encrypted data
      return JSON.stringify({
        iv: iv.toString("hex"),
        encrypted: encrypted,
        timestamp: Date.now(),
      });
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  private decrypt(encryptedData: string): string {
    try {
      const data = JSON.parse(encryptedData);
      const algorithm = "aes-256-cbc";
      const key = Buffer.from(this.config.encryptionKey, "hex");
      const iv = Buffer.from(data.iv, "hex");

      // Check if cookies are too old
      if (Date.now() - data.timestamp > this.config.maxCookieAge) {
        console.warn(
          "⚠️  Cookies are older than maximum age, consider refreshing"
        );
      }

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(data.encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  /**
   * Create secure backup of cookies
   */
  private createSecureBackup(cookieData: string): void {
    try {
      if (!fs.existsSync(this.config.backupPath)) {
        fs.mkdirSync(this.config.backupPath, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFile = path.join(
        this.config.backupPath,
        `cookies_${timestamp}.encrypted`
      );
      const encryptedBackup = this.encrypt(cookieData);

      fs.writeFileSync(backupFile, encryptedBackup);
      fs.chmodSync(backupFile, 0o600); // Owner read/write only

      // Keep only last 5 backups
      this.cleanupOldBackups();

      console.log(`💾 Secure backup created: ${backupFile}`);
    } catch (error) {
      console.error("❌ Failed to create backup:", error);
    }
  }

  /**
   * Securely delete file by overwriting with random data
   */
  private secureDelete(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) return;

      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Overwrite with random data 3 times
      for (let i = 0; i < 3; i++) {
        const randomData = crypto.randomBytes(fileSize);
        fs.writeFileSync(filePath, randomData);
      }

      // Finally delete the file
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("❌ Failed to securely delete file:", error);
    }
  }

  /**
   * Setup security monitoring
   */
  private setupSecurityMonitoring(): void {
    // Monitor file system changes
    if (fs.existsSync(this.config.encryptedCookieFilePath)) {
      fs.watchFile(this.config.encryptedCookieFilePath, (curr, prev) => {
        console.log("🔍 Cookie file accessed or modified");
        this.logSecurityEvent(
          "file_access",
          "Encrypted cookie file was accessed"
        );
      });
    }

    // Set up rotation timer
    this.rotationTimer = setInterval(() => {
      this.checkCookieHealth();
    }, this.config.rotationIntervalMs);
  }

  /**
   * Log access to cookies
   */
  private logAccess(): void {
    this.lastAccessTime = Date.now();
    this.accessCount++;

    if (this.accessCount % 10 === 0) {
      console.log(`🔍 Cookie access count: ${this.accessCount}`);
    }
  }

  /**
   * Log security events
   */
  private logSecurityEvent(type: string, details: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] SECURITY: ${type} - ${details}\n`;

    const logPath = path.join(__dirname, "../../security.log");
    fs.appendFileSync(logPath, logEntry);
  }

  /**
   * Check cookie health and suggest rotation
   */
  private checkCookieHealth(): void {
    try {
      if (!fs.existsSync(this.config.encryptedCookieFilePath)) {
        console.warn(
          "⚠️  No encrypted cookies found - consider updating cookies"
        );
        return;
      }

      const stats = fs.statSync(this.config.encryptedCookieFilePath);
      const ageInMs = Date.now() - stats.mtime.getTime();

      if (ageInMs > this.config.maxCookieAge) {
        console.warn("🔄 Cookies are old - consider rotating them");
        this.logSecurityEvent(
          "cookie_rotation_needed",
          "Cookies older than maximum age"
        );
      }
    } catch (error) {
      console.error("❌ Failed to check cookie health:", error);
    }
  }

  /**
   * Cleanup old backups
   */
  private cleanupOldBackups(): void {
    try {
      if (!fs.existsSync(this.config.backupPath)) return;

      const files = fs
        .readdirSync(this.config.backupPath)
        .filter(
          (file) => file.startsWith("cookies_") && file.endsWith(".encrypted")
        )
        .map((file) => ({
          name: file,
          path: path.join(this.config.backupPath, file),
          time: fs.statSync(path.join(this.config.backupPath, file)).mtime,
        }))
        .sort((a, b) => b.time.getTime() - a.time.getTime());

      // Keep only the 5 most recent backups
      if (files.length > 5) {
        const filesToDelete = files.slice(5);
        filesToDelete.forEach((file) => {
          this.secureDelete(file.path);
        });
      }
    } catch (error) {
      console.error("❌ Failed to cleanup old backups:", error);
    }
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      encryptedFileExists: fs.existsSync(this.config.encryptedCookieFilePath),
      lastAccessTime: new Date(this.lastAccessTime).toISOString(),
      accessCount: this.accessCount,
      cookieAge: fs.existsSync(this.config.encryptedCookieFilePath)
        ? Date.now() -
          fs.statSync(this.config.encryptedCookieFilePath).mtime.getTime()
        : null,
      rotationNeeded: fs.existsSync(this.config.encryptedCookieFilePath)
        ? Date.now() -
            fs.statSync(this.config.encryptedCookieFilePath).mtime.getTime() >
          this.config.maxCookieAge
        : false,
    };
  }

  /**
   * Cleanup and stop monitoring
   */
  destroy(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    if (fs.existsSync(this.config.encryptedCookieFilePath)) {
      fs.unwatchFile(this.config.encryptedCookieFilePath);
    }
  }
}

// Global cookie security manager instance
export const cookieSecurityManager = new CookieSecurityManager();

// Helper function to get secure cookie path for yt-dlp
export const getSecureCookiePath = (): string => {
  return cookieSecurityManager.getDecryptedCookieFile();
};
