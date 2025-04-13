import { serve } from "bun";
import index from "./index.html";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
    
    "/api/analyze-url": async (req) => {
      try {
        if (req.method !== "POST") {
          return new Response("Method not allowed", { status: 405 });
        }
        
        const data = await req.json();
        const url = data.url;
        
        if (!url) {
          return new Response("URL parameter is required", { status: 400 });
        }
        
        const analysis = await analyzeUrl(url);
        return Response.json(analysis);
      } catch (error) {
        console.error("Error analyzing URL:", error);
        return new Response("Error analyzing URL: " + (error as Error).message, { status: 500 });
      }
    },
  },

  development: process.env.NODE_ENV !== "production",
});

// Type definitions for our metrics
interface Resource {
  url: string;
  type: string;
  status: number;
  size: number;
  timing: any;
  headers: Record<string, string>;
}

interface PerformanceMetrics {
  ttfb: number;
  domLoaded: number;
  windowLoaded: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  [key: string]: any;
}

interface RenderBlockingResource {
  type: string;
  url: string | undefined;
  blocking: string;
}

interface Recommendation {
  type: string;
  severity: string;
  message: string;
}

interface AnalysisMetrics {
  urlAnalyzed: string;
  timestamp: string;
  resources: Resource[];
  totalResources: number;
  totalSize: number;
  loadTime: number;
  renderBlockingResources: RenderBlockingResource[];
  performanceMetrics: PerformanceMetrics;
  recommendations: Recommendation[];
}

// Custom type for LayoutShift entries that have a value property
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
}

// Function to analyze URL performance
async function analyzeUrl(url: string): Promise<AnalysisMetrics> {
  // Basic metrics
  const metrics: AnalysisMetrics = {
    urlAnalyzed: url,
    timestamp: new Date().toISOString(),
    resources: [],
    totalResources: 0,
    totalSize: 0,
    loadTime: 0,
    renderBlockingResources: [],
    performanceMetrics: {
      ttfb: 0,
      domLoaded: 0,
      windowLoaded: 0
    },
    recommendations: [],
  };
  
  // Start browser
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Configure performance metrics collection
  await page.setRequestInterception(true);
  
  // Track resources
  const resourceStats = new Map<string, Resource>();
  
  page.on('request', request => {
    request.continue();
  });
  
  page.on('response', async response => {
    const url = response.url();
    const resourceType = response.request().resourceType();
    const status = response.status();
    
    try {
      // Size calculation
      let responseSize = 0;
      const buffer = await response.buffer().catch(() => null);
      if (buffer) responseSize = buffer.length;
      
      const timing = response.timing();
      
      resourceStats.set(url, {
        url,
        type: resourceType,
        status,
        size: responseSize,
        timing: timing,
        headers: response.headers(),
      });
    } catch (e) {
      console.error(`Error processing response for ${url}:`, e);
    }
  });
  
  // Collect performance metrics
  const client = await page.target().createCDPSession();
  await client.send('Performance.enable');
  
  // Navigate to page and wait for load
  const navigationStart = Date.now();
  await page.goto(url, { waitUntil: 'networkidle0' });
  const loadTime = Date.now() - navigationStart;
  
  // Collect performance metrics
  const performanceMetrics = await client.send('Performance.getMetrics');
  const performanceTiming = JSON.parse(
    await page.evaluate(() => JSON.stringify(performance.timing))
  );
  
  // Lighthouse integration
  let lighthouseMetrics = {};
  try {
    // We're collecting core vitals manually here instead of running a full lighthouse audit
    // as that would require more complex setup
    const coreVitals = await page.evaluate(() => {
      if (!window.performance || !window.performance.getEntriesByType) {
        return null;
      }
      
      // FCP (First Contentful Paint)
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      
      // LCP (Largest Contentful Paint)
      let lcp = null;
      if (window.PerformanceObserver && window.PerformanceObserver.supportedEntryTypes &&
          window.PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')) {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries && lcpEntries.length > 0) {
          lcp = lcpEntries[lcpEntries.length - 1].startTime;
        }
      }
      
      // CLS (Cumulative Layout Shift)
      let cls = 0;
      if (window.PerformanceObserver && window.PerformanceObserver.supportedEntryTypes &&
          window.PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
        const layoutShiftEntries = performance.getEntriesByType('layout-shift');
        if (layoutShiftEntries) {
          // Using a type assertion here because the browser context knows this type
          cls = (layoutShiftEntries as any[]).reduce((total, entry) => total + (entry.value || 0), 0);
        }
      }
      
      return { fcp: fcp?.startTime, lcp, cls };
    });
    
    lighthouseMetrics = coreVitals || {};
  } catch (e) {
    console.error("Error collecting Lighthouse metrics:", e);
  }
  
  // Collect HTML document and analyze
  const htmlContent = await page.content();
  const $ = cheerio.load(htmlContent);
  
  // Check for render-blocking resources
  const renderBlockingResources: RenderBlockingResource[] = [];
  $('head link[rel="stylesheet"]').each((_, el) => {
    renderBlockingResources.push({
      type: 'css',
      url: $(el).attr('href'),
      blocking: 'render',
    });
  });
  
  $('head script[src]').each((_, el) => {
    if (!$(el).attr('async') && !$(el).attr('defer')) {
      renderBlockingResources.push({
        type: 'js',
        url: $(el).attr('src'),
        blocking: 'render',
      });
    }
  });
  
  // Generate recommendations
  const recommendations: Recommendation[] = [];
  
  // Check for large resources - using Array.from to fix iteration issues
  Array.from(resourceStats.entries()).forEach(([_, resource]) => {
    if (resource.size > 1000000) { // 1MB+
      recommendations.push({
        type: 'resource-size',
        severity: 'high',
        message: `Large resource (${(resource.size / 1024 / 1024).toFixed(2)} MB): ${resource.url}`,
      });
    }
  });
  
  // Check for caching opportunities - using Array.from to fix iteration issues
  Array.from(resourceStats.entries()).forEach(([_, resource]) => {
    const cacheControl = resource.headers['cache-control'];
    if (!cacheControl && ['image', 'font', 'stylesheet', 'script'].includes(resource.type)) {
      recommendations.push({
        type: 'caching',
        severity: 'medium',
        message: `Missing cache headers for: ${resource.url}`,
      });
    }
  });
  
  // Populate the full metrics object
  metrics.resources = Array.from(resourceStats.values());
  metrics.totalResources = metrics.resources.length;
  metrics.totalSize = metrics.resources.reduce((sum, res) => sum + (res.size || 0), 0);
  metrics.loadTime = loadTime;
  metrics.renderBlockingResources = renderBlockingResources;
  
  metrics.performanceMetrics = {
    ttfb: performanceTiming.responseStart - performanceTiming.requestStart,
    domLoaded: performanceTiming.domContentLoadedEventEnd - performanceTiming.navigationStart,
    windowLoaded: performanceTiming.loadEventEnd - performanceTiming.navigationStart,
    ...lighthouseMetrics,
    // Add puppeteer performance metrics
    ...performanceMetrics.metrics.reduce((acc: Record<string, any>, metric: any) => {
      acc[metric.name] = metric.value;
      return acc;
    }, {})
  };
  
  metrics.recommendations = recommendations;
  
  // Close browser
  await browser.close();
  
  return metrics;
}

console.log(`🚀 Server running at ${server.url}`);
