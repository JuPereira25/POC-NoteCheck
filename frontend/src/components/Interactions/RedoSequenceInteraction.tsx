import InteractionScreen from "./InteractionScreen"

interface RedoSequenceInteractionProps {
  message: string
  onComplete: () => void
}

export default function RedoSequenceInteraction({ message, onComplete }: RedoSequenceInteractionProps) {
  return (
    <InteractionScreen tone="error" pace="final" onComplete={onComplete}>
      {message}
    </InteractionScreen>
  )
}
