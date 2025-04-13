// filepath: /home/zet/src/cometweb_ant/src/PerformanceAnalyzer.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Resource {
  url: string;
  type: string;
  status: number;
  size: number;
  timing: any;
  headers: Record<string, string>;
}

interface Recommendation {
  type: string;
  severity: string;
  message: string;
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

interface AnalysisResult {
  urlAnalyzed: string;
  timestamp: string;
  resources: Resource[];
  totalResources: number;
  totalSize: number;
  loadTime: number;
  renderBlockingResources: any[];
  performanceMetrics: PerformanceMetrics;
  recommendations: Recommendation[];
}

export function PerformanceAnalyzer() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      setError("Please enter a URL");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      
      const response = await fetch("/api/analyze-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Error: ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "An error occurred while analyzing the URL");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format file sizes
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Helper function to format time in ms
  const formatTime = (ms: number) => {
    return `${ms.toFixed(2)} ms`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Website Performance Analyzer</CardTitle>
          <CardDescription>
            Enter a URL to analyze its performance metrics and resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={analyzeUrl} className="flex gap-2">
            <Input 
              type="url" 
              placeholder="https://example.com" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze"}
            </Button>
          </form>
          
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
      
      {loading && (
        <Card className="mb-8">
          <CardContent className="p-6 flex justify-center">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-2"></div>
              <p>Analyzing URL, this may take a minute...</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {result && (
        <>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>
                Analysis of {result.urlAnalyzed} completed at {new Date(result.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="border p-4 rounded-lg">
                  <div className="text-muted-foreground text-sm">Total Load Time</div>
                  <div className="text-2xl font-bold">{formatTime(result.loadTime)}</div>
                </div>
                <div className="border p-4 rounded-lg">
                  <div className="text-muted-foreground text-sm">Total Resources</div>
                  <div className="text-2xl font-bold">{result.totalResources}</div>
                </div>
                <div className="border p-4 rounded-lg">
                  <div className="text-muted-foreground text-sm">Total Size</div>
                  <div className="text-2xl font-bold">{formatSize(result.totalSize)}</div>
                </div>
                <div className="border p-4 rounded-lg">
                  <div className="text-muted-foreground text-sm">Blocking Resources</div>
                  <div className="text-2xl font-bold">{result.renderBlockingResources.length}</div>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold mb-2">Core Web Vitals</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="border p-4 rounded-lg">
                  <div className="text-muted-foreground text-sm">TTFB</div>
                  <div className="text-2xl font-bold">{formatTime(result.performanceMetrics.ttfb)}</div>
                </div>
                {result.performanceMetrics.fcp && (
                  <div className="border p-4 rounded-lg">
                    <div className="text-muted-foreground text-sm">First Contentful Paint (FCP)</div>
                    <div className="text-2xl font-bold">{formatTime(result.performanceMetrics.fcp)}</div>
                  </div>
                )}
                {result.performanceMetrics.lcp && (
                  <div className="border p-4 rounded-lg">
                    <div className="text-muted-foreground text-sm">Largest Contentful Paint (LCP)</div>
                    <div className="text-2xl font-bold">{formatTime(result.performanceMetrics.lcp)}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {result.recommendations.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Performance improvement suggestions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.recommendations.map((rec, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        "p-4 rounded-lg border",
                        rec.severity === "high" && "border-destructive/50 bg-destructive/10",
                        rec.severity === "medium" && "border-orange-500/50 bg-orange-500/10",
                        rec.severity === "low" && "border-yellow-500/50 bg-yellow-500/10"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className={cn(
                            "text-xs uppercase font-bold px-2 py-0.5 rounded",
                            rec.severity === "high" && "bg-destructive text-destructive-foreground",
                            rec.severity === "medium" && "bg-orange-500 text-white",
                            rec.severity === "low" && "bg-yellow-500 text-white"
                          )}
                        >
                          {rec.severity}
                        </span>
                        <span className="text-sm font-medium">{rec.type}</span>
                      </div>
                      <p className="text-sm">{rec.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Resource Breakdown</CardTitle>
              <CardDescription>
                Analysis of all resources loaded by the page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">URL</th>
                      <th className="text-right p-2">Size</th>
                      <th className="text-right p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.resources.map((resource, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-2">
                          <span className="capitalize">{resource.type}</span>
                        </td>
                        <td className="p-2">
                          <div className="max-w-sm truncate">{resource.url}</div>
                        </td>
                        <td className="p-2 text-right">
                          {formatSize(resource.size)}
                        </td>
                        <td className="p-2 text-right">
                          <span 
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs",
                              (resource.status >= 200 && resource.status < 300) && "bg-green-500/10 text-green-700",
                              (resource.status >= 300 && resource.status < 400) && "bg-blue-500/10 text-blue-700",
                              (resource.status >= 400 && resource.status < 500) && "bg-orange-500/10 text-orange-700",
                              resource.status >= 500 && "bg-destructive/10 text-destructive"
                            )}
                          >
                            {resource.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}