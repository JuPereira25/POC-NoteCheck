export interface KitLookupResponse {
  serialKit: string
  steps: string[]
  produtos: string[]
}

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5272"

const MOCK_KITS: Record<string, KitLookupResponse> = {
  "123456789": {
    serialKit: "123456789",
    steps: ["HD"],
    produtos: ["HD"],
  },
}

export async function getKitSteps(serial: string): Promise<KitLookupResponse> {
  const mock = MOCK_KITS[serial.trim()]
  if (mock)
    return mock

  const response = await fetch(`${API_URL}/api/kits/${encodeURIComponent(serial)}`)

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    throw new Error((errorPayload as { mensagem?: string }).mensagem ?? "Kit não encontrado.")
  }

  return response.json()
}

