import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ToolCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-emerald-100">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            {icon}
          </div>
          <div>
            <CardTitle className="text-base text-emerald-900">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
