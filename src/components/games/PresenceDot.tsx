import React from "react";
import { usePlayerPresence, type PresenceStatus } from "@/lib/presence";

export interface PresenceDotProps {
  playerId?: string;
  playfabId?: string;
  nick?: string;
  nickNormalized?: string;
  status?: PresenceStatus;
  tooltipText?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  showPingAnimation?: boolean;
}

export const PresenceDot: React.FC<PresenceDotProps> = ({
  playerId,
  playfabId,
  nick,
  nickNormalized,
  status: explicitStatus,
  tooltipText: explicitTooltip,
  size = "sm",
  className = "",
  showPingAnimation = true,
}) => {
  const presence = usePlayerPresence(playerId, {
    playfabId,
    nick,
    nickNormalized,
  });

  const status: PresenceStatus = explicitStatus ?? presence.status;
  const tooltip = explicitTooltip ?? presence.tooltip;

  const sizeClasses = {
    xs: "h-2 w-2",
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
  }[size];

  // Cores do Usuário:
  // Verde = Online
  // Cinza = Inativo
  // Vermelho = Offline
  const colorClasses = {
    online: "bg-emerald-500 ring-emerald-500/40 shadow-[0_0_6px_rgba(16,185,129,0.8)]",
    idle: "bg-slate-400 dark:bg-slate-500 ring-slate-400/30",
    offline: "bg-rose-500 ring-rose-500/30",
  }[status];

  const isAbsolute = className.includes("absolute");

  return (
    <span
      className={`${isAbsolute ? "" : "relative"} inline-flex shrink-0 items-center justify-center ${className}`}
      title={tooltip}
      aria-label={tooltip}
    >
      {/* Ping suave se estiver online e ativado */}
      {status === "online" && showPingAnimation && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60`}
        />
      )}
      <span
        className={`relative inline-block rounded-full ring-2 ring-card transition-colors duration-300 ${sizeClasses} ${colorClasses}`}
      />
    </span>
  );
};
