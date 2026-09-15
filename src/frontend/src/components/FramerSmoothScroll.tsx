import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";

export function FramerSmoothScroll({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight);
      }
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (contentRef.current) {
      observer.observe(contentRef.current);
    }
    return () => observer.disconnect();
  }, [children]);

  // Use the local container for scrolling
  const { scrollY } = useScroll({ container: scrollRef });

  const smoothProgress = useSpring(scrollY, {
    mass: 0.1,
    stiffness: 100,
    damping: 20,
    restDelta: 0.001
  });

  const y = useTransform(smoothProgress, (value) => -value);

  return (
    <div
      ref={scrollRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative" // important for sticky child
      }}
    >
      {/* 
        This invisible div forces the container to have a scrollbar
        corresponding to the actual height of the content. 
      */}
      <div style={{ height: contentHeight, width: '100%', position: 'absolute', top: 0, left: 0, zIndex: -1 }} />

      {/* 
        The content is sticky, so native scroll doesn't move it visually.
        Instead, Framer Motion translates it up based on the scroll position. 
      */}
      <motion.div
        ref={contentRef}
        style={{
          y,
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          willChange: "transform",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
