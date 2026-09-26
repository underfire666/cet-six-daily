"use client";

import { useCallback, useEffect, useState } from "react";
import {
  practiceStageHref,
  readPracticeStage,
  type PracticeStage,
} from "@/lib/offline/practice-route";

/** Switches an already loaded practice page without requesting a new RSC route. */
export function useLocalPracticeRoute(
  module: "vocabulary" | "reading" | "listening" | "translation" | "writing",
  pathname = `/practice/${module}`,
) {
  const [stage, setStage] = useState<PracticeStage>({ kind: "home", id: null });

  useEffect(() => {
    const readLocation = () => setStage(readPracticeStage(window.location.search));
    readLocation();
    window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
  }, []);

  const navigate = useCallback(
    (next: PracticeStage, replace = false) => {
      const href = practiceStageHref(pathname, window.location.search, next);
      window.history[replace ? "replaceState" : "pushState"](null, "", href);
      setStage(next);
    },
    [pathname],
  );

  return {
    stage,
    openSession: (id: string) => navigate({ kind: "session", id }),
    openComplete: (id: string) => navigate({ kind: "complete", id }, true),
    openWordbook: () => navigate({ kind: "wordbook", id: null }),
    goHome: () => navigate({ kind: "home", id: null }),
  };
}
