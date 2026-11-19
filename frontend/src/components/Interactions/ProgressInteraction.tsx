import InteractionScreen from "./InteractionScreen"

interface ProgressInteractionProps {
  onComplete: () => void
}

export default function ProgressInteraction({ onComplete }: ProgressInteractionProps) {
  return (
    <InteractionScreen tone="success" pace="quick" onComplete={onComplete}>
      Continue assim, faltam poucas peças
    </InteractionScreen>
  )
}
