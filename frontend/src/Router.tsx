import { Navigate, Route, Routes } from 'react-router-dom'
import { InspectionPage } from "@/pages"

interface RouterProps {
    barcode: string | null
    onBarcodeRead: (value: string) => void
}

const Router = ({ barcode, onBarcodeRead }: RouterProps) => (
    <Routes>
        <Route path="/" element={<Navigate to="/inspecion" replace />} />
        <Route
            path="/inspecion"
            element={
                <InspectionPage
                    barcode={barcode}
                    onBarcodeRead={onBarcodeRead}
                />
            }
        />
    </Routes>
)

export default Router
