import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return <motion.header initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="page-heading">
    <div className="min-w-0"><h1 className="page-title">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>}</div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </motion.header>;
}
