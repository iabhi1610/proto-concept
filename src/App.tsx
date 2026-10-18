import { Editor } from "./tool/Editor"
import { Viewer } from "./viewer/Viewer"

export default function App() {
  const m = window.location.pathname.match(/^\/s\/([\w-]+)/)
  return m ? <Viewer shareId={m[1]} /> : <Editor />
}
