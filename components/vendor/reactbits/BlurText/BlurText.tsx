"use client";

// Adapted from https://reactbits.dev/r/BlurText-TS-TW.json
// Copyright (c) 2026 David Haz. MIT + Commons Clause; see ../LICENSE.md.
import { motion, useReducedMotion } from "motion/react";

export default function BlurText({ text }: { text: string }) {
  const reduce = useReducedMotion();
  return <span className="flex flex-wrap gap-x-2"><span className="sr-only">{text}</span>{text.split(" ").map((word, index) => <motion.span aria-hidden="true" key={index} className="blur-word inline-block" initial={reduce ? false : { opacity: 0, filter: "blur(4px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut", delay: reduce ? 0 : index * 0.02 }}>{word}</motion.span>)}</span>;
}
