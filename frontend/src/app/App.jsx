import { RouterProvider } from "react-router"
import { AppStore } from "../store/AppStore"
import { router } from "./routes.jsx"

export default function App() {
  return (
    <AppStore>
      <RouterProvider router={router} />
    </AppStore>
  )
}
