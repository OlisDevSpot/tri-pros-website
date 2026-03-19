declare namespace google.picker {
  enum Action {
    PICKED = 'picked',
    CANCEL = 'cancel',
  }

  enum Feature {
    MULTISELECT_ENABLED = 'multiselect-enabled',
  }

  enum ViewId {
    DOCS_IMAGES = 'docs-images',
  }

  class DocsView {
    constructor(viewId?: ViewId)
    setIncludeFolders: (include: boolean) => DocsView
    setMimeTypes: (mimeTypes: string) => DocsView
    setSelectFolderEnabled: (enabled: boolean) => DocsView
  }

  class PickerBuilder {
    setOAuthToken: (token: string) => PickerBuilder
    addView: (view: DocsView) => PickerBuilder
    enableFeature: (feature: Feature) => PickerBuilder
    setCallback: (cb: (data: PickerResponse) => void) => PickerBuilder
    build: () => Picker
  }

  interface Picker {
    setVisible: (visible: boolean) => void
  }

  interface PickerResponse {
    action: Action
    docs: PickerDocument[]
  }

  interface PickerDocument {
    id: string
    name: string
    mimeType: string
  }
}
