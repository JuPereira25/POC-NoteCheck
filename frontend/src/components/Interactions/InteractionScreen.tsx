import { useEffect, type ReactNode } from "react"
import styles from "./Interactions.module.css"

type InteractionTone = "success" | "error"
type InteractionPace = "quick" | "standard" | "final"

const INTERACTION_DURATION: Record<InteractionPace, number> = {
  quick: 3000,
  standard: 3000,
  final: 3000,
}

interface InteractionScreenProps {
  children: ReactNode
  tone: InteractionTone
  pace: InteractionPace
  /** When true, the screen stays visible after the entrance animation. */
  persist?: boolean
  onComplete?: () => void
}

export default function InteractionScreen({
  children,
  tone,
  pace,
  persist = false,
  onComplete,
}: InteractionScreenProps) {
  useEffect(() => {
    if (!onComplete || persist)
      return

    const timeout = window.setTimeout(onComplete, INTERACTION_DURATION[pace])
    return () => window.clearTimeout(timeout)
  }, [onComplete, pace, persist])

  return (
    <section
      className={`${styles.screen} ${styles[tone]} ${styles[pace]} ${persist ? styles.persist : ""}`}
      aria-live={tone === "error" ? "assertive" : "polite"}
      role={tone === "error" ? "alert" : "status"}
    >
      <h2>{children}</h2>
    </section>
  )
}
