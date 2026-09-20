"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { ListeningAudio, ListeningRate } from "@/types/listening";

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";
/** Local Mock audio uses native playbackRate, preserving currentTime on speed changes. */
export function AudioPlayer({
  audio,
  rate,
  onPlay,
}: {
  audio: ListeningAudio;
  rate: ListeningRate;
  onPlay: () => void;
}) {
  const mediaRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<PlaybackState>("idle");
  const [notice, setNotice] = useState("");
  const countNextPlay = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousRate = useRef(rate);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const fail = () => {
    clearTimer();
    mediaRef.current?.pause();
    setState("error");
    setNotice("当前音频播放失败，请点击播放重试，或查看原文继续学习。");
  };
  useEffect(() => {
    const media = mediaRef.current;
    if (media) {
      media.playbackRate = rate;
      media.preservesPitch = true;
    }
    if (previousRate.current !== rate) {
      previousRate.current = rate;
      setNotice(`已切换至 ${rate.toFixed(1)}×，播放位置保持不变。`);
    }
  }, [rate]);
  useEffect(() => {
    const media = mediaRef.current;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      media?.pause();
    };
  }, []);
  const play = (restart = false) => {
    const media = mediaRef.current;
    if (!media || !audio.src) {
      fail();
      return;
    }
    clearTimer();
    setNotice("");
    if (restart || media.ended) {
      media.currentTime = 0;
      countNextPlay.current = true;
    }
    if (media.error) media.load();
    media.playbackRate = rate;
    setState("loading");
    timer.current = setTimeout(fail, 10000);
    void media.play().catch(fail);
  };
  return (
    <div className="audio-player">
      <audio
        ref={mediaRef}
        src={audio.src}
        preload="metadata"
        onPlaying={() => {
          clearTimer();
          setState("playing");
          if (countNextPlay.current) {
            countNextPlay.current = false;
            onPlay();
          }
        }}
        onPause={() => {
          const media = mediaRef.current;
          if (media && !media.ended && !media.error)
            setState((current) => (current === "error" ? current : "paused"));
        }}
        onEnded={() => {
          clearTimer();
          countNextPlay.current = true;
          setState("idle");
        }}
        onError={fail}
      />
      <div className="audio-controls">
        <button
          className="audio-round"
          disabled={state === "loading"}
          onClick={() =>
            state === "playing" ? mediaRef.current?.pause() : play()
          }
          aria-label={state === "playing" ? "暂停" : "播放"}
        >
          {state === "playing" ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button
          className="audio-round"
          onClick={() => play(true)}
          aria-label="重新播放"
          title="重新播放"
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div className="audio-meta">
        <span>
          {state === "playing"
            ? "正在播放…"
            : state === "paused"
              ? "已暂停"
              : state === "loading"
                ? "正在准备音频…"
                : state === "error"
                  ? "播放失败"
                  : "准备就绪"}
        </span>
        {audio.duration ? <small>约 {audio.duration} 秒</small> : null}
        {notice && (
          <small role={state === "error" ? "alert" : "status"}>{notice}</small>
        )}
      </div>
    </div>
  );
}
