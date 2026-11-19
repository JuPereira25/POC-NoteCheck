import InteractionScreen from "./InteractionScreen"

interface IncorrectPartInteractionProps {
  onComplete: () => void
}

export default function IncorrectPartInteraction({ onComplete }: IncorrectPartInteractionProps) {
  return (
    <InteractionScreen tone="error" pace="quick" onComplete={onComplete}>
      Peça incorreta detectada
    </InteractionScreen>
  )
}
