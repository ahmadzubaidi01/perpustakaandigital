"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground">
        <div className="w-5 h-5" />
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer bg-transparent border-none active:scale-95 outline-none relative overflow-hidden"
      title={isDark ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ y: -20, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 20, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          {isDark ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-indigo-600" />}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
