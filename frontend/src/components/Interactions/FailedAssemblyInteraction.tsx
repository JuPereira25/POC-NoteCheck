import InteractionScreen from "./InteractionScreen"

export default function FailedAssemblyInteraction() {
  return (
    <InteractionScreen tone="error" pace="final" persist>
      Montagem malsucedida!
    </InteractionScreen>
  )
}
