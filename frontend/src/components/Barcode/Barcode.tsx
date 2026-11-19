import { useEffect, useRef, useState } from "react"
import styles from "./Barcode.module.css"

const CLEAR_AFTER_MS = 1800

interface BarcodeProps {
  onRead?: (value: string) => void
  disabled?: boolean
}

export default function Barcode({ onRead, disabled = false }: BarcodeProps) {
  const [value, setValue] = useState("")
  const clearTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current !== null)
        window.clearTimeout(clearTimeoutRef.current)
    }
  }, [])

  function scheduleClear() {
    if (clearTimeoutRef.current !== null)
      window.clearTimeout(clearTimeoutRef.current)

    clearTimeoutRef.current = window.setTimeout(() => {
      setValue("")
      clearTimeoutRef.current = null
    }, CLEAR_AFTER_MS)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter")
      return

    const barcodeValue = value.trim()
    if (!barcodeValue)
      return

    console.log("Barcode lido:", barcodeValue)
    onRead?.(barcodeValue)
    setValue(barcodeValue)
    scheduleClear()
  }

  return (
    <div className={styles.content}>
      <input
        id="inspection-barcode"
        className={styles.input}
        type="text"
        placeholder="Leia o barcode"
        autoComplete="off"
        autoFocus
        disabled={disabled}
        value={value}
        onChange={(event) => {
          if (clearTimeoutRef.current !== null) {
            window.clearTimeout(clearTimeoutRef.current)
            clearTimeoutRef.current = null
          }
          setValue(event.target.value)
        }}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
  
