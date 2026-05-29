import os from 'os';
import { performance, PerformanceObserver } from 'perf_hooks';
import { logStream } from './logStream';

class ServerHealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private eventLoopLag: number = 0;
  
  // Track previous CPU usage for percentage calculation
  private previousCpuUsage = process.cpuUsage();
  private previousCpuTime = Date.now();

  constructor() {
    this.setupEventLoopMonitoring();
  }

  private setupEventLoopMonitoring() {
    // Monitor event loop lag using PerformanceObserver
    const obs = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0];
      if (entry) {
        this.eventLoopLag = entry.duration;
      }
    });
    // This requires node version that supports monitorEventLoopDelay
    // Fallback to simple setTimeout check if needed
    try {
      obs.observe({ entryTypes: ['measure'], buffered: false });
    } catch (e) {
      // Ignoring unsupported types
    }
  }

  private measureEventLoopFallback() {
    const start = performance.now();
    setTimeout(() => {
      this.eventLoopLag = performance.now() - start - 10; // 10ms expected delay
    }, 10);
  }

  public start(intervalMs: number = 5000) {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.measureEventLoopFallback();
      this.reportHealth();
    }, intervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private getCpuPercentage(): number {
    const currentCpuUsage = process.cpuUsage();
    const currentCpuTime = Date.now();
    
    const userDiff = currentCpuUsage.user - this.previousCpuUsage.user;
    const systemDiff = currentCpuUsage.system - this.previousCpuUsage.system;
    
    const timeDiff = currentCpuTime - this.previousCpuTime;
    
    // CPU usage is in microseconds, timeDiff is in milliseconds
    const totalCpuTime = (userDiff + systemDiff) / 1000; 
    
    const percentage = (totalCpuTime / timeDiff) * 100;
    
    this.previousCpuUsage = currentCpuUsage;
    this.previousCpuTime = currentCpuTime;
    
    return Number(Math.min(100, Math.max(0, percentage)).toFixed(2));
  }

  private reportHealth() {
    const memoryUsage = process.memoryUsage();
    
    const stats = {
      ramUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      cpuUsage: this.getCpuPercentage(),
      eventLoopLag: Number(Math.max(0, this.eventLoopLag).toFixed(2)),
      uptime: process.uptime(),
      osLoadAvg: os.loadavg(),
      activeClients: logStream.getActiveClientCount()
    };

    logStream.emitLog({
      type: 'SYSTEM',
      message: 'Server Health Update',
      memoryUsage: stats.ramUsage,
      cpuUsage: stats.cpuUsage,
      eventLoopLag: stats.eventLoopLag,
      uptime: stats.uptime,
      loadAvg: stats.osLoadAvg,
      activeSSEClients: stats.activeClients
    });

    // Detect abnormal usage and emit WARNING
    const heapUsedMB = stats.ramUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 1024) { // Warning if heap > 1GB
      logStream.emitLog({
        type: 'WARNING',
        message: `High Memory Usage Detected: ${heapUsedMB.toFixed(2)} MB`,
        memoryUsage: stats.ramUsage
      });
    }

    if (stats.cpuUsage > 80) { // Warning if CPU > 80%
      logStream.emitLog({
        type: 'WARNING',
        message: `High CPU Usage Detected: ${stats.cpuUsage}%`,
        cpuUsage: stats.cpuUsage
      });
    }

    if (stats.eventLoopLag > 100) { // Warning if Event Loop Lag > 100ms
      logStream.emitLog({
        type: 'WARNING',
        message: `High Event Loop Lag Detected: ${stats.eventLoopLag} ms`
      });
    }
  }
}

export const serverHealthMonitor = new ServerHealthMonitor();
