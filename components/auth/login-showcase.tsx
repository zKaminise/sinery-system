"use client"

import * as React from "react"
import Image from "next/image"
import { CalendarClock, MessagesSquare, LayoutDashboard } from "lucide-react"

// Real stock imagery (Unsplash) evoking "how the system looks" — rotates on the
// right side of the login. A custom loader passes the URL straight through, so
// no next.config remotePatterns are required.
const passthrough = ({ src }: { src: string }) => src

const SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80",
    icon: LayoutDashboard,
    title: "Dashboard em tempo real",
    description: "Métricas de agenda, conversas e atendimento da sua clínica em um só lugar.",
  },
  {
    src: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1400&q=80",
    icon: MessagesSquare,
    title: "Sinery Assist no WhatsApp",
    description: "Atendimento inteligente que agenda, remarca e confirma — com você no controle.",
  },
  {
    src: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1400&q=80",
    icon: CalendarClock,
    title: "Agenda sem conflitos",
    description: "Horários, profissionais e serviços validados automaticamente.",
  },
]

export function LoginShowcase() {
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative hidden h-full overflow-hidden rounded-r-2xl lg:block">
      {SLIDES.map((slide, i) => (
        <Image
          key={slide.src}
          src={slide.src}
          loader={passthrough}
          unoptimized
          fill
          priority={i === 0}
          alt={slide.title}
          className={`object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
        />
      ))}

      {/* Brand gradient + copy overlay (legible over any image). */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/70 to-primary/30" />

      <div className="relative z-10 flex h-full flex-col justify-between p-10 text-primary-foreground">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">Sinery System</span>
        </div>

        <div className="flex flex-col gap-4">
          {SLIDES.map((slide, i) => {
            const Icon = slide.icon
            return (
              <div
                key={slide.title}
                className={`transition-all duration-500 ${i === index ? "opacity-100" : "hidden opacity-0"}`}
              >
                <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <Icon className="size-5.5" />
                </div>
                <h2 className="text-2xl font-semibold leading-tight">{slide.title}</h2>
                <p className="mt-1 max-w-sm text-sm text-primary-foreground/85">{slide.description}</p>
              </div>
            )
          })}

          <div className="mt-2 flex gap-1.5">
            {SLIDES.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                aria-label={slide.title}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-4 bg-white/40 hover:bg-white/60"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
