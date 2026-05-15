"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Rendition } from "epubjs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Type } from "lucide-react";
import { saveReadingPosition } from "@/lib/actions-read";

const ReactReader = dynamic(() => import("react-reader").then((m) => m.ReactReader), {
  ssr: false,
});

type Props = {
  bookId: string;
  url: string;
  initialCfi: string | null;
};

const FONT_SIZES = [85, 100, 115, 130, 150];

export function EpubReader({ bookId, url, initialCfi }: Props) {
  const [location, setLocation] = useState<string | number | null>(initialCfi);
  const [fontSize, setFontSize] = useState(115);
  const renditionRef = useRef<Rendition | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLocationChanged = useCallback(
    (cfi: string) => {
      setLocation(cfi);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveReadingPosition(bookId, cfi).catch(() => {});
      }, 1500);
    },
    [bookId]
  );

  const getRendition = useCallback(
    (rendition: Rendition) => {
      renditionRef.current = rendition;
      rendition.themes.register("dark", {
        body: {
          background: "transparent",
          color: "#e5e5e5",
          "font-family": "Georgia, serif",
          "line-height": "1.7",
        },
        a: { color: "#9ca3af" },
        "h1, h2, h3, h4, h5, h6": { color: "#f5f5f5" },
        p: { color: "#e5e5e5" },
      });
      rendition.themes.select("dark");
      rendition.themes.fontSize(`${fontSize}%`);
    },
    [fontSize]
  );

  useEffect(() => {
    if (renditionRef.current) renditionRef.current.themes.fontSize(`${fontSize}%`);
  }, [fontSize]);

  const cycleSize = () => {
    const idx = FONT_SIZES.indexOf(fontSize);
    setFontSize(FONT_SIZES[(idx + 1) % FONT_SIZES.length]);
  };

  const prev = () => renditionRef.current?.prev();
  const next = () => renditionRef.current?.next();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="absolute inset-0">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={cycleSize} className="gap-1.5">
          <Type className="size-3.5" /> {fontSize}%
        </Button>
      </div>
      <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2">
        <Button variant="ghost" size="icon" onClick={prev} className="rounded-full">
          <ChevronLeft className="size-5" />
        </Button>
      </div>
      <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
        <Button variant="ghost" size="icon" onClick={next} className="rounded-full">
          <ChevronRight className="size-5" />
        </Button>
      </div>
      <ReactReader
        url={url}
        location={location}
        locationChanged={onLocationChanged}
        getRendition={getRendition}
        showToc
        readerStyles={readerStyles}
        epubOptions={{ allowPopups: true, allowScriptedContent: false }}
      />
    </div>
  );
}

const readerStyles = {
  container: {
    position: "relative" as const,
    height: "100%",
    width: "100%",
  },
  readerArea: {
    position: "relative" as const,
    zIndex: 1,
    height: "100%",
    width: "100%",
    backgroundColor: "transparent",
    transition: "all 0.3s ease",
  },
  containerExpanded: { transform: "translateX(0px)" },
  titleArea: { display: "none" },
  reader: {
    position: "absolute" as const,
    inset: 0,
    color: "#e5e5e5",
  },
  swipeWrapper: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  prev: { display: "none" },
  next: { display: "none" },
  arrow: { display: "none" },
  arrowHover: { display: "none" },
  toc: {
    position: "absolute" as const,
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    width: 256,
    overflowY: "auto" as const,
    background: "#0a0a0a",
    color: "#e5e5e5",
    transition: "all 0.3s ease",
  },
  tocArea: {
    position: "absolute" as const,
    left: 0,
    top: 0,
    bottom: 0,
    padding: "12px 16px",
    overflowY: "auto" as const,
    background: "#0a0a0a",
    color: "#e5e5e5",
  },
  tocAreaButton: {
    userSelect: "none" as const,
    appearance: "none" as const,
    background: "none",
    border: "none",
    display: "block",
    fontFamily: "inherit",
    width: "100%",
    fontSize: "0.9em",
    textAlign: "left" as const,
    padding: "0.6em 1em",
    borderBottom: "1px solid #1f1f1f",
    color: "#cccccc",
    cursor: "pointer",
  },
  tocButton: {
    background: "none",
    border: "none",
    width: 48,
    height: 48,
    position: "absolute" as const,
    top: 8,
    left: 8,
    zIndex: 11,
    borderRadius: 8,
    color: "#e5e5e5",
    cursor: "pointer",
  },
  tocButtonExpanded: { background: "transparent" },
  tocButtonBar: {
    position: "absolute" as const,
    width: "60%",
    background: "#cccccc",
    height: 2,
    left: "20%",
  },
  tocButtonBarTop: { top: 18 },
  tocButtonBottom: { bottom: 18 },
  tocBackground: {
    position: "absolute" as const,
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 9,
  },
  errorView: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    color: "#ef4444",
  },
  loadingView: {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    color: "#888",
  },
};
