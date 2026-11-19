import { useState } from 'react'
import Router from '@/Router'

function App() {
  const [barcode, setBarcode] = useState<string | null>(null)

  function handleBarcodeRead(value: string) {
    console.log('Barcode lido:', value)
    setBarcode(value)
  }

  return (
    <Router
      barcode={barcode}
      onBarcodeRead={handleBarcodeRead}
    />
  )
}

export default App
