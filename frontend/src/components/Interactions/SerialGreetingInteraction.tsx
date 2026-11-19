import InteractionScreen from "./InteractionScreen"

interface SerialGreetingInteractionProps {
  onComplete: () => void
}

export default function SerialGreetingInteraction({ onComplete }: SerialGreetingInteractionProps) {
  return (
    <InteractionScreen tone="success" pace="standard" onComplete={onComplete}>
      Olá! Vamos começar?
    </InteractionScreen>
  )
}
