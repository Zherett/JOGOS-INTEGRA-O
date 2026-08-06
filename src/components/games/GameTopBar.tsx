import { ArrowLeft, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  onExit: () => void;
  /** Shown when a team session is running. */
  sessionActive?: boolean;
  onFinishSession?: () => void;
}

export function GameTopBar({ title, onExit, sessionActive, onFinishSession }: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" onClick={onExit} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Menu
        </Button>
        {sessionActive && onFinishSession && (
          <Button
            size="sm"
            variant="outline"
            onClick={onFinishSession}
            className="h-8 rounded-xl px-2 text-xs font-bold"
          >
            <Flag className="mr-1 h-3 w-3" /> Finalizar jogo
          </Button>
        )}
      </div>
      <div className="font-display text-lg sm:text-xl font-bold truncate">{title}</div>
      <div className="w-20 shrink-0" />
    </div>
  );
}
