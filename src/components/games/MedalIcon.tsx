import React from "react";
import * as Icons from "lucide-react";

interface Props {
  name: string;
  className?: string;
}

export function MedalIcon({ name, className = "h-5 w-5" }: Props) {
  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] || Icons.Medal;
  return <IconComponent className={className} />;
}
