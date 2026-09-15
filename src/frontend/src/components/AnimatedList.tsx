import React, { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { AnimatePresence, motion } from "motion/react";

export interface AnimatedListProps {
  className?: string;
  children: React.ReactNode;
  delay?: number;
}

export const AnimatedList = React.memo(
  ({ className = "", children, delay = 1000 }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const childrenArray = React.Children.toArray(children);

    useEffect(() => {
      if (index < childrenArray.length - 1) {
        const timeout = setTimeout(() => {
          setIndex((prevIndex) => prevIndex + 1);
        }, delay);
        return () => clearTimeout(timeout);
      }
    }, [index, delay, childrenArray.length]);

    const itemsToShow = childrenArray.slice(0, index + 1).reverse();

    return (
      <div className={className} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <AnimatePresence>
          {itemsToShow.map((item) => (
            <AnimatedListItem key={(item as ReactElement).key}>
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    );
  },
);

AnimatedList.displayName = "AnimatedList";

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const animations = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 } as any,
  };

  return (
    <motion.div {...animations} layout style={{ display: "flex", flexDirection: "column" }}>
      {children}
    </motion.div>
  );
}
