"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TimelineEvent {
  date: string;
  event: string;
  importance?: "high" | "medium" | "low";
}

interface TimelineViewerProps {
  events: TimelineEvent[];
}

const importanceColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const importanceLabels = {
  high: "重要",
  medium: "一般",
  low: "次要",
};

export function TimelineViewer({ events }: TimelineViewerProps) {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          📅 时间线
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* 时间线主线 */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-300 dark:bg-slate-600" />
          
          {/* 事件列表 */}
          <div className="space-y-6">
            {events.map((item, index) => (
              <div key={index} className="relative pl-10">
                {/* 时间点标记 */}
                <div 
                  className={`
                    absolute left-2 top-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800
                    ${importanceColors[item.importance || "medium"]}
                  `}
                />
                
                {/* 事件内容 */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {item.date}
                    </span>
                    {item.importance && (
                      <Badge variant="outline" className="text-xs">
                        {importanceLabels[item.importance]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">
                    {item.event}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
