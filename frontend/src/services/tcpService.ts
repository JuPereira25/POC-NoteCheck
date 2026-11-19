import { API_URL } from "@/services/api"

export interface TcpStatus {
  connected: boolean
  lastCommandSent: string | null
  lastResponseReceived: string | null
  lastSerialTrigger?: string | null
  lastInspectionResult?: "PASS" | "FAIL" | null
  batchResults?: Array<"PASS" | "FAIL"> | null
  batchStartSequence?: number
  inspectionSequence?: number
}

export async function resetCommunication() {
  const response = await fetch(`${API_URL}/api/tcp/reset`, {
    method: "POST",
  })

  if (!response.ok)
    throw new Error("Falha ao limpar a comunicacao")
}

export async function getTcpStatus(signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/api/tcp/status`, { signal })

  if (!response.ok)
    throw new Error("Falha ao consultar o status da conexao")

  const data: TcpStatus = await response.json()
  return data
}
