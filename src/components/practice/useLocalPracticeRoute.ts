"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { examReturnHref } from "@/lib/exam-browse-route";
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
  const router = useRouter();
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
    goToExams: () => router.push(examReturnHref(window.location.search) ?? "/practice/exams"),
    goHome: () => {
      const returnHref = examReturnHref(window.location.search);
      if (returnHref) router.push(returnHref);
      else navigate({ kind: "home", id: null });
    },
  };
}
