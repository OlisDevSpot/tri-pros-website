interface Window {
  gapi: {
    load: (library: string, callback: () => void) => void
  }
}
