"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Comparison {
  title: string;
  headers: string[];
  rows: string[][];
}

interface ComparisonViewerProps {
  comparisons: Comparison[];
}

export function ComparisonViewer({ comparisons }: ComparisonViewerProps) {
  if (!comparisons || comparisons.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          📊 对比分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {comparisons.map((comparison, index) => (
          <div key={index} className="space-y-3">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200">
              {comparison.title}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    {comparison.headers.map((header, hIndex) => (
                      <th
                        key={hIndex}
                        className="border border-slate-300 dark:border-slate-600 px-4 py-2 text-left font-semibold"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={`
                        ${rowIndex % 2 === 0 
                          ? "bg-white dark:bg-slate-900" 
                          : "bg-slate-50 dark:bg-slate-800/50"
                        }
                      `}
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={`
                            border border-slate-300 dark:border-slate-600 px-4 py-2
                            ${cellIndex === 0 ? "font-medium" : ""}
                          `}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
