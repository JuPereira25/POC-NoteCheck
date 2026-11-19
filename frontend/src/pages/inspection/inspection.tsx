import { Header } from "@/components/Header"
import { Footer } from "@/components/Footer"
import {
  FailedAssemblyInteraction,
  ProgressInteraction,
  RedoSequenceInteraction,
  SerialGreetingInteraction,
  SuccessfulAssemblyInteraction,
} from "@/components"
import prototypeImage from "@/assets/PROTOTIPO.png"
import { useCallback, useEffect, useRef, useState } from "react"
import type { InspectionStatus } from "@/components/Header/Header"
import { getKitSteps } from "@/services/api"
import { getTcpStatus, resetCommunication } from "@/services/tcpService"
import styles from "./inspection.module.css"

const STATUS_UPDATE_INTERVAL = 250
const GROUP_SIZE = 3
const TIMER_TICK_INTERVAL = 100

type StepStatus = "pending" | "running" | "pass" | "fail"
type FinalOutcome = "pass" | "fail" | null
type TransientInteraction = "serialGreeting" | "progress" | "redoGroup1" | "redoAll" | null

const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  pending: "",
  running: "",
  pass: "",
  fail: "",
}

interface InspectionProps {
  barcode: string | null
  onBarcodeRead: (value: string) => void
}

function isGroupReady(statuses: StepStatus[], start: number) {
  const group = statuses.slice(start, start + GROUP_SIZE)
  return group.length === GROUP_SIZE && group.every((status) => status === "pass" || status === "fail")
}

