import InteractionScreen from "./InteractionScreen"

interface IncompleteAssemblyInteractionProps {
  onComplete: () => void
}

export default function IncompleteAssemblyInteraction({ onComplete }: IncompleteAssemblyInteractionProps) {
  return (
    <InteractionScreen tone="error" pace="final" onComplete={onComplete}>
      Montagem incompleta
    </InteractionScreen>
  )
}
