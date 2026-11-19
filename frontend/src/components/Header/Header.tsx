import styles from "./Header.module.css"
import start from "@/assets/BUTTON START.png"
import stop from "@/assets/BUTTON STOP.png"
import { Barcode } from "@/components/Barcode"

export type InspectionStatus = "PASS" | "FAIL" | "TOTAL"

interface HeaderProps {
  result: InspectionStatus
  isTriggering: boolean
  onStart: () => void
  onStop: () => void
  onBarcodeRead?: (value: string) => void
  barcodeLocked?: boolean
}

export default function Header({
  result,
  isTriggering,
  onStart,
  onStop,
  onBarcodeRead,
  barcodeLocked = false,
}: HeaderProps) {
  return (
    <header className={styles.content}>
      <div className={styles.controls} aria-label="Controles da inspecao">
        <button
          type="button"
          onClick={onStart}
          disabled={isTriggering}
          className={styles.imageButton}
          aria-label="Iniciar inspecao"
          title="Iniciar"
        >
          <img src={start} alt="" />
        </button>

        <button
          type="button"
          onClick={onStop}
          className={styles.imageButton}
          aria-label="Parar inspecao"
          title="Parar"
        >
          <img src={stop} alt="" />
        </button>

        <Barcode onRead={onBarcodeRead} disabled={barcodeLocked} />
      </div>

      <output
        className={`${styles.result} ${
          result === "PASS"
            ? styles.resultPass
            : result === "FAIL"
              ? styles.resultFail
              : styles.resultTotal
        }`}
        aria-live="polite"
      >
        {result === "PASS" ? "OK" : result === "FAIL" ? "NOK" : "TOTAL"}
      </output>
    </header>
  )
}