function isGroupPassed(statuses: StepStatus[], start: number) {
  const group = statuses.slice(start, start + GROUP_SIZE)
  return group.length === GROUP_SIZE && group.every((status) => status === "pass")
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

const Inspection = ({ barcode, onBarcodeRead }: InspectionProps) => {
  const [result, setResult] = useState<InspectionStatus>("TOTAL")
  const [isTriggering, setIsTriggering] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<string | null>(null)
  const [lastSerialTrigger, setLastSerialTrigger] = useState<string | null>(null)
  const [inspectionSteps, setInspectionSteps] = useState<string[]>([])
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([])
  const [stepsError, setStepsError] = useState<string | null>(null)
  const [isLoadingSteps, setIsLoadingSteps] = useState(false)
  const [finalOutcome, setFinalOutcome] = useState<FinalOutcome>(null)
  const [activeInteraction, setActiveInteraction] = useState<TransientInteraction>(null)
  const [showPrototypeMarkers, setShowPrototypeMarkers] = useState(false)
  const [inspectionReloadKey, setInspectionReloadKey] = useState(0)
  const [totalElapsedMs, setTotalElapsedMs] = useState(0)
  const [group1ElapsedMs, setGroup1ElapsedMs] = useState(0)
  const [group2ElapsedMs, setGroup2ElapsedMs] = useState(0)
  const barcodeRef = useRef(barcode)
  const stepStatusesRef = useRef<StepStatus[]>([])
  const lastInspectionSequence = useRef<number | null>(null)
  const completionResetSent = useRef(false)
  const finalOutcomeRef = useRef<FinalOutcome>(null)
  const progressInteractionTracker = useRef({ barcode: null as string | null, shown: false })
  const totalTimerRef = useRef<{ running: boolean; startedAt: number | null; frozenMs: number }>({
    running: false,
    startedAt: null,
    frozenMs: 0,
  })
  const groupTimersRef = useRef({
    group1: { running: false, startedAt: null as number | null, frozenMs: 0 },
    group2: { running: false, startedAt: null as number | null, frozenMs: 0 },
  })
  const group1Passed = isGroupPassed(stepStatuses, 0)
  const group2Passed = isGroupPassed(stepStatuses, GROUP_SIZE)
  const allStepsPassed = inspectionSteps.length >= GROUP_SIZE * 2 && group1Passed && group2Passed
  const allStepsCompleted = allStepsPassed
  const currentStepIndex = stepStatuses.findIndex(
    (status) => status === "running" || status === "pending",
  )
  const clearActiveInteraction = useCallback(() => setActiveInteraction(null), [])

  const readTimerMs = useCallback((timer: { running: boolean; startedAt: number | null; frozenMs: number }) => {
    if (timer.running && timer.startedAt !== null)
      return Date.now() - timer.startedAt

    return timer.frozenMs
  }, [])

  const syncDisplayedTimers = useCallback(() => {
    setTotalElapsedMs(readTimerMs(totalTimerRef.current))
    setGroup1ElapsedMs(readTimerMs(groupTimersRef.current.group1))
    setGroup2ElapsedMs(readTimerMs(groupTimersRef.current.group2))
  }, [readTimerMs])

  const resetAllTimers = useCallback(() => {
    totalTimerRef.current = { running: false, startedAt: null, frozenMs: 0 }
    groupTimersRef.current = {
      group1: { running: false, startedAt: null, frozenMs: 0 },
      group2: { running: false, startedAt: null, frozenMs: 0 },
    }
    setTotalElapsedMs(0)
    setGroup1ElapsedMs(0)
    setGroup2ElapsedMs(0)
  }, [])

  const resetGroupTimers = useCallback(() => {
    groupTimersRef.current = {
      group1: { running: false, startedAt: null, frozenMs: 0 },
      group2: { running: false, startedAt: null, frozenMs: 0 },
    }
    setGroup1ElapsedMs(0)
    setGroup2ElapsedMs(0)
  }, [])

  const startTotalTimer = useCallback(() => {
    if (totalTimerRef.current.running)
      return

    totalTimerRef.current = {
      running: true,
      startedAt: Date.now() - totalTimerRef.current.frozenMs,
      frozenMs: totalTimerRef.current.frozenMs,
    }
    syncDisplayedTimers()
  }, [syncDisplayedTimers])

  const stopTotalTimer = useCallback(() => {
    if (!totalTimerRef.current.running)
      return

    totalTimerRef.current = {
      running: false,
      startedAt: null,
      frozenMs: readTimerMs(totalTimerRef.current),
    }
    syncDisplayedTimers()
  }, [readTimerMs, syncDisplayedTimers])

  const startGroupTimer = useCallback((group: 1 | 2) => {
    const key = group === 1 ? "group1" : "group2"
    if (groupTimersRef.current[key].running)
      return

    groupTimersRef.current[key] = {
      running: true,
      startedAt: Date.now() - groupTimersRef.current[key].frozenMs,
      frozenMs: groupTimersRef.current[key].frozenMs,
    }
    syncDisplayedTimers()
  }, [syncDisplayedTimers])

  const stopGroupTimer = useCallback((group: 1 | 2) => {
    const key = group === 1 ? "group1" : "group2"
    const timer = groupTimersRef.current[key]
    if (!timer.running)
      return

    groupTimersRef.current[key] = {
      running: false,
      startedAt: null,
      frozenMs: readTimerMs(timer),
    }
    syncDisplayedTimers()
  }, [readTimerMs, syncDisplayedTimers])

  const finishSerialGreeting = useCallback(() => {
    setActiveInteraction(null)
    setShowPrototypeMarkers(true)
    startTotalTimer()
    startGroupTimer(1)
  }, [startGroupTimer, startTotalTimer])

  const clearStepsPanel = useCallback(() => {
    setInspectionSteps([])
    setStepStatuses([])
    stepStatusesRef.current = []
    setShowPrototypeMarkers(false)
    setStepsError(null)
    setIsLoadingSteps(false)
  }, [])

  // Fim OK/NOK: mantém a mensagem, zera cronômetros, limpa o painel e espera nova serial.
  const holdFinalOutcome = useCallback((outcome: Exclude<FinalOutcome, null>) => {
    resetAllTimers()
    setIsTriggering(false)
    setActiveInteraction(null)
    setFinalOutcome(outcome)
    finalOutcomeRef.current = outcome
    clearStepsPanel()
    void resetCommunication().catch(() => {
      // A mensagem final deve permanecer mesmo se o reset falhar.
    })
  }, [clearStepsPanel, resetAllTimers])

  const finishRedoGroup1 = useCallback(() => {
    setActiveInteraction(null)
    setResult("TOTAL")
    setIsTriggering(false)
    setStepStatuses((statuses) => {
      const next = statuses.map((status, index) =>
        index < GROUP_SIZE ? "pending" as StepStatus : status,
      )
      stepStatusesRef.current = next
      return next
    })
  }, [])

  const finishRedoAll = useCallback(() => {
    setActiveInteraction(null)
    setResult("TOTAL")
    setIsTriggering(false)
    setStepStatuses((statuses) => {
      const next = statuses.map(() => "pending" as StepStatus)
      stepStatusesRef.current = next
      return next
    })
    progressInteractionTracker.current.shown = false
    // Refaz 1–6: zera só os grupos; o geral segue (operador ainda na mesma inspeção).
    resetGroupTimers()
    startTotalTimer()
    startGroupTimer(1)
  }, [resetGroupTimers, startGroupTimer, startTotalTimer])

  function handleBarcodeAttempt(value: string) {
    // Qualquer serial reinicia do zero: limpa, manda RS e mostra o olá de novo.
    if (!barcode || value !== barcode) {
      onBarcodeRead(value)
      return
    }

    setInspectionReloadKey((key) => key + 1)
  }

  function handleStart() {
    const currentStep = stepStatuses.findIndex((status) => status === "pending")

    if (isTriggering || !barcode || currentStep === -1)
      return

    setIsTriggering(true)
    setStepStatuses((statuses) => {
      const next = statuses.map((status, index) => index === currentStep ? "running" as StepStatus : status)
      stepStatusesRef.current = next
      return next
    })
  }

  async function handleStop() {
    setIsTriggering(false)
    setResult("TOTAL")
    setFinalOutcome(null)
    finalOutcomeRef.current = null
    setStepStatuses(() => {
      const next = inspectionSteps.map(() => "pending" as StepStatus)
      stepStatusesRef.current = next
      return next
    })
    resetAllTimers()

    try {
      await resetCommunication()
    } catch {
      // A tela deve ser limpa mesmo quando o backend estiver indisponivel.
    }
  }

  useEffect(() => {
    stepStatusesRef.current = stepStatuses
  }, [stepStatuses])

  useEffect(() => {
    const interval = window.setInterval(syncDisplayedTimers, TIMER_TICK_INTERVAL)
    return () => window.clearInterval(interval)
  }, [syncDisplayedTimers])

  useEffect(() => {
    const controller = new AbortController()

    async function updateCameraStatus() {
      try {
        const status = await getTcpStatus(controller.signal)
        setIsConnected(status.connected)
        setLastCommand(status.lastCommandSent)
        setLastResponse(status.lastResponseReceived)
        setLastSerialTrigger(status.lastSerialTrigger ?? null)

        const sequence = status.inspectionSequence ?? 0
        if (lastInspectionSequence.current === null) {
          lastInspectionSequence.current = sequence
          return
        }

        if (sequence === lastInspectionSequence.current)
          return

        lastInspectionSequence.current = sequence

        // Já terminou (OK/NOK): ignora novos lotes até ler outra serial.
        if (finalOutcomeRef.current !== null)
          return

        const batch = status.batchResults
        if (!barcodeRef.current || !batch || batch.length !== GROUP_SIZE)
          return

        const currentStatuses = stepStatusesRef.current
        if (currentStatuses.length < GROUP_SIZE)
          return

        const groupStart = isGroupPassed(currentStatuses, 0) ? GROUP_SIZE : 0
        if (currentStatuses.length < groupStart + GROUP_SIZE)
          return

        // Já tem resultado neste grupo: ignora lote duplicado.
        if (isGroupReady(currentStatuses, groupStart))
          return

        const activeGroup = groupStart === 0 ? 1 : 2
        const mapped = batch.map((item) => item === "PASS" ? "pass" as const : "fail" as const)
        const groupHasNok = mapped.some((item) => item === "fail")
        const nextStatuses = currentStatuses.map((stepStatus, index) => {
          if (index < groupStart || index >= groupStart + GROUP_SIZE)
            return stepStatus

          return mapped[index - groupStart]
        })

        stepStatusesRef.current = nextStatuses
        setStepStatuses(nextStatuses)
        setResult(groupHasNok ? "FAIL" : "PASS")
        setIsTriggering(false)

        if (groupHasNok) {
          void resetCommunication().catch(() => {
            // A tela de refazer deve aparecer mesmo se o reset falhar.
          })

          // NOK intermediário: cronômetros seguem — operador ainda vai refazer.
          if (groupStart === 0)
            setActiveInteraction("redoGroup1")
          else
            setActiveInteraction("redoAll")

          return
        }

        // Grupo OK: congela o tempo daquele grupo.
        stopGroupTimer(activeGroup)

        if (groupStart === 0) {
          startGroupTimer(2)

          if (!progressInteractionTracker.current.shown) {
            progressInteractionTracker.current.shown = true
            setActiveInteraction("progress")
          }
        } else {
          stopTotalTimer()
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setIsConnected(false)
      }
    }

    void updateCameraStatus()
    const interval = window.setInterval(updateCameraStatus, STATUS_UPDATE_INTERVAL)

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [startGroupTimer, stopGroupTimer, stopTotalTimer])

  useEffect(() => {
    barcodeRef.current = barcode
    setResult("TOTAL")
    setIsTriggering(false)
    setFinalOutcome(null)
    finalOutcomeRef.current = null
    setInspectionSteps([])
    setStepStatuses([])
    stepStatusesRef.current = []
    setStepsError(null)
    setShowPrototypeMarkers(false)
    setActiveInteraction(null)
    completionResetSent.current = false
    lastInspectionSequence.current = null
    progressInteractionTracker.current.shown = false
    resetAllTimers()

    if (!barcode)
      return

    void resetCommunication().catch(() => {
      // A nova serial deve seguir mesmo se o RS falhar.
    })
  }, [barcode, inspectionReloadKey, resetAllTimers])

  useEffect(() => {
    if (!barcode)
      return

    let isMounted = true
    setIsLoadingSteps(true)
    setStepsError(null)

    async function loadKitSteps() {
      try {
        const serial = barcode?.trim()

        if (!serial)
          return

        const kit = await getKitSteps(serial)
        if (!isMounted)
          return

        const nextSteps = kit.steps.filter((step) => step.trim().length > 0)
        if (nextSteps.length === 0) {
          setStepsError("Este kit não possui steps cadastrados.")
          return
        }

        setInspectionSteps(nextSteps)
        const nextStatuses = nextSteps.map(() => "pending" as StepStatus)
        stepStatusesRef.current = nextStatuses
        setStepStatuses(nextStatuses)
        setActiveInteraction("serialGreeting")
      } catch (error) {
        if (!isMounted)
          return

        setInspectionSteps([])
        setStepStatuses([])
        stepStatusesRef.current = []
        setStepsError(error instanceof Error ? error.message : "Não foi possível carregar os steps do kit.")
      } finally {
        if (isMounted)
          setIsLoadingSteps(false)
      }
    }

    void loadKitSteps()

    return () => {
      isMounted = false
    }
  }, [barcode, inspectionReloadKey])

  useEffect(() => {
    if (progressInteractionTracker.current.barcode !== barcode) {
      progressInteractionTracker.current = { barcode, shown: false }
    }
  }, [barcode])

  useEffect(() => {
    if (finalOutcome !== null)
      return

    if (!allStepsCompleted) {
      completionResetSent.current = false
      return
    }

    if (completionResetSent.current)
      return

    completionResetSent.current = true
    holdFinalOutcome("pass")
  }, [allStepsCompleted, finalOutcome, holdFinalOutcome])

  function renderEmptyStepItem(index: number) {
    return (
      <li
        key={`empty-${index}`}
        className={styles.stepPlaceholder}
        aria-label={`Etapa ${index + 1} aguardando`}
      >
        <span className={styles.stepCheck} aria-hidden="true">
          {index + 1}
        </span>
        <span className={styles.stepText}>
          <span className={styles.stepMeta}>
            <small>ETAPA {index + 1}</small>
          </span>
          <strong>—</strong>
        </span>
      </li>
    )
  }

  function renderStepItem(step: string, index: number) {
    const status = stepStatuses[index]
    const isCurrentStep = index === currentStepIndex
    const statusLabel = STEP_STATUS_LABELS[status]

    return (
      <li
        key={`${step}-${index}`}
        className={`${styles[status]} ${isCurrentStep ? styles.current : ""}`}
        aria-current={isCurrentStep ? "step" : undefined}
        aria-label={`Etapa ${index + 1}: ${step}${statusLabel ? `. ${statusLabel}` : ""}`}
      >
        <span className={styles.stepCheck} aria-hidden="true">
          {status === "pass" ? "✓" : status === "fail" ? "×" : index + 1}
        </span>
        <span className={styles.stepText}>
          <span className={styles.stepMeta}>
            <small>ETAPA {index + 1}</small>
            {statusLabel && <span className={styles.stepState}>{statusLabel}</span>}
          </span>
          <strong>{step}</strong>
        </span>
      </li>
    )
  }

  return (
    <main className={styles.page}>
      <Header
        result={result}
        isTriggering={isTriggering}
        onStart={handleStart}
        onStop={handleStop}
        onBarcodeRead={handleBarcodeAttempt}
        barcodeLocked={false}
      />
      <section className={styles.inspectionView} aria-label="Imagens da inspeção">
        <div className={styles.imageContainer}>
          <div className={styles.prototypeStage}>
            <img
              className={styles.prototypeImage}
              src={prototypeImage}
              alt="Protótipo de referência para a inspeção"
            />
            {showPrototypeMarkers && (
              <div className={styles.prototypeMarkers} aria-hidden="true">
                {(group1Passed ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]).map((number) => {
                  const markerStatus = stepStatuses[number - 1]
                  const markerStatusClass = markerStatus === "pass"
                    ? styles.prototypeMarkerPass
                    : markerStatus === "fail"
                      ? styles.prototypeMarkerFail
                      : markerStatus === "running"
                        ? styles.prototypeMarkerRunning
                        : ""

                  return (
                    <span
                      className={`${styles.prototypeMarker} ${markerStatusClass}`}
                      key={number}
                    >
                      {number}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <div className={styles.totalTimerBar} aria-label="Tempo total do teste">
            <p className={styles.totalTimerValue}>{formatElapsed(totalElapsedMs)}</p>
          </div>

          {activeInteraction === "serialGreeting" && (
            <SerialGreetingInteraction onComplete={finishSerialGreeting} />
          )}
          {activeInteraction === "progress" && (
            <ProgressInteraction onComplete={clearActiveInteraction} />
          )}
          {activeInteraction === "redoGroup1" && (
            <RedoSequenceInteraction
              message="NOK detectado. Refaça a sequência (1 a 3)."
              onComplete={finishRedoGroup1}
            />
          )}
          {activeInteraction === "redoAll" && (
            <RedoSequenceInteraction
              message="NOK detectado. Refaça tudo (1 a 6)."
              onComplete={finishRedoAll}
            />
          )}
          {!activeInteraction && finalOutcome === "pass" && (
            <SuccessfulAssemblyInteraction />
          )}
          {!activeInteraction && finalOutcome === "fail" && (
            <FailedAssemblyInteraction />
          )}
        </div>

        <aside className={styles.stepsPanel} aria-label="Etapas da inspeção">
          <div className={styles.stepsContent}>
            <div className={styles.groupBlock}>
              <div className={styles.groupTimerHeader}>
                <strong>CAMADA 1 (1-3)</strong>
                <span className={styles.groupTimerValue}>{formatElapsed(group1ElapsedMs)}</span>
              </div>
              <ol className={styles.stepsList}>
                {Array.from({ length: GROUP_SIZE }, (_, index) => {
                  const step = inspectionSteps[index]
                  if (!step)
                    return renderEmptyStepItem(index)

                  return renderStepItem(step, index)
                })}
              </ol>
            </div>

            <div className={styles.groupBlock}>
              <div className={styles.groupTimerHeader}>
                <strong>CAMADA 2 (4-6)</strong>
                <span className={styles.groupTimerValue}>{formatElapsed(group2ElapsedMs)}</span>
              </div>
              <ol className={styles.stepsList}>
                {Array.from({ length: GROUP_SIZE }, (_, offset) => {
                  const index = offset + GROUP_SIZE
                  const step = inspectionSteps[index]
                  if (!step)
                    return renderEmptyStepItem(index)

                  return renderStepItem(step, index)
                })}
              </ol>
            </div>
          </div>

          {barcode && isLoadingSteps && (
            <p className={styles.stepsStatusNote}>Carregando steps...</p>
          )}
          {barcode && stepsError && (
            <p className={`${styles.stepsStatusNote} ${styles.stepsError}`}>{stepsError}</p>
          )}
          {(!barcode || finalOutcome !== null) && !isLoadingSteps && (
            <p className={styles.stepsStatusNote}>Aguardando leitura da serial...</p>
          )}
        </aside>
      </section>
      <Footer
        isConnected={isConnected}
        lastCommand={lastCommand}
        lastResponse={lastResponse}
        lastSerialTrigger={lastSerialTrigger}
      />
    </main>
  )
}

export default Inspection
