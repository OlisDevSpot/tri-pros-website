export interface ContactProperties {
  firstname: string
  lastname: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
}

export interface ContactsProperties {
  firstname: {
    value: string
  }
  lastname: {
    value: string
  }
  email: {
    value: string
  }
  phone: {
    value: string
  }
  address: {
    value: string
  }
  city: {
    value: string
  }
  state: {
    value: string
  }
  zip: {
    value: string
  }
}

export interface ContactResponse {
  properties: ContactProperties
}

export interface ContactsResponse {
  contacts: {
    properties: ContactsProperties
  }[]
}
