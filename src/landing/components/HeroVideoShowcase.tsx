import { motion, useReducedMotion } from "framer-motion";
import { useRef, useEffect } from "react";
import { HERO_VIDEO_SRC, HERO_VIDEO_ARIA_LABEL } from "../constants/media";
import { cn } from "@/lib/utils";

export function HeroVideoShowcase() {
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => undefined);
  }, []);

  return (
    <motion.div
      className="hero-video-perspective relative mx-auto w-full max-w-xl lg:max-w-none transform-gpu"
      initial={{ opacity: 0, y: 36, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.75, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="relative"
        animate={reducedMotion ? undefined : { y: [0, -10, 0] }}
        transition={
          reducedMotion
            ? undefined
            : { duration: 9, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {/* Animated gradient border */}
        <div className="hero-video-border-wrap rounded-[24px] p-[1px]">
          <div className="hero-video-glass relative overflow-hidden rounded-[23px]">
            {/* Aspect-ratio box prevents layout shift */}
            <div className="relative aspect-[16/10] w-full bg-slate-100/80">
              <video
                ref={videoRef}
                src={HERO_VIDEO_SRC}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                controls={false}
                controlsList="nodownload noplaybackrate noremoteplayback"
                aria-label={HERO_VIDEO_ARIA_LABEL}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover",
                  "transform-gpu will-change-transform",
                )}
              />
              {/* Subtle glass overlay for depth */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-sky-950/10 via-transparent to-white/5"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* Blue glow beneath */}
        <div
          className="pointer-events-none absolute -inset-4 -z-10 rounded-[32px] bg-primary/15 blur-3xl"
          aria-hidden="true"
        />
      </motion.div>
    </motion.div>
  );
}
