import styles from "./Footer.module.css"

interface FooterProps {
  isConnected: boolean
  lastCommand: string | null
  lastResponse: string | null
  lastSerialTrigger?: string | null
}

export default function Footer({ isConnected, lastCommand, lastResponse, lastSerialTrigger }: FooterProps) {
  return (
    <footer className={styles.content}>
      <div className={styles.communicationLog} aria-live="polite">
        <p className={styles.message}>
          Comando enviado: {lastCommand ?? "Nenhum"}
        </p>
        <p className={styles.message}>
          Mensagem recebida: {lastResponse ?? "Nenhuma"}
        </p>
        <p className={styles.message}>
          Trigger serial: {lastSerialTrigger ?? "Nenhum"}
        </p>
      </div>

      <div
        className={`${styles.camera} ${isConnected ? styles.connected : styles.disconnected}`}
        role="status"
        aria-live="polite"
      >
        <span className={styles.statusIndicator} aria-hidden="true" />
        <span>{isConnected ? "CAMERA CONECTADA" : "CAMERA DESCONECTADA"}</span>
      </div>
    </footer>
  )
}
