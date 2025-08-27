import * as React from "react"
import { Toaster as SonnerToaster } from "sonner"

interface ToasterProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center"
  theme?: "light" | "dark" | "system"
  className?: string
  toastOptions?: any
}

const Toaster = ({ position = "top-right", theme = "dark", className, toastOptions, ...props }: ToasterProps) => {
  return React.createElement(SonnerToaster as any, {
    position,
    theme,
    className: `toaster group ${className || ''}`,
    toastOptions: {
      classNames: {
        toast:
          "group toast group-[.toaster]:bg-zinc-900 group-[.toaster]:text-white group-[.toaster]:border-zinc-800 group-[.toaster]:shadow-lg",
        description: "group-[.toast]:text-zinc-400",
        actionButton:
          "group-[.toast]:bg-white group-[.toast]:text-black",
        cancelButton:
          "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-400",
      },
      ...toastOptions,
    },
    ...props,
  })
}

export { Toaster }