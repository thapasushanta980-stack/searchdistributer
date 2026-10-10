import { m } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Viewport reveal for below-the-fold sections. Server HTML and the first client render are plain
 * (fully visible, so crawlers and no-JS users see everything and hydration matches); after mount the
 * wrapper animates sections as they scroll into view. Reduced motion is handled by MotionConfig.
 */
export function Reveal({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "footer" }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const Tag = as;
  if (!ready) return <Tag className={className}>{children}</Tag>;
  const MotionTag = m[as];
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}
