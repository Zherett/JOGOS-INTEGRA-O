import { useState } from "react";
import type { TeamSession } from "./use-team-session";

/**
 * "Finalizar jogo" flow: shows the final team ranking before clearing the session.
 */
export function useSessionEnd(team: TeamSession, onClose: () => void) {
  const [showing, setShowing] = useState(false);

  function request() {
    if (team.activeSession) setShowing(true);
    else onClose();
  }

  function close() {
    setShowing(false);
    team.finish();
    onClose();
  }

  return { showing, request, close };
}
